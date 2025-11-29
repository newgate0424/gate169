import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// เปลี่ยนจาก polling Facebook API เป็นดึงจาก Database เท่านั้น
// Webhook จะเป็นคนบันทึกข้อความใหม่ลง DB แล้ว
// ลด API calls จาก 100+ ต่อวัน เหลือ 0!

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const pageIds = searchParams.get('pageIds')?.split(',').filter(Boolean) || [];
    const since = searchParams.get('since'); // ISO timestamp

    if (pageIds.length === 0) {
        return NextResponse.json({ newMessages: [], synced: false });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ newMessages: [], synced: false, reason: 'not_authenticated' });
        }

        // ดึงข้อความใหม่จาก Database (ที่ Webhook บันทึกไว้)
        const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Default: last 1 minute

        const newMessages = await db.findNewMessagesForPages(pageIds, sinceDate);

        // Get updated conversations (based on lastMessageAt - เวลาข้อความล่าสุด)
        const updatedConversations = await db.findUpdatedConversations(pageIds, sinceDate);

        return NextResponse.json({
            newMessages: newMessages.map((m: any) => ({
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                senderName: m.senderName,
                content: m.content,
                createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
                pageId: m.conversation?.pageId || m.pageId
            })),
            updatedConversations: updatedConversations.map((c: any) => ({
                id: c.id,
                pageId: c.pageId,
                snippet: c.snippet,
                unread_count: c.unreadCount,
                updated_time: c.lastMessageAt instanceof Date ? c.lastMessageAt.toISOString() : (c.lastMessageAt || new Date().toISOString()),
                adId: c.adId || null,
                facebookLink: c.facebookLink || null,
                participants: {
                    data: [{ id: c.participantId, name: c.participantName }]
                }
            })),
            synced: true,
            source: 'database' // ไม่ได้เรียก Facebook API!
        });
    } catch (error) {
        console.error('[sync-new] Error:', error);
        return NextResponse.json({ newMessages: [], synced: false, error: 'internal_error' });
    }
}
