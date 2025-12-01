'use client';

import { useEffect, useRef } from 'react';

/**
 * PollingInitializer Component
 * 
 * This component starts the server-side polling when the app loads.
 * It calls the /api/ads/poll/start endpoint once on mount.
 */
export function PollingInitializer() {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Start polling on app load
        const initPolling = async () => {
            try {
                const response = await fetch('/api/ads/poll/start', {
                    method: 'POST',
                });
                if (response.ok) {
                    console.log('[Polling] Initialized successfully');
                }
            } catch (error) {
                console.error('[Polling] Failed to initialize:', error);
            }
        };

        // Delay start to avoid blocking initial render
        const timeout = setTimeout(initPolling, 5000);
        
        return () => clearTimeout(timeout);
    }, []);

    // This component doesn't render anything
    return null;
}
