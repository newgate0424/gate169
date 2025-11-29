import { NextRequest } from 'next/server';
import { messageEmitter } from '@/lib/event-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const pageIds = searchParams.get('pageIds')?.split(',').filter(Boolean) || [];

    if (pageIds.length === 0) {
        return new Response('Missing pageIds parameter', { status: 400 });
    }

    console.log(`[SSE] New connection for pages: ${pageIds.join(', ')}`);

    const encoder = new TextEncoder();
    let isOpen = true;
    let pingInterval: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const stream = new TransformStream({
        start(controller) {
            // Send initial connection message immediately
            const connectMsg = `data: ${JSON.stringify({ type: 'connected', pageIds })}\n\n`;
            controller.enqueue(encoder.encode(connectMsg));
            console.log(`[SSE] Sent connected event`);

            // Ping every 10 seconds
            pingInterval = setInterval(() => {
                if (!isOpen) return;
                try {
                    const ping = `data: ${JSON.stringify({ type: 'ping', t: Date.now() })}\n\n`;
                    controller.enqueue(encoder.encode(ping));
                } catch (err) {
                    console.error('[SSE] Ping error:', err);
                }
            }, 10000);

            // Subscribe to events
            unsubscribe = messageEmitter.subscribe(pageIds, (data) => {
                if (!isOpen) return;
                try {
                    console.log(`[SSE] Emitting to client:`, data.type);
                    const msg = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(msg));
                    console.log(`[SSE] Message sent to stream`);
                } catch (err) {
                    console.error('[SSE] Send error:', err);
                }
            });
        },
        flush() {
            console.log(`[SSE] Stream flushed`);
            isOpen = false;
            if (pingInterval) clearInterval(pingInterval);
            if (unsubscribe) unsubscribe();
        }
    });

    // Handle connection close
    req.signal.addEventListener('abort', () => {
        console.log(`[SSE] Request aborted`);
        isOpen = false;
        if (pingInterval) clearInterval(pingInterval);
        if (unsubscribe) unsubscribe();
    });

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        },
    });
}