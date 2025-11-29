'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { getAdAccounts, getAdInsights, updateAdStatus, getPages, getPageConversations } from '@/lib/facebook';

const prisma = new PrismaClient();

export async function saveFacebookToken(token: string) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;

    await prisma.user.update({
        where: { id: userId },
        data: { facebookAccessToken: token },
    });

    return { success: true };
}

export async function fetchAdAccounts(accessToken: string) {
    try {
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

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
                        const dbOps = [];

                        for (const conv of convs) {
                            let participantId: string | null = null;
                            let participantName = 'Customer';

                            if (conv.participants && conv.participants.data) {
                                const userParticipant = conv.participants.data.find((p: any) => p.id !== page.id);
                                if (userParticipant) {
                                    participantId = userParticipant.id;
                                    participantName = userParticipant.name;
                                }
                            }

                            // Push DB operation to array for parallel execution
                            dbOps.push(
                                prisma.conversation.upsert({
                                    where: { id: conv.id },
                                    update: {
                                        updatedAt: new Date(conv.updated_time),
                                        snippet: conv.snippet,
                                        unreadCount: conv.unread_count || 0,
                                        participantId: participantId,
                                        participantName: participantName
                                    },
                                    create: {
                                        id: conv.id,
                                        pageId: page.id,
                                        updatedAt: new Date(conv.updated_time),
                                        snippet: conv.snippet,
                                        unreadCount: conv.unread_count || 0,
                                        participantId: participantId,
                                        participantName: participantName
                                    }
                                }).catch(dbErr => {
                                    console.error(`Failed to save conversation ${conv.id}`, dbErr);
                                })
                            );

                            mappedConvs.push({
                                ...conv,
                                pageId: page.id,
                                participants: {
                                    data: [{ name: participantName, id: participantId || conv.id }]
                                }
                            });
                        }

                        // Execute all DB upserts for this page in parallel
                        await Promise.all(dbOps);

                        return mappedConvs;
                    } catch (e) {
                        console.error(`Failed to fetch for page ${page.id}`, e);
                        return [];
                    }
                })
            );

            allConversations.push(...chunkResults.flat());
            // Removed artificial delay
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        const { getConversationMessages } = require('@/lib/facebook');
        const messages = await getConversationMessages(accessToken, conversationId, pageId, pageAccessToken);

        // Save to DB in parallel
        try {
            const dbOps = messages.map((msg: any) =>
                prisma.message.upsert({
                    where: { id: msg.id },
                    update: {
                        content: msg.message,
                        isFromPage: msg.from?.id === pageId
                    },
                    create: {
                        id: msg.id,
                        conversationId: conversationId,
                        senderId: msg.from?.id || 'unknown',
                        senderName: msg.from?.name || 'Unknown',
                        content: msg.message,
                        createdAt: new Date(msg.created_time),
                        isFromPage: msg.from?.id === pageId
                    }
                })
            );
            await Promise.all(dbOps);
        } catch (dbErr) {
            console.error("Failed to save messages to DB", dbErr);
        }

        return JSON.parse(JSON.stringify(messages));
    } catch (error: any) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

export async function sendReply(pageId: string, recipientId: string, messageText: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        throw new Error("Not authenticated");
    }

    // @ts-ignore
    const userId = session.user.id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        throw new Error("No Facebook access token found");
    }

    try {
        const { sendMessage } = require('@/lib/facebook');
        const result = await sendMessage(accessToken, pageId, recipientId, messageText);

        // Save own reply to DB immediately
        try {
            await prisma.message.create({
                data: {
                    id: result.message_id || `temp-${Date.now()}`,
                    conversationId: recipientId, // Using recipientId as conversationId per webhook logic
                    senderId: pageId,
                    senderName: 'Me',
                    content: messageText,
                    createdAt: new Date(),
                    isFromPage: true
                }
            });

            await prisma.conversation.update({
                where: { id: recipientId },
                data: {
                    updatedAt: new Date(),
                    snippet: messageText
                }
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        return [];
    }

    try {
        const { getPages } = require('@/lib/facebook');
        const userPages = await getPages(accessToken);
        const userPageIds = userPages.map((p: any) => p.id);
        const allowedPageIds = pageIds.filter(id => userPageIds.includes(id));

        if (allowedPageIds.length === 0) {
            return [];
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                pageId: { in: allowedPageIds }
            },
            orderBy: {
                updatedAt: 'desc'
            },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        return conversations.map(c => {
            let participantName = c.participantName || 'Customer';
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
                updated_time: c.updatedAt.toISOString(),
                snippet: c.snippet,
                unread_count: c.unreadCount,
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
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { facebookAccessToken: true }
    });

    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
        return [];
    }

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { pageId: true }
        });

        if (!conversation) return [];

        const { getPages } = require('@/lib/facebook');
        const userPages = await getPages(accessToken);
        const userPageIds = userPages.map((p: any) => p.id);

        if (!userPageIds.includes(conversation.pageId)) {
            console.error("User does not have access to this conversation's page");
            return [];
        }

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' }
        });

        return messages.map(m => ({
            id: m.id,
            message: m.content,
            created_time: m.createdAt.toISOString(),
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
