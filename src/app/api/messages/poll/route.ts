import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// Store last message ID per page to track new messages
const lastSeenMessageIds = new Map<string, Set<string>>();

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const pageIds = searchParams.get('pageIds')?.split(',').filter(Boolean) || [];
    const excludeIds = searchParams.get('excludeIds')?.split(',').filter(Boolean) || [];

    if (pageIds.length === 0) {
        return NextResponse.json({ messages: [], timestamp: new Date().toISOString() });
    }

    try {
        // Get latest 10 messages, then filter out already seen ones
        const newMessages = await prisma.message.findMany({
            where: {
                conversation: {
                    pageId: { in: pageIds }
                },
                isFromPage: false,
                // Exclude already seen message IDs
                ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {})
            },
            include: {
                conversation: {
                    select: {
                        id: true,
                        pageId: true,
                        participantName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        const messages = newMessages.map(m => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: m.senderName || m.conversation.participantName || 'User',
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            isFromPage: m.isFromPage,
            pageId: m.conversation.pageId
        }));

        return NextResponse.json({
            messages,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Poll] Error:', error);
        return NextResponse.json({ 
            messages: [], 
            timestamp: new Date().toISOString(),
            error: 'Failed to fetch messages' 
        });
    }
}
