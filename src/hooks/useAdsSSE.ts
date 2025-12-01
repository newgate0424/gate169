'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

export type AdsEventType = 
    | 'connected' 
    | 'ad_updated' 
    | 'campaign_updated' 
    | 'adset_updated' 
    | 'creative_updated';

export interface AdsEvent {
    type: AdsEventType;
    timestamp?: string;
    data?: {
        adAccountId?: string;
        adId?: string;
        adName?: string;
        campaignId?: string;
        campaignName?: string;
        adSetId?: string;
        adSetName?: string;
        status?: string;
        effectiveStatus?: string;
    };
}

interface UseAdsSSEOptions {
    onAdUpdate?: (event: AdsEvent) => void;
    onCampaignUpdate?: (event: AdsEvent) => void;
    onAdSetUpdate?: (event: AdsEvent) => void;
    onCreativeUpdate?: (event: AdsEvent) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
}

// SSE is disabled by default to prevent reconnection loops
// Set SSE_ENABLED to true when you want real-time updates
const SSE_ENABLED = false;

export function useAdsSSE(options: UseAdsSSEOptions = {}) {
    const {
        onAdUpdate,
        onCampaignUpdate,
        onAdSetUpdate,
        onCreativeUpdate,
        onConnect,
        onDisconnect,
        onError,
        enabled = true
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<AdsEvent | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_BASE_DELAY = 5000; // 5 seconds base delay

    const connect = useCallback(() => {
        // Skip if SSE is disabled globally
        if (!SSE_ENABLED) {
            console.log('[Ads SSE] Disabled - using manual sync instead');
            return;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        console.log('[Ads SSE] Connecting...');
        const eventSource = new EventSource('/api/ads/sse');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('[Ads SSE] Connected');
            setIsConnected(true);
            reconnectAttempts.current = 0;
            onConnect?.();
        };

        eventSource.onmessage = (event) => {
            try {
                const data: AdsEvent = JSON.parse(event.data);
                console.log('[Ads SSE] Received:', data);
                setLastEvent(data);

                switch (data.type) {
                    case 'connected':
                        console.log('[Ads SSE] Connection confirmed');
                        break;
                    case 'ad_updated':
                        onAdUpdate?.(data);
                        break;
                    case 'campaign_updated':
                        onCampaignUpdate?.(data);
                        break;
                    case 'adset_updated':
                        onAdSetUpdate?.(data);
                        break;
                    case 'creative_updated':
                        onCreativeUpdate?.(data);
                        break;
                }
            } catch (err) {
                console.error('[Ads SSE] Failed to parse message:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[Ads SSE] Error:', err);
            setIsConnected(false);
            onDisconnect?.();

            // Attempt reconnection with exponential backoff
            if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current);
                console.log(`[Ads SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    reconnectAttempts.current++;
                    connect();
                }, delay);
            } else {
                console.error('[Ads SSE] Max reconnection attempts reached');
                onError?.(new Error('Max reconnection attempts reached'));
            }
        };
    }, [onAdUpdate, onCampaignUpdate, onAdSetUpdate, onCreativeUpdate, onConnect, onDisconnect, onError]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsConnected(false);
        console.log('[Ads SSE] Disconnected');
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        isConnected,
        lastEvent,
        reconnect: connect,
        disconnect
    };
}
