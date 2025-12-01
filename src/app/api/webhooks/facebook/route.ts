import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { messageEmitter, adsEmitter } from '@/lib/event-emitter';
import { db, getActiveDB, getCurrentDBMode } from '@/lib/db';

// Verify Token - Should match what you set in Facebook App Dashboard
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'my_secure_verify_token';
const APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

// Cache for Page Access Tokens (avoid DB lookup every message)
const pageTokenCache = new Map<string, { token: string; expires: number }>();

// Cache for user names (reduce API calls)
const userNameCache = new Map<string, { name: string; expires: number }>();

// Get Page Access Token from any user who has it
async function getPageAccessToken(pageId: string): Promise<string | null> {
    // Check cache first
    const cached = pageTokenCache.get(pageId);
    if (cached && cached.expires > Date.now()) {
        return cached.token;
    }

    try {
        // Find any user who has access to this page (using dual DB)
        const users = await db.findUsersWithFacebookToken();

        for (const user of users) {
            if (!user.facebookPageToken) continue;

            // Try to get page token from this user
            const response = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${user.facebookPageToken}`
            );
            const data = await response.json();

            if (data.access_token) {
                // Cache for 1 hour
                pageTokenCache.set(pageId, {
                    token: data.access_token,
                    expires: Date.now() + 3600000
                });
                return data.access_token;
            }
        }
    } catch (err) {
        console.error('[getPageAccessToken] Error:', err);
    }

    return null;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        // 1. Get raw body for signature verification
        const rawBody = await req.text();

        // 2. Verify Signature
        if (APP_SECRET) {
            const signature = req.headers.get('x-hub-signature-256');
            if (!signature) {
                console.warn('Missing X-Hub-Signature-256 header');
                return new NextResponse('Unauthorized', { status: 401 });
            }

            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', APP_SECRET)
                .update(rawBody)
                .digest('hex');

            // Constant time comparison to prevent timing attacks
            const sigBuffer = Buffer.from(signature, 'utf8');
            const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                console.warn('Invalid X-Hub-Signature-256');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        } else {
            console.warn('FACEBOOK_CLIENT_SECRET not set, skipping signature verification (INSECURE)');
        }

        const body = JSON.parse(rawBody);
        console.log('[Webhook] Received:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            for (const entry of body.entry) {
                const pageId = entry.id;
                const time = entry.time;
                console.log(`[Webhook] Processing entry for page: ${pageId}`);

                // Iterate over each messaging event
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        if (event.message) {
                            await handleMessage(pageId, event);
                        }
                    }
                }
            }

            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else if (body.object === 'ad_account') {
            // Handle Ad Account webhooks
            console.log('[Webhook] Processing ad_account event');
            
            for (const entry of body.entry) {
                await handleAdAccountEvent(entry);
            }

            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else {
            return new NextResponse('Not Found', { status: 404 });
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

async function handleMessage(pageId: string, event: any) {
    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const message = event.message;
    const timestamp = event.timestamp;

    // Check for referral data (when customer comes from an ad)
    // Facebook sends referral in both event.referral and event.message.referral
    const referral = event.referral || (event.message && event.message.referral);
    let adId: string | null = null;
    let adName: string | null = null;

    if (referral) {
        // referral.ad_id - ID ของโฆษณา
        // referral.ref - custom ref ที่ตั้งไว้ (ถ้ามี)
        // referral.source - แหล่งที่มา เช่น ADS
        // referral.type - ประเภท เช่น OPEN_THREAD
        adId = referral.ad_id || null;
        console.log(`[Webhook] Message from Ad! Ad ID: ${adId}, Source: ${referral.source}, Ref: ${referral.ref}`);

        // ถ้าต้องการดึงชื่อโฆษณา สามารถเรียก Marketing API ได้
        // แต่ต้องมี ads_read permission - ตอนนี้เก็บแค่ ad_id ก่อน
    }

    // Determine if the message is FROM the page (echo) or TO the page
    const isFromPage = senderId === pageId;
    const otherUserId = isFromPage ? recipientId : senderId;

    // Extract attachments (stickers, images, likes, etc.)
    let attachmentsJson: string | null = null;
    let stickerUrl: string | null = null;
    let messageContent = message.text || null;

    if (message.attachments && message.attachments.length > 0) {
        const attachments = message.attachments.map((att: any) => ({
            type: att.type, // 'image', 'sticker', 'video', 'audio', 'file', 'like' etc
            url: att.payload?.url || null,
            sticker_id: att.payload?.sticker_id || null
        }));
        attachmentsJson = JSON.stringify(attachments);

        // Get first sticker URL for quick access
        const sticker = attachments.find((a: any) => a.type === 'sticker');
        if (sticker) {
            stickerUrl = sticker.url;
        }

        // If no text but has attachments, set a placeholder
        if (!messageContent) {
            const firstAtt = attachments[0];
            if (firstAtt.type === 'sticker') {
                messageContent = '[Sticker]';
            } else if (firstAtt.type === 'image') {
                messageContent = '[รูปภาพ]';
            } else if (firstAtt.type === 'video') {
                messageContent = '[วิดีโอ]';
            } else if (firstAtt.type === 'audio') {
                messageContent = '[เสียง]';
            } else if (firstAtt.type === 'file') {
                messageContent = '[ไฟล์]';
            } else if (firstAtt.type === 'like' || firstAtt.type === 'fallback') {
                messageContent = '👍';
            } else {
                messageContent = `[${firstAtt.type}]`;
            }
        }

        console.log(`[Webhook] Attachments found:`, attachments);
    }

    // Get sender name - check cache first, then DB, then API
    let senderName = isFromPage ? 'Page' : 'User';
    let participantName = 'Facebook User';

    if (!isFromPage) {
        // 1. Check memory cache first
        const cachedName = userNameCache.get(senderId);
        // INVALIDATE CACHE if it contains "ลูกค้า"
        if (cachedName && (cachedName.name === 'ลูกค้า' || cachedName.name === 'Customer')) {
            userNameCache.delete(senderId);
        } else if (cachedName && cachedName.expires > Date.now()) {
            senderName = cachedName.name;
            participantName = cachedName.name;
            console.log(`[Webhook] Using cached name: ${senderName}`);
        } else {
            // 2. Check if we already have this user's name in DB (using dual DB)
            const existingConv = await db.findConversationByPageAndParticipant(pageId, senderId);

            console.log(`[Webhook] DB lookup for participantId ${senderId}:`, existingConv);

            // Treat 'ลูกค้า' as a legacy/invalid name that should be overwritten
            // ALSO: If existing name is 'Facebook User', we should try to get a better name if possible
            const isLegacyName = !existingConv?.participantName ||
                existingConv.participantName === 'ลูกค้า' ||
                existingConv.participantName === 'Customer';

            if (existingConv?.participantName && !isLegacyName && existingConv.participantName !== 'Facebook User') {
                senderName = existingConv.participantName;
                participantName = existingConv.participantName;
                // Cache it
                userNameCache.set(senderId, { name: senderName, expires: Date.now() + 86400000 }); // 24 hours
                console.log(`[Webhook] Using DB name: ${senderName}`);
            } else {
                // 3. Call API if we don't have a good name (or if we only have 'Facebook User' and want to retry)
                console.log(`[Webhook] Name needs update (Current: ${existingConv?.participantName}), calling API...`);

                try {
                    const pageToken = await getPageAccessToken(pageId);
                    console.log(`[Webhook] Got pageToken for ${pageId}: ${pageToken ? 'yes' : 'no'}`);

                    if (pageToken) {
                        const userResponse = await fetch(
                            `https://graph.facebook.com/v21.0/${senderId}?fields=name&access_token=${pageToken}`
                        );
                        const userData = await userResponse.json();
                        console.log(`[Webhook] User API response:`, userData);

                        if (userData.name) {
                            senderName = userData.name;
                            participantName = userData.name;
                            // Cache for 24 hours
                            userNameCache.set(senderId, { name: senderName, expires: Date.now() + 86400000 });
                            console.log(`[Webhook] Got sender name from API: ${senderName}`);
                        } else {
                            console.warn(`[Webhook] Facebook API error or no name:`, userData);
                            // If API fails and we have a DB name (even 'Facebook User'), stick with it
                            if (existingConv?.participantName && existingConv.participantName !== 'ลูกค้า') {
                                senderName = existingConv.participantName;
                                participantName = existingConv.participantName;
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[Webhook] Failed to fetch sender name:', err);
                }
            }
        }
    }

    // We need a conversation ID. 
    // Must use Facebook's real conversation ID to match with Graph API sync
    // Call Graph API to get the real conversation ID

    try {
        console.log(`[Webhook] DB Mode: ${getCurrentDBMode()}`);

        // First, try to find existing conversation by participantId and pageId
        let existingConversation = await db.findConversationByPageAndParticipant(pageId, otherUserId);

        let conversationId: string;

        if (existingConversation && existingConversation.id) {
            // Use existing conversation ID (which should be the real Facebook conversation ID)
            conversationId = existingConversation.id;
            console.log(`[Webhook] Found existing conversation ${conversationId} for user ${otherUserId}`);
        } else {
            // No existing conversation - use composite ID (save API calls!)
            // Real conversation ID จะถูก sync เมื่อ user กด manual sync
            conversationId = `${pageId}_${otherUserId}`;
            console.log(`[Webhook] New conversation, using composite ID: ${conversationId}`);
        }

        // Update participant name if we got it
        // Also update if the current name is 'ลูกค้า' (legacy)
        if (existingConversation && participantName !== 'Facebook User') {
            await db.updateConversation(conversationId, { participantName: participantName });
        }

        // Upsert conversation with dual DB support
        await db.upsertConversation(conversationId,
            // create data (ถ้าเป็น conversation ใหม่)
            {
                pageId: pageId,
                lastMessageAt: new Date(),
                snippet: messageContent,
                unreadCount: isFromPage ? 0 : 1, // ถ้าเราส่ง = 0, ถ้าลูกค้าส่ง = 1
                participantId: otherUserId,
                participantName: participantName,
                adId: adId
            },
            // update data (ถ้ามี conversation อยู่แล้ว - ไม่อัพเดท unreadCount ที่นี่)
            {
                lastMessageAt: new Date(),
                snippet: messageContent,
                ...(participantName !== 'Facebook User' && { participantName: participantName }),
                ...(adId && { adId: adId })
            }
        );

        // Increment unread count เฉพาะข้อความจากลูกค้า (ไม่ใช่จากเรา)
        if (!isFromPage) {
            await db.incrementUnreadCount(conversationId);

            // Distribute chat if rotation is enabled
            try {
                const { distributeChat } = await import('@/app/actions');
                await distributeChat(conversationId, pageId);
            } catch (err) {
                console.error('[Webhook] Failed to distribute chat:', err);
            }
        }

        // Create message with attachments support
        await db.createMessage({
            id: event.message.mid,
            conversationId: conversationId,
            senderId: senderId,
            senderName: senderName,
            content: messageContent,
            attachments: attachmentsJson,
            stickerUrl: stickerUrl,
            createdAt: new Date(),
            isFromPage: isFromPage
        });

        console.log(`[Webhook] Saved message from "${senderName}" to DB (${getCurrentDBMode()})`);

        // Emit real-time event to SSE subscribers
        messageEmitter.emit(pageId, {
            type: 'new_message',
            message: {
                id: event.message.mid,
                conversationId: conversationId,
                senderId: senderId,
                senderName: senderName,
                content: messageContent,
                attachments: attachmentsJson,
                stickerUrl: stickerUrl,
                createdAt: new Date().toISOString(),
                isFromPage: isFromPage
            },
            conversation: {
                id: conversationId,
                pageId: pageId,
                snippet: messageContent,
                participantId: otherUserId
            }
        });

        console.log(`Emitted SSE event for page ${pageId}`);

    } catch (error) {
        console.error("Error saving message to DB:", error);
    }
}

// Handle Ad Account Webhook Events
async function handleAdAccountEvent(entry: any) {
    const adAccountId = entry.id;
    const time = entry.time;
    const changes = entry.changes || [];

    console.log(`[Webhook] Ad Account ${adAccountId} changes:`, changes);

    for (const change of changes) {
        const field = change.field;
        const value = change.value;

        console.log(`[Webhook] Ad Account change - Field: ${field}, Value:`, value);

        // Handle different types of ad changes
        switch (field) {
            case 'ads':
                // Ad was created, updated, or deleted
                await handleAdChange(adAccountId, value);
                break;
            case 'campaigns':
                // Campaign was created, updated, or deleted
                await handleCampaignChange(adAccountId, value);
                break;
            case 'adsets':
                // Ad Set was created, updated, or deleted
                await handleAdSetChange(adAccountId, value);
                break;
            case 'ad_creative':
                // Ad creative was updated
                await handleCreativeChange(adAccountId, value);
                break;
            default:
                console.log(`[Webhook] Unhandled ad account field: ${field}`);
        }
    }
}

// Handle individual Ad changes
async function handleAdChange(adAccountId: string, value: any) {
    const { ad_id, ad_name, status, effective_status } = value;
    
    console.log(`[Webhook] Ad Change - ID: ${ad_id}, Name: ${ad_name}, Status: ${status}`);

    // Emit real-time update to all connected clients
    adsEmitter.emitToAdAccount(adAccountId, {
        type: 'ad_updated',
        timestamp: new Date().toISOString(),
        data: {
            adAccountId,
            adId: ad_id,
            adName: ad_name,
            status,
            effectiveStatus: effective_status,
        }
    });

    // Optionally update the database immediately
    // For now, we just notify the UI to trigger a refresh
}

// Handle Campaign changes
async function handleCampaignChange(adAccountId: string, value: any) {
    const { campaign_id, campaign_name, status, effective_status } = value;
    
    console.log(`[Webhook] Campaign Change - ID: ${campaign_id}, Name: ${campaign_name}, Status: ${status}`);

    adsEmitter.emitToAdAccount(adAccountId, {
        type: 'campaign_updated',
        timestamp: new Date().toISOString(),
        data: {
            adAccountId,
            campaignId: campaign_id,
            campaignName: campaign_name,
            status,
            effectiveStatus: effective_status,
        }
    });
}

// Handle Ad Set changes
async function handleAdSetChange(adAccountId: string, value: any) {
    const { adset_id, adset_name, status, effective_status } = value;
    
    console.log(`[Webhook] AdSet Change - ID: ${adset_id}, Name: ${adset_name}, Status: ${status}`);

    adsEmitter.emitToAdAccount(adAccountId, {
        type: 'adset_updated',
        timestamp: new Date().toISOString(),
        data: {
            adAccountId,
            adSetId: adset_id,
            adSetName: adset_name,
            status,
            effectiveStatus: effective_status,
        }
    });
}

// Handle Creative changes
async function handleCreativeChange(adAccountId: string, value: any) {
    console.log(`[Webhook] Creative Change:`, value);

    adsEmitter.emitToAdAccount(adAccountId, {
        type: 'creative_updated',
        timestamp: new Date().toISOString(),
        data: {
            adAccountId,
            ...value
        }
    });
}
