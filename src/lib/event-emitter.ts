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

// Ads Event Emitter - สำหรับ broadcast ad updates แบบ real-time
class AdsEventEmitter {
    private listeners: Map<string, Set<Listener>> = new Map(); // userId -> listeners

    // Subscribe to ad updates for a user
    subscribe(userId: string, listener: Listener): () => void {
        if (!this.listeners.has(userId)) {
            this.listeners.set(userId, new Set());
        }
        this.listeners.get(userId)!.add(listener);

        console.log(`[Ads SSE] User ${userId} subscribed. Total listeners: ${this.getTotalListeners()}`);

        // Return unsubscribe function
        return () => {
            this.listeners.get(userId)?.delete(listener);
            console.log(`[Ads SSE] User ${userId} unsubscribed. Total listeners: ${this.getTotalListeners()}`);
        };
    }

    // Emit ad update to specific user
    emit(userId: string, data: any) {
        const userListeners = this.listeners.get(userId);
        console.log(`[Ads SSE] Emitting to user ${userId}. Listeners: ${userListeners?.size || 0}`);
        
        if (userListeners && userListeners.size > 0) {
            for (const listener of userListeners) {
                try {
                    listener(data);
                    console.log(`[Ads SSE] Event sent successfully to user ${userId}`);
                } catch (err) {
                    console.error('[Ads SSE] Error in listener:', err);
                }
            }
        }
    }

    // Emit to all connected users (for broadcast updates)
    broadcast(data: any) {
        console.log(`[Ads SSE] Broadcasting to all users. Total listeners: ${this.getTotalListeners()}`);
        for (const [userId, listeners] of this.listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (err) {
                    console.error(`[Ads SSE] Error broadcasting to user ${userId}:`, err);
                }
            }
        }
    }

    // Emit to users who have access to specific ad account
    emitToAdAccount(adAccountId: string, data: any) {
        // For now, broadcast to all - in production, filter by ad account access
        this.broadcast({ ...data, adAccountId });
    }

    getListenerCount(userId: string): number {
        return this.listeners.get(userId)?.size || 0;
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
    adsEmitter: AdsEventEmitter | undefined;
};

export const messageEmitter = globalForEmitter.messageEmitter ?? new MessageEventEmitter();
export const adsEmitter = globalForEmitter.adsEmitter ?? new AdsEventEmitter();

if (process.env.NODE_ENV !== 'production') {
    globalForEmitter.messageEmitter = messageEmitter;
    globalForEmitter.adsEmitter = adsEmitter;
}
