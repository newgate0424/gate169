// Simple in-memory event emitter for SSE broadcasting
// In production, use Redis Pub/Sub for multi-instance support

type Listener = (data: any) => void;

class MessageEventEmitter {
    private listeners: Map<string, Set<Listener>> = new Map();

    // Subscribe to messages for specific page IDs
    subscribe(pageIds: string[], listener: Listener): () => void {
        for (const pageId of pageIds) {
            if (!this.listeners.has(pageId)) {
                this.listeners.set(pageId, new Set());
            }
            this.listeners.get(pageId)!.add(listener);
        }

        console.log(`[SSE] Subscribed to pages: ${pageIds.join(', ')}. Total listeners: ${this.getTotalListeners()}`);

        // Return unsubscribe function
        return () => {
            for (const pageId of pageIds) {
                this.listeners.get(pageId)?.delete(listener);
            }
            console.log(`[SSE] Unsubscribed. Total listeners: ${this.getTotalListeners()}`);
        };
    }

    // Emit new message event to all subscribers of a page
    emit(pageId: string, data: any) {
        const pageListeners = this.listeners.get(pageId);
        console.log(`[SSE] Emitting to page ${pageId}. Listeners: ${pageListeners?.size || 0}`);
        
        if (pageListeners && pageListeners.size > 0) {
            for (const listener of pageListeners) {
                try {
                    listener(data);
                    console.log(`[SSE] Event sent successfully`);
                } catch (err) {
                    console.error('[SSE] Error in listener:', err);
                }
            }
        } else {
            console.log(`[SSE] No listeners for page ${pageId}`);
        }
    }

    // Get count of active listeners
    getListenerCount(pageId: string): number {
        return this.listeners.get(pageId)?.size || 0;
    }

    getTotalListeners(): number {
        let total = 0;
        for (const listeners of this.listeners.values()) {
            total += listeners.size;
        }
        return total;
    }
}

// Global singleton that persists across hot reloads in development
const globalForEmitter = globalThis as unknown as {
    messageEmitter: MessageEventEmitter | undefined;
};

export const messageEmitter = globalForEmitter.messageEmitter ?? new MessageEventEmitter();

if (process.env.NODE_ENV !== 'production') {
    globalForEmitter.messageEmitter = messageEmitter;
}
