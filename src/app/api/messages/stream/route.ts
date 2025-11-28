import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const pageIds = searchParams.get('pageIds')?.split(',') || [];
    const lastCheck = searchParams.get('lastCheck');

    if (pageIds.length === 0) {
        return new Response(JSON.stringify({ messages: [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const since = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 30000); // Last 30 seconds by default

        // Get new messages since last check
        const newMessages = await prisma.message.findMany({
            where: {
                conversation: {
                    pageId: { in: pageIds }
                },
                createdAt: { gt: since },
                isFromPage: false // Only messages from users, not from page
            },
            include: {
                conversation: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // Get conversations with unread count
        const unreadConversations = await prisma.conversation.findMany({
            where: {
                pageId: { in: pageIds },
                unreadCount: { gt: 0 }
            },
            select: {
                id: true,
                unreadCount: true,
                snippet: true
            }
        });

        return new Response(JSON.stringify({ 
            messages: newMessages,
            unreadConversations,
            timestamp: new Date().toISOString()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching new messages:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
