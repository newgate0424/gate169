import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { adsEmitter } from '@/lib/event-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    // @ts-ignore
    const userId = session.user.id;

    console.log(`[Ads SSE] New connection from user: ${userId}`);

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let isConnected = true;

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`));

            // Subscribe to ad updates for this user
            unsubscribe = adsEmitter.subscribe(userId, (data) => {
                if (isConnected) {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (err) {
                        console.error('[Ads SSE] Error sending data:', err);
                    }
                }
            });

            // Send keepalive every 30 seconds
            const keepalive = setInterval(() => {
                if (isConnected) {
                    try {
                        controller.enqueue(encoder.encode(`: keepalive\n\n`));
                    } catch (err) {
                        console.error('[Ads SSE] Keepalive error:', err);
                        clearInterval(keepalive);
                    }
                } else {
                    clearInterval(keepalive);
                }
            }, 30000);

            // Handle client disconnect
            request.signal.addEventListener('abort', () => {
                console.log(`[Ads SSE] Client disconnected: ${userId}`);
                isConnected = false;
                if (unsubscribe) unsubscribe();
                clearInterval(keepalive);
                controller.close();
            });
        },
        cancel() {
            console.log(`[Ads SSE] Stream cancelled for user: ${userId}`);
            isConnected = false;
            if (unsubscribe) unsubscribe();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // For Nginx
        },
    });
}
