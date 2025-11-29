'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAdAccounts, getAdInsights, updateAdStatus, getPages, getPageConversations } from '@/lib/facebook';

export async function saveFacebookToken(shortLivedToken: string) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;

    // Exchange short-lived token (2 hours) for long-lived token (60 days)
    let longLivedToken = shortLivedToken;
    try {
        const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&` +
            `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
            `fb_exchange_token=${shortLivedToken}`;

        const response = await fetch(exchangeUrl);
        const data = await response.json();

        if (data.access_token) {
            longLivedToken = data.access_token;
            console.log('[Token Exchange] Successfully got long-lived token, expires in:', data.expires_in, 'seconds');
        } else {
            console.warn('[Token Exchange] Failed, using short-lived token:', data.error?.message);
        }
    } catch (err) {
        console.error('[Token Exchange] Error:', err);
    }

    // Save long-lived token using dual database
    await db.updateUser(userId, { facebookAccessToken: longLivedToken });

    // Auto-subscribe pages to webhook in background (don't wait)
    subscribeWebhooksInBackground(longLivedToken);

    return { success: true };
}

// Background function - doesn't block the main flow
async function subscribeWebhooksInBackground(token: string) {
    try {
        const pages = await getPages(token);
        console.log(`[Auto-Subscribe] Found ${pages.length} pages`);

        // Subscribe all pages in parallel for speed
        await Promise.allSettled(pages.map(async (page) => {
            if (page.access_token) {
                try {
                    const response = await fetch(
                        `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                subscribed_fields: 'messages,messaging_postbacks',
                                access_token: page.access_token
                            })
                        }
                    );
                    const result = await response.json();
                    console.log(`[Auto-Subscribe] Page ${page.name}: ${result.success ? 'OK' : 'Failed'}`);
                } catch (subErr) {
                    console.error(`[Auto-Subscribe] Failed for page ${page.id}:`, subErr);
                }
            }
        }));
    } catch (err) {
        console.error('[Auto-Subscribe] Error:', err);
    }
}

export async function fetchAdAccounts(accessToken: string) {
    try {
        const { getAdAccounts } = require('@/lib/facebook');
        const accounts = await getAdAccounts(accessToken);
        return JSON.parse(JSON.stringify(accounts));
    } catch (error: any) {
        console.error('Failed to fetch ad accounts:', error);
        throw new Error(error.message || 'Failed to fetch ad accounts');
    }
}

export async function fetchAdData(accessToken: string, adAccountId: string, dateRange?: { from: Date, to: Date }) {
    try {
        const data = await getAdInsights(accessToken, adAccountId, dateRange);
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        console.error('Error fetching ad data:', error);
        throw error;
    }
}

export async function updateAdStatusAction(accessToken: string, adId: string, status: 'ACTIVE' | 'PAUSED') {
    try {
        await updateAdStatus(accessToken, adId, status);
        return { success: true };
    } catch (error) {
        console.error('Failed to update ad status:', error);
        return { success: false, error: 'Failed to update ad status' };
    }
}

export async function fetchPages() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        console.log("Fetching pages with fresh token from DB...");
        const pages = await getPages(accessToken);
        console.log("Fetched pages:", pages.length);
        return JSON.parse(JSON.stringify(pages));
    } catch (error: any) {
        console.error('Failed to fetch pages:', error);
        throw new Error(error.message || 'Failed to fetch pages');
    }
}

export async function fetchConversations(pages: { id: string, access_token?: string }[]) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        console.log(`Fetching conversations for ${pages.length} pages`);

        const { getPageConversations } = require('@/lib/facebook');

        // Batch processing to avoid rate limits
        const BATCH_SIZE = 10; // Increased batch size
        const allConversations: any[] = [];

        for (let i = 0; i < pages.length; i += BATCH_SIZE) {
            const chunk = pages.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)}`);

            const chunkResults = await Promise.all(
                chunk.map(async (page) => {
                    try {
                        const convs = await getPageConversations(accessToken, page.id, page.access_token);
                        const mappedConvs = [];

                        for (const conv of convs) {
                            let participantId: string | null = null;
                            let participantName = 'Facebook User';

                            if (conv.participants && conv.participants.data) {
                                const userParticipant = conv.participants.data.find((p: any) => p.id !== page.id);
                                if (userParticipant) {
                                    participantId = userParticipant.id;
                                    participantName = userParticipant.name || 'Facebook User';
                                }
                            }

                            // Get existing to preserve lastReadAt and name
                            const existing = await db.findConversationById(conv.id);

                            // Preserve existing name if the new one is the fallback 'Facebook User'
                            // BUT if existing name is 'ลูกค้า' (legacy), we allow overwriting it with 'Facebook User' (or better)
                            if (participantName === 'Facebook User' && existing?.participantName && existing.participantName !== 'Facebook User' && existing.participantName !== 'ลูกค้า') {
                                participantName = existing.participantName;
                            }

                            // คำนวณ unreadCount ที่ถูกต้อง
                            let unreadCount = conv.unread_count || 0;
                            const lastMessageTime = new Date(conv.updated_time);

                            if (existing?.lastReadAt) {
                                const lastReadTime = new Date(existing.lastReadAt);
                                if (lastReadTime >= lastMessageTime) {
                                    unreadCount = 0;
                                }
                            }

                            // Use dual database upsert
                            await db.upsertConversation(conv.id,
                                // create
                                {
                                    pageId: page.id,
                                    lastMessageAt: new Date(conv.updated_time),
                                    snippet: conv.snippet,
                                    unreadCount: conv.unread_count || 0,
                                    participantId: participantId,
                                    participantName: participantName,
                                    facebookLink: conv.link || null
                                },
                                // update
                                {
                                    lastMessageAt: new Date(conv.updated_time),
                                    snippet: conv.snippet,
                                    unreadCount: unreadCount,
                                    participantId: participantId,
                                    participantName: participantName,
                                    facebookLink: conv.link || null
                                }
                            ).catch(dbErr => {
                                console.error(`Failed to save conversation ${conv.id}`, dbErr);
                            });

                            mappedConvs.push({
                                ...conv,
                                pageId: page.id,
                                facebookLink: conv.link || null,
                                participants: {
                                    data: [{
                                        name: participantName,
                                        id: participantId || conv.id,
                                        // Pass additional fields if available (from API)
                                        link: conv.participants?.data?.find((p: any) => p.id === participantId)?.link,
                                        username: conv.participants?.data?.find((p: any) => p.id === participantId)?.username
                                    }]
                                }
                            });
                        }

                        return mappedConvs;
                    } catch (e) {
                        console.error(`Failed to fetch for page ${page.id}`, e);
                        return [];
                    }
                })
            );

            allConversations.push(...chunkResults.flat());
        }

        const flatConversations = allConversations.sort((a: any, b: any) => {
            return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime();
        });

        console.log(`Fetched total ${flatConversations.length} conversations`);
        return JSON.parse(JSON.stringify(flatConversations));
    } catch (error: any) {
        console.error('Failed to fetch conversations:', error);
        return [];
    }
}

export async function fetchMessages(conversationId: string, pageId: string, pageAccessToken?: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        const { getConversationMessages } = require('@/lib/facebook');
        const messages = await getConversationMessages(accessToken, conversationId, pageId, pageAccessToken);

        // Save to DB using dual database
        try {
            for (const msg of messages) {
                await db.upsertMessage(msg.id,
                    // create
                    {
                        conversationId: conversationId,
                        senderId: msg.from?.id || 'unknown',
                        senderName: msg.from?.name || 'Unknown',
                        content: msg.message,
                        createdAt: new Date(msg.created_time),
                        isFromPage: msg.from?.id === pageId
                    },
                    // update
                    {
                        content: msg.message,
                        isFromPage: msg.from?.id === pageId
                    }
                );
            }
        } catch (dbErr) {
            console.error("Failed to save messages to DB", dbErr);
        }

        return JSON.parse(JSON.stringify(messages));
    } catch (error: any) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

export async function sendReply(pageId: string, recipientId: string, messageText: string, conversationId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        const { sendMessage } = require('@/lib/facebook');
        const result = await sendMessage(accessToken, pageId, recipientId, messageText);

        // Save own reply to DB immediately using dual database
        try {
            console.log(`[sendReply] Saving message to DB. ID: ${result.message_id}, ConvID: ${conversationId}`);
            await db.createMessage({
                id: result.message_id || `temp-${Date.now()}`,
                conversationId: conversationId, // Use the correct conversation ID
                senderId: pageId,
                senderName: 'Me',
                content: messageText,
                createdAt: new Date(),
                isFromPage: true
            });
            console.log(`[sendReply] Message saved to DB.`);

            await db.updateConversation(conversationId, { // Update the correct conversation
                lastMessageAt: new Date(),
                snippet: messageText
            });
        } catch (dbError) {
            console.error("Failed to save reply to DB:", dbError);
        }

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Failed to send message:', error);
        return { success: false, error: error.message };
    }
}

export async function fetchConversationsFromDB(pageIds: string[]) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        return [];
    }

    try {
        if (pageIds.length === 0) {
            return [];
        }

        const conversations = await db.findConversationsWithMessages(pageIds, 100);

        return conversations.map(c => {
            let participantName = c.participantName || 'Facebook User';
            let participantId = c.participantId; // NO FALLBACK to c.id

            if (!c.participantId && c.messages.length > 0) {
                const msg = c.messages[0];
                if (!msg.isFromPage && msg.senderName) {
                    participantName = msg.senderName;
                    participantId = msg.senderId;
                }
            }

            return {
                id: c.id,
                pageId: c.pageId,
                updated_time: c.lastMessageAt.toISOString(), // ใช้ lastMessageAt แทน updatedAt
                snippet: c.snippet,
                unread_count: c.unreadCount,
                adId: c.adId || null, // Ad ID ถ้าลูกค้าทักมาจากโฆษณา
                facebookLink: c.facebookLink || null, // Link เปิดไปหน้า Inbox บน Facebook
                participants: {
                    data: [{ name: participantName, id: participantId }] // Can be null
                }
            };
        });
    } catch (error) {
        console.error("Error fetching conversations from DB:", error);
        return [];
    }
}

export async function fetchMessagesFromDB(conversationId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        return [];
    }

    try {
        const conversation = await db.findConversationById(conversationId);

        if (!conversation) return [];

        // REMOVED: getPages() API call - trust that if conversation exists in DB, user has access
        // Conversations are only created when syncing from Facebook API

        const messages = await db.findMessagesByConversation(conversationId, 500);

        return messages.map((m: any) => ({
            id: m.id,
            message: m.content,
            attachments: m.attachments, // JSON string of attachments
            stickerUrl: m.stickerUrl,   // Direct sticker URL
            created_time: m.createdAt?.toISOString?.() || m.createdAt,
            from: {
                id: m.senderId,
                name: m.senderName
            }
        }));
    } catch (error) {
        console.error("Error fetching messages from DB:", error);
        return [];
    }
}

// Sync conversations from Graph API (use sparingly - only on manual refresh)
export async function syncConversationsOnce(pages: { id: string, access_token?: string }[]) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        console.log(`[SYNC] Syncing conversations for ${pages.length} pages from Graph API`);

        const { getPageConversations } = require('@/lib/facebook');

        const allConversations: any[] = [];

        for (const page of pages) {
            try {
                const convs = await getPageConversations(accessToken, page.id, page.access_token);

                // Get existing conversations from DB to preserve adId (using dual db)
                const existingConvs = await db.findConversationsByPageIds([page.id]);
                const existingMap = new Map(existingConvs.map((c: any) => [c.id, c]));

                for (const conv of convs) {
                    let participantId: string | null = null;
                    let participantName = 'Facebook User';

                    if (conv.participants && conv.participants.data) {
                        const userParticipant = conv.participants.data.find((p: any) => p.id !== page.id);
                        if (userParticipant) {
                            participantId = userParticipant.id;
                            participantName = userParticipant.name || 'Facebook User';
                            console.log(`[syncConversations] Participant: ${participantName} (${participantId})`);
                        }
                    }

                    // ENHANCED NAME FETCHING: If name is placeholder, try to fetch specific user profile
                    if (participantId && page.access_token && (participantName === 'Facebook User' || participantName === 'ลูกค้า' || participantName === 'Customer')) {
                        try {
                            // Only fetch if we have a valid token
                            console.log(`[SYNC] Name is placeholder (${participantName}), fetching real name for ${participantId}...`);
                            const userRes = await fetch(`https://graph.facebook.com/v18.0/${participantId}?fields=name&access_token=${page.access_token}`);
                            const userData = await userRes.json();

                            if (userData.name) {
                                participantName = userData.name;
                                console.log(`[SYNC] Resolved real name: ${participantName}`);
                            } else {
                                console.warn(`[SYNC] Failed to resolve name for ${participantId}:`, userData);
                            }
                        } catch (err) {
                            console.error(`[SYNC] Error fetching user name for ${participantId}`, err);
                        }
                    }

                    // Get existing data to preserve adId and local read status
                    const existing = existingMap.get(conv.id);

                    // Preserve existing name if the new one is the fallback 'Facebook User'
                    // BUT if existing name is 'ลูกค้า' (legacy), we allow overwriting it with 'Facebook User' (or better)
                    if (participantName === 'Facebook User' && existing?.participantName && existing.participantName !== 'Facebook User' && existing.participantName !== 'ลูกค้า') {
                        participantName = existing.participantName;
                    }

                    // คำนวณ unreadCount ที่ถูกต้อง:
                    // - ถ้ามี lastReadAt และ lastReadAt >= lastMessageAt → unread = 0
                    // - ถ้าไม่มี lastReadAt หรือ lastReadAt < lastMessageAt → ใช้ค่าจาก API
                    let unreadCount = conv.unread_count || 0;
                    const lastMessageTime = new Date(conv.updated_time);

                    if (existing?.lastReadAt) {
                        const lastReadTime = new Date(existing.lastReadAt);
                        // ถ้า user อ่านแล้ว (lastReadAt) หลังจากข้อความล่าสุด (lastMessageTime)
                        // ให้ unread = 0 ไม่ว่า Facebook จะบอกว่าเท่าไหร่ก็ตาม
                        // Add 5s buffer for clock skew / ghost updates
                        if (lastReadTime.getTime() >= lastMessageTime.getTime() - 5000) {
                            unreadCount = 0;
                        } else {
                            // SNIPPET COMPARISON:
                            // If Facebook says unread > 0, but we have a local read (unread=0),
                            // AND the snippet hasn't changed, it's likely a phantom update.
                            if (unreadCount > 0 && existing.unreadCount === 0 && existing.snippet === conv.snippet) {
                                // Double check time difference. If update is recent (< 2 mins) and snippet same, ignore unread
                                const timeDiff = lastMessageTime.getTime() - lastReadTime.getTime();
                                if (timeDiff < 120000) { // 2 minutes
                                    console.log(`[SYNC] Ignoring phantom unread for ${conv.id} (same snippet, recent read)`);
                                    unreadCount = 0;
                                }
                            }
                        }
                    }

                    // Get ad_id: prefer from API (conv.ad_id), fallback to existing DB value
                    const adId = conv.ad_id || existing?.adId || null;

                    if (conv.ad_id) {
                        console.log(`[syncConversations] Found ad_id for conversation ${conv.id}: ${conv.ad_id}`);
                    }

                    // Debug participant data
                    if (participantId) {
                        const pData = conv.participants?.data?.find((p: any) => p.id === participantId);
                        console.log(`[DEBUG] Participant ${participantName}: ID=${participantId}, Username=${pData?.username}, Link=${pData?.link}`);
                    }

                    // Use dual database upsert
                    await db.upsertConversation(conv.id,
                        // create
                        {
                            pageId: page.id,
                            lastMessageAt: new Date(conv.updated_time),
                            snippet: conv.snippet,
                            unreadCount: conv.unread_count || 0,
                            participantId: participantId,
                            participantName: participantName,
                            adId: conv.ad_id || null
                        },
                        // update
                        {
                            lastMessageAt: new Date(conv.updated_time),
                            snippet: conv.snippet,
                            unreadCount: unreadCount,
                            participantId: participantId,
                            participantName: participantName,
                            ...(conv.ad_id && { adId: conv.ad_id })
                        }
                    ).catch(dbErr => {
                        console.error(`Failed to save conversation ${conv.id}`, dbErr);
                    });

                    allConversations.push({
                        ...conv,
                        pageId: page.id,
                        adId: adId,
                        unread_count: unreadCount,
                        participants: {
                            data: [{
                                name: participantName,
                                id: participantId || conv.id,
                                link: conv.participants?.data?.find((p: any) => p.id === participantId)?.link,
                                username: conv.participants?.data?.find((p: any) => p.id === participantId)?.username
                            }]
                        }
                    });
                }
            } catch (e) {
                console.error(`Failed to sync for page ${page.id}`, e);
            }
        }

        const sortedConversations = allConversations.sort((a: any, b: any) => {
            return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime();
        });

        console.log(`[SYNC] Synced ${sortedConversations.length} conversations from API`);
        return JSON.parse(JSON.stringify(sortedConversations));
    } catch (error: any) {
        console.error('[SYNC] Failed to sync conversations:', error);
        return [];
    }
}

// Sync messages from Graph API (use sparingly - only on manual refresh)
export async function syncMessagesOnce(conversationId: string, pageId: string, pageAccessToken?: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await db.findUserWithToken(userId);

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        console.log(`[SYNC] Syncing messages for conversation ${conversationId} from Graph API`);

        const { getConversationMessages } = require('@/lib/facebook');
        const messages = await getConversationMessages(accessToken, conversationId, pageId, pageAccessToken);

        // Debug: Log first few messages to see structure
        if (messages.length > 0) {
            console.log('[DEBUG] Sample message from API:', JSON.stringify(messages[0], null, 2));
            const msgWithAtt = messages.find((m: any) => m.attachments || m.sticker);
            if (msgWithAtt) {
                console.log('[DEBUG] Message with attachment/sticker:', JSON.stringify(msgWithAtt, null, 2));
            }
        }

        // Save to DB with attachments support using dual database
        for (const msg of messages) {
            // Extract attachments from API response
            let attachmentsJson: string | null = null;
            let stickerUrl: string | null = null;
            let messageContent = msg.message || null;

            if (msg.attachments && msg.attachments.data && msg.attachments.data.length > 0) {
                const attachments = msg.attachments.data.map((att: any) => ({
                    type: att.type || att.mime_type?.split('/')[0] || 'file',
                    url: att.image_data?.url || att.file_url || att.video_data?.url || null,
                    sticker_id: att.sticker_id || null
                }));
                attachmentsJson = JSON.stringify(attachments);

                // Get first sticker URL
                const sticker = attachments.find((a: any) => a.type === 'sticker' || a.sticker_id);
                if (sticker) {
                    stickerUrl = sticker.url;
                }

                // Set placeholder if no text
                if (!messageContent) {
                    const firstAtt = attachments[0];
                    if (firstAtt.type === 'sticker') {
                        messageContent = '[Sticker]';
                    } else if (firstAtt.type === 'image') {
                        messageContent = '[รูปภาพ]';
                    } else if (firstAtt.type === 'video') {
                        messageContent = '[วิดีโอ]';
                    } else {
                        messageContent = `[${firstAtt.type}]`;
                    }
                }
            }

            // Check for sticker in different format
            if (msg.sticker) {
                stickerUrl = msg.sticker;
                if (!messageContent) messageContent = '[Sticker]';
                if (!attachmentsJson) {
                    attachmentsJson = JSON.stringify([{ type: 'sticker', url: msg.sticker }]);
                }
            }

            await db.upsertMessage(msg.id,
                // create
                {
                    conversationId: conversationId,
                    senderId: msg.from?.id || 'unknown',
                    senderName: msg.from?.name || 'Unknown',
                    content: messageContent,
                    attachments: attachmentsJson,
                    stickerUrl: stickerUrl,
                    createdAt: new Date(msg.created_time),
                    isFromPage: msg.from?.id === pageId
                },
                // update
                {
                    content: messageContent,
                    attachments: attachmentsJson,
                    stickerUrl: stickerUrl,
                    isFromPage: msg.from?.id === pageId
                }
            );
        }

        console.log(`[SYNC] Synced ${messages.length} messages from API`);

        // Return messages with attachments info
        return messages.map((msg: any) => {
            let attachmentsJson: string | null = null;
            let stickerUrl: string | null = null;

            if (msg.attachments?.data) {
                attachmentsJson = JSON.stringify(msg.attachments.data.map((att: any) => ({
                    type: att.type || 'file',
                    url: att.image_data?.url || att.file_url || null
                })));
            }
            if (msg.sticker) {
                stickerUrl = msg.sticker;
            }

            return {
                id: msg.id,
                message: msg.message,
                attachments: attachmentsJson,
                stickerUrl: stickerUrl,
                created_time: msg.created_time,
                from: msg.from
            };
        });
    } catch (error: any) {
        console.error('[SYNC] Failed to sync messages:', error);
        return [];
    }
}

export async function markConversationAsRead(conversationId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        await db.updateConversation(conversationId, {
            unreadCount: 0,
            lastReadAt: new Date()
        });

        // Also mark as seen on Facebook to stop it from reporting as unread
        // We do this in background (don't await) to keep UI snappy
        // @ts-ignore
        markSeenOnFacebook(conversationId, session.user.id).catch(console.error);

        return { success: true };
    } catch (error) {
        console.error("Failed to mark as read:", error);
        return { success: false };
    }
}

// Helper to mark conversation as seen on Facebook
async function markSeenOnFacebook(conversationId: string, userId: string) {
    try {
        const user = await db.findUserWithToken(userId);
        if (!user?.facebookAccessToken) return;

        // We need the page access token. Since we don't have pageId here easily,
        // we might need to look it up or just try with user token (which might not work for page convo).
        // Better approach: Look up conversation to get Page ID.
        const conv = await db.findConversationById(conversationId);
        if (!conv) return;

        const { initFacebookApi } = require('@/lib/facebook');
        const api = initFacebookApi(user.facebookAccessToken);

        // Get Page Token
        const page = await api.call('GET', [conv.pageId], {
            fields: 'access_token'
        });

        if (page.access_token) {
            // Send mark_seen action
            // POST /{recipient_id}/messages is for sending messages.
            // For marking as read, we usually send a sender_action to the participant.
            // But we need the participant ID.
            if (conv.participantId) {
                const pageApi = initFacebookApi(page.access_token);
                await pageApi.call('POST', ['me', 'messages'], {
                    recipient: { id: conv.participantId },
                    sender_action: 'mark_seen'
                });
                console.log(`[markSeen] Marked conversation ${conversationId} as seen on Facebook`);
            }
        }
    } catch (error) {
        console.error("[markSeen] Failed to mark as seen on FB:", error);
    }
}

export async function markConversationAsUnread(conversationId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        // Set unreadCount to 1 and lastReadAt to null (or old date)
        // Since Prisma/Mongo might handle null differently, let's just use unreadCount = 1
        // and maybe set lastReadAt to a very old date to ensure logic works
        await db.updateConversation(conversationId, {
            unreadCount: 1,
            lastReadAt: new Date(0) // 1970-01-01
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to mark as unread:", error);
        return { success: false };
    }
}

// ==========================================
// User Permissions Actions
// ==========================================

export async function getUsers() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        const users = await db.getAllUsers();
        return users;
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

export async function updateUserPermissions(userId: string, permissions: any) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        await db.updateUser(userId, {
            permissions: JSON.stringify(permissions)
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to update permissions:", error);
        return { success: false, error };
    }
}

export async function getPageRoles(pageId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        // @ts-ignore
        const userId = session.user.id;
        const user = await db.findUserWithToken(userId);
        if (!user?.facebookAccessToken) {
            throw new Error("No access token");
        }

        const { initFacebookApi } = require('@/lib/facebook');
        const api = initFacebookApi(user.facebookAccessToken);

        // 1. Get Page Access Token first (needed to fetch roles properly for some endpoints, 
        // though user token might work if they are admin)
        const pageReq = await api.call('GET', [pageId], {
            fields: 'access_token,name'
        });

        const pageAccessToken = pageReq.access_token;
        const pageName = pageReq.name;

        // 2. Fetch Roles
        // GET /page-id/roles
        // We use the Page Access Token to ensure we see all roles
        const pageApi = initFacebookApi(pageAccessToken);
        const rolesData = await pageApi.call('GET', [pageId, 'roles'], {});

        const mappedRoles = (rolesData.data || []).map((user: any) => {
            let role = user.role;

            // Handle New Page Experience (tasks based)
            if (!role && user.tasks) {
                const tasks = new Set(user.tasks);
                if (tasks.has('MANAGE')) {
                    role = 'ADMINISTER';
                } else if (tasks.has('CREATE_CONTENT')) {
                    role = 'EDITOR';
                } else if (tasks.has('MODERATE')) {
                    role = 'MODERATOR';
                } else if (tasks.has('ADVERTISE')) {
                    role = 'ADVERTISER';
                } else if (tasks.has('ANALYZE')) {
                    role = 'ANALYST';
                } else {
                    role = 'CUSTOM';
                }
            }

            return {
                ...user,
                role: role
            };
        });

        return {
            pageName,
            roles: mappedRoles
        };
    } catch (error) {
        return { pageName: 'Unknown', roles: [] };
    }
}

export async function getPageSettings(pageId: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        const settings = await db.pageSettings.findUnique({
            where: { pageId }
        });

        if (!settings) {
            // Return default if not found
            return {
                rotationMode: 'OFF',
                distributionMethod: 'EQUAL',
                keepAssignment: false,
                shuffleUsers: false,
                maxUsersPerChat: 1,
                activeRotationUserIds: [], // Default empty
                transferIfUnreadMinutes: null,
                transferIfOffline: false,
                unreadLimitPerUser: null,
                rotationSchedule: 'ALWAYS',
                nonSelectedCanViewAll: false,
                assignToNonSelected: null
            };
        }

        return {
            ...settings,
            activeRotationUserIds: settings.activeRotationUserIds ? JSON.parse(settings.activeRotationUserIds) : []
        };
    } catch (error) {
        console.error("Failed to fetch page settings:", error);
        return null;
    }
}

export async function updatePageSettings(pageId: string, settings: any) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    try {
        // Prepare data for DB
        const dbData = {
            ...settings,
            activeRotationUserIds: settings.activeRotationUserIds ? JSON.stringify(settings.activeRotationUserIds) : null
        };

        await db.pageSettings.upsert({
            where: { pageId },
            create: {
                pageId,
                ...dbData
            },
            update: {
                ...dbData
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to update page settings:", error);
        return { success: false, error };
    }
}

// New action to distribute chat (to be called when new message arrives)
export async function distributeChat(conversationId: string, pageId: string) {
    try {
        const settings = await db.pageSettings.findUnique({ where: { pageId } });
        if (!settings || settings.rotationMode === 'OFF') return;

        const activeUserIds = settings.activeRotationUserIds ? JSON.parse(settings.activeRotationUserIds) : [];
        if (activeUserIds.length === 0) return;

        // Simple Round Robin or Random for now
        // In real app, check current load of each user
        const randomUser = activeUserIds[Math.floor(Math.random() * activeUserIds.length)];

        await db.updateConversation(conversationId, {
            assigneeId: randomUser
        });

        console.log(`[Distribution] Assigned chat ${conversationId} to ${randomUser}`);
    } catch (error) {
        console.error("Failed to distribute chat:", error);
    }
}
