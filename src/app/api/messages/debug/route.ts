import { NextRequest, NextResponse } from 'next/server';
import { messageEmitter } from '@/lib/event-emitter';

export const dynamic = 'force-dynamic';

// Debug endpoint to check SSE status and test emit
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const testEmit = searchParams.get('testEmit') === 'true';

    // Get all subscribed page IDs
    const allPageIds = Array.from((messageEmitter as any).listeners.keys());

    const status = {
        totalListeners: (messageEmitter as any).getTotalListeners(),
        subscribedPageIds: allPageIds,
        pageListeners: pageId ? messageEmitter.getListenerCount(pageId) : null,
        timestamp: new Date().toISOString()
    };

    // Test emit if requested
    if (testEmit && pageId) {
        messageEmitter.emit(pageId, {
            type: 'new_message',
            message: {
                id: `test-${Date.now()}`,
                conversationId: 'test-conv',
                senderId: 'test-user',
                senderName: 'Test User',
                content: 'This is a test message from debug endpoint',
                createdAt: new Date().toISOString(),
                isFromPage: false
            },
            conversation: {
                id: 'test-conv',
                pageId: pageId,
                snippet: 'Test message'
            }
        });
        
        return NextResponse.json({ ...status, testEmitted: true, pageId });
    }

    return NextResponse.json(status);
}
