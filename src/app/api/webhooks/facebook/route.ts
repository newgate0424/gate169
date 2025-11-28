import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verify Token - Should match what you set in Facebook App Dashboard
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'my_secure_verify_token';

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
        const body = await req.json();

        if (body.object === 'page') {
            // Iterate over each entry - there may be multiple if batched
            for (const entry of body.entry) {
                const pageId = entry.id;
                const time = entry.time;

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

    // Determine if the message is FROM the page (echo) or TO the page
    // Usually, if senderId === pageId, it's an echo (we sent it)
    const isFromPage = senderId === pageId;

    // Conversation ID is not directly provided in webhook for standard messages,
    // but for Facebook Page messages, it's usually `t_<user_id>` or we can query it.
    // However, to keep it simple and consistent with Graph API, we might need to fetch the conversation ID
    // or generate a consistent one based on participants.
    // For now, let's assume we can use the User ID as a proxy for Conversation ID if it's a 1:1 chat with the page.
    // Ideally, we should fetch the real conversation ID from Graph API if we want to match `t_...` format.

    // For this implementation, let's try to find an existing conversation or create a placeholder.
    // Note: This is a simplified logic. In production, you might want to call Graph API to get the real Conversation ID.

    // Let's use a composite key logic or just the user ID for now.
    // If isFromPage is true, the other ID is recipient. If false, sender is the user.
    const otherUserId = isFromPage ? recipientId : senderId;

    // We need a conversation ID. 
    // Option A: Call Graph API to get conversation ID (Slow)
    // Option B: Use a deterministic ID (e.g., `pageId_userId`)
    // Let's go with Option B for speed, but we must ensure our UI can handle it.
    // BUT, our UI expects Graph API Conversation IDs (usually `t_...`).
    // So, we should probably upsert based on the participants.

    // Let's try to save the message first.

    try {
        // Upsert Conversation
        // Use a composite ID or just the user ID for simplicity in this context
        // Ideally we should fetch the real conversation ID from Graph API
        // For now, let's use the otherUserId as the conversation ID for 1:1 chats
        // This assumes 1 user = 1 conversation per page
        const conversationId = otherUserId;

        await prisma.conversation.upsert({
            where: { id: conversationId },
            update: {
                updatedAt: new Date(timestamp),
                snippet: message.text,
                unreadCount: { increment: 1 }
            },
            create: {
                id: conversationId,
                pageId: pageId,
                updatedAt: new Date(timestamp),
                snippet: message.text,
                unreadCount: 1
            }
        });

        await prisma.message.create({
            data: {
                id: event.message.mid,
                conversationId: conversationId,
                senderId: senderId,
                senderName: isFromPage ? 'Page' : 'User', // Simplified
                content: message.text,
                createdAt: new Date(timestamp),
                isFromPage: isFromPage
            }
        });

        console.log(`Saved message ${event.message.mid} to DB`);

    } catch (error) {
        console.error("Error saving message to DB:", error);
    }
}
