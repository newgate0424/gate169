import { useState, useCallback, useEffect, useRef } from 'react';

interface SyncStatus {
    lastSyncAt: Date | null;
    inProgress: boolean;
    recentLogs: any[];
}

interface UseCachedAdsOptions {
    autoSync?: boolean; // Auto sync when no data exists
    syncInterval?: number; // Auto sync interval in ms (default: 5 minutes)
}

export function useCachedAds(options: UseCachedAdsOptions = {}) {
    const { autoSync = true, syncInterval = 5 * 60 * 1000 } = options;
    
    const [accounts, setAccounts] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [adSets, setAdSets] = useState<any[]>([]);
    const [ads, setAds] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [lastLoadTime, setLastLoadTime] = useState<number>(0);
    
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch data from cache (database)
    const fetchFromCache = useCallback(async (type: 'accounts' | 'campaigns' | 'adsets' | 'ads', params?: Record<string, string>) => {
        try {
            const queryParams = new URLSearchParams({ type, ...params });
            const response = await fetch(`/api/ads/cached?${queryParams}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch cached data');
            }
            
            const result = await response.json();
            return result;
        } catch (err) {
            console.error('[useCachedAds] Fetch error:', err);
            throw err;
        }
    }, []);

    // Load accounts from cache
    const loadAccounts = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await fetchFromCache('accounts');
            setAccounts(result.data || []);
            setLastLoadTime(Date.now());
            
            // If no data and autoSync enabled, trigger sync
            if (autoSync && (!result.data || result.data.length === 0) && !result.lastSyncAt) {
                console.log('[useCachedAds] No cached data, triggering initial sync...');
                await syncFromFacebook();
            }
            
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [fetchFromCache, autoSync]);

    // Load campaigns for specific account
    const loadCampaigns = useCallback(async (accountId: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await fetchFromCache('campaigns', { accountId });
            setCampaigns(result.data || []);
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [fetchFromCache]);

    // Load ad sets for specific campaign
    const loadAdSets = useCallback(async (campaignId: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await fetchFromCache('adsets', { campaignId });
            setAdSets(result.data || []);
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [fetchFromCache]);

    // Load ads for specific ad set
    const loadAds = useCallback(async (adSetId: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await fetchFromCache('ads', { adSetId });
            setAds(result.data || []);
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [fetchFromCache]);

    // Sync data from Facebook to database
    const syncFromFacebook = useCallback(async (accountId?: string) => {
        setSyncing(true);
        setError(null);
        
        try {
            const url = accountId 
                ? `/api/ads/sync-to-db?accountId=${accountId}`
                : '/api/ads/sync-to-db';
            
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Sync failed');
            }
            
            console.log(`[useCachedAds] Sync completed: ${result.adsCount} ads in ${result.duration}ms`);
            
            // Reload accounts after sync
            await loadAccounts();
            
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setSyncing(false);
        }
    }, [loadAccounts]);

    // Check sync status
    const checkSyncStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/ads/sync-to-db');
            if (response.ok) {
                const status = await response.json();
                setSyncStatus({
                    lastSyncAt: status.lastSyncAt ? new Date(status.lastSyncAt) : null,
                    inProgress: status.inProgress,
                    recentLogs: status.recentLogs || [],
                });
                return status;
            }
        } catch (err) {
            console.error('[useCachedAds] Failed to check sync status:', err);
        }
        return null;
    }, []);

    // Setup auto-sync interval
    useEffect(() => {
        if (syncInterval > 0) {
            syncIntervalRef.current = setInterval(() => {
                console.log('[useCachedAds] Auto-sync triggered');
                syncFromFacebook().catch(console.error);
            }, syncInterval);

            return () => {
                if (syncIntervalRef.current) {
                    clearInterval(syncIntervalRef.current);
                }
            };
        }
    }, [syncInterval, syncFromFacebook]);

    // Initial load
    useEffect(() => {
        loadAccounts();
        checkSyncStatus();
    }, []);

    return {
        // Data
        accounts,
        campaigns,
        adSets,
        ads,
        
        // Status
        loading,
        syncing,
        error,
        syncStatus,
        lastLoadTime,
        
        // Actions
        loadAccounts,
        loadCampaigns,
        loadAdSets,
        loadAds,
        syncFromFacebook,
        checkSyncStatus,
        
        // Setters (for optimistic updates)
        setAccounts,
        setCampaigns,
        setAdSets,
        setAds,
    };
}
