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

export async function fetchPages(accessToken: string) {
    try {
        console.log("Fetching pages with token:", accessToken.substring(0, 10) + "...");
        const pages = await getPages(accessToken);
        console.log("Fetched pages:", pages.length);
        return JSON.parse(JSON.stringify(pages));
    } catch (error: any) {
        console.error('Failed to fetch pages:', error);
        throw new Error(error.message || 'Failed to fetch pages');
    }
}

export async function fetchConversations(accessToken: string, pages: { id: string, access_token?: string }[]) {
    try {
        console.log(`Fetching conversations for ${pages.length} pages`);

        // We'll implement getPageConversations in facebook.ts next
        const { getPageConversations } = require('@/lib/facebook');

        // Batch processing to avoid rate limits
        const BATCH_SIZE = 5;
        const allConversations: any[] = [];

        for (let i = 0; i < pages.length; i += BATCH_SIZE) {
            const chunk = pages.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)}`);

            const chunkResults = await Promise.all(
                chunk.map(async (page) => {
                    try {
                        // Pass the token if available to save an API call
                        const convs = await getPageConversations(accessToken, page.id, page.access_token);
                        // Add pageId to each conversation to identify source
                        return convs.map((c: any) => ({ ...c, pageId: page.id }));
                    } catch (e) {
                        console.error(`Failed to fetch for page ${page.id}`, e);
                        return [];
                    }
                })
            );

            allConversations.push(...chunkResults.flat());

            // Add a small delay between batches to be nice to the API
            if (i + BATCH_SIZE < pages.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const flatConversations = allConversations.sort((a: any, b: any) => {
            return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime();
        });

        console.log(`Fetched total ${flatConversations.length} conversations`);
        return JSON.parse(JSON.stringify(flatConversations));
    } catch (error: any) {
        console.error('Failed to fetch conversations:', error);
        return []; // Return empty array on error for now
    }
}

export async function fetchMessages(accessToken: string, conversationId: string, pageId: string, pageAccessToken?: string) {
    try {
        const { getConversationMessages } = require('@/lib/facebook');
        const messages = await getConversationMessages(accessToken, conversationId, pageId, pageAccessToken);
        return JSON.parse(JSON.stringify(messages));
    } catch (error: any) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

export async function sendReply(accessToken: string, pageId: string, recipientId: string, messageText: string) {
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
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                pageId: { in: pageIds }
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

        // Map to match Facebook API structure roughly
        return conversations.map(c => ({
            id: c.id,
            pageId: c.pageId,
            updated_time: c.updatedAt.toISOString(),
            snippet: c.snippet,
            unread_count: c.unreadCount,
            participants: {
                data: [{ name: 'User', id: c.id }] // Placeholder as we don't store names yet
            }
        }));
    } catch (error) {
        console.error("Error fetching conversations from DB:", error);
        return [];
    }
}

export async function fetchMessagesFromDB(conversationId: string) {
    try {
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
