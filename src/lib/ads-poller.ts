/**
 * Ads Polling System
 * - Poll Facebook Ads API ทุก X นาที
 * - เปรียบเทียบกับข้อมูลใน DB
 * - Notify ผ่าน SSE เมื่อข้อมูลเปลี่ยน
 */

import { db } from './db';
import { getAdAccounts, getCampaigns, getAdSets, getAdsByAdSets } from './facebook';
import { adsEmitter } from './event-emitter';

// Polling Configuration
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes default
let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// Track last poll time per user
const lastPollTime = new Map<string, number>();

// Change detection - compare old and new data
interface ChangeDetection {
    type: 'ad' | 'campaign' | 'adset' | 'account';
    action: 'created' | 'updated' | 'deleted' | 'status_changed';
    id: string;
    name: string;
    oldStatus?: string;
    newStatus?: string;
    changes?: Record<string, { old: any; new: any }>;
}

// Detect changes between old and new ad data
function detectAdChanges(oldAds: any[], newAds: any[]): ChangeDetection[] {
    const changes: ChangeDetection[] = [];
    const oldAdsMap = new Map(oldAds.map(ad => [ad.id, ad]));
    const newAdsMap = new Map(newAds.map(ad => [ad.id, ad]));

    // Check for new or updated ads
    for (const [id, newAd] of newAdsMap) {
        const oldAd = oldAdsMap.get(id);
        
        if (!oldAd) {
            // New ad created
            changes.push({
                type: 'ad',
                action: 'created',
                id: newAd.id,
                name: newAd.name,
                newStatus: newAd.effectiveStatus || newAd.status,
            });
        } else {
            // Check for status changes
            const oldStatus = oldAd.effectiveStatus || oldAd.status;
            const newStatus = newAd.effectiveStatus || newAd.status;
            
            if (oldStatus !== newStatus) {
                changes.push({
                    type: 'ad',
                    action: 'status_changed',
                    id: newAd.id,
                    name: newAd.name,
                    oldStatus,
                    newStatus,
                });
            }
            
            // Check for other significant changes
            const significantFields = ['spend', 'impressions', 'reach', 'clicks', 'results'];
            const fieldChanges: Record<string, { old: any; new: any }> = {};
            
            for (const field of significantFields) {
                if (oldAd[field] !== newAd[field]) {
                    fieldChanges[field] = { old: oldAd[field], new: newAd[field] };
                }
            }
            
            if (Object.keys(fieldChanges).length > 0 && oldStatus === newStatus) {
                changes.push({
                    type: 'ad',
                    action: 'updated',
                    id: newAd.id,
                    name: newAd.name,
                    changes: fieldChanges,
                });
            }
        }
    }

    // Check for deleted ads
    for (const [id, oldAd] of oldAdsMap) {
        if (!newAdsMap.has(id)) {
            changes.push({
                type: 'ad',
                action: 'deleted',
                id: oldAd.id,
                name: oldAd.name,
                oldStatus: oldAd.effectiveStatus || oldAd.status,
            });
        }
    }

    return changes;
}

// Poll ads for a specific user
export async function pollUserAds(userId: string): Promise<ChangeDetection[]> {
    const allChanges: ChangeDetection[] = [];
    
    try {
        console.log(`[Poller] Starting poll for user: ${userId}`);
        
        // Get user's access token
        const user = await db.findUserWithToken(userId);
        if (!user?.facebookAdToken) {
            console.log(`[Poller] No Facebook token for user: ${userId}`);
            return [];
        }

        const accessToken = user.facebookAdToken;

        // Get ad accounts
        const accounts = await getAdAccounts(accessToken);
        console.log(`[Poller] Found ${accounts.length} ad accounts`);

        for (const account of accounts) {
            try {
                // Get existing ads from DB for this account
                const existingAds = await db.getAdsByAdAccount(account.id);
                
                // Get fresh campaigns
                const campaigns = await getCampaigns(accessToken, account.id);
                if (campaigns.length === 0) continue;

                const campaignIds = campaigns.map((c: any) => c.id);
                
                // Get fresh ad sets
                const adSets = await getAdSets(accessToken, campaignIds);
                if (adSets.length === 0) continue;

                const adSetIds = adSets.map((as: any) => as.id);
                
                // Get fresh ads
                const freshAds = await getAdsByAdSets(accessToken, adSetIds);
                
                // Detect changes
                const changes = detectAdChanges(existingAds, freshAds);
                
                if (changes.length > 0) {
                    console.log(`[Poller] Detected ${changes.length} changes for account ${account.name}`);
                    allChanges.push(...changes);
                    
                    // Update database with new ads data
                    for (const ad of freshAds) {
                        await db.upsertFacebookAd({
                            id: ad.id,
                            adAccountId: account.id,
                            name: ad.name,
                            status: ad.status,
                            effectiveStatus: ad.effectiveStatus,
                            campaignId: ad.campaignId,
                            adSetId: ad.adSetId,
                            impressions: ad.impressions || 0,
                            reach: ad.reach || 0,
                            spend: ad.spend || 0,
                            clicks: ad.clicks || 0,
                            results: ad.results || 0,
                        });
                    }
                    
                    // Notify via SSE
                    for (const change of changes) {
                        adsEmitter.emit(userId, {
                            type: `${change.type}_${change.action}`,
                            timestamp: new Date().toISOString(),
                            data: {
                                adAccountId: account.id,
                                adAccountName: account.name,
                                ...change,
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`[Poller] Error polling account ${account.id}:`, error);
            }
        }

        // Update last poll time
        lastPollTime.set(userId, Date.now());
        
        return allChanges;
    } catch (error) {
        console.error(`[Poller] Error polling for user ${userId}:`, error);
        return [];
    }
}

// Poll all active users
export async function pollAllUsers(): Promise<void> {
    if (isPolling) {
        console.log('[Poller] Already polling, skipping...');
        return;
    }

    isPolling = true;
    console.log('[Poller] Starting poll for all users...');

    try {
        // Get all users with Facebook Ad tokens
        const users = await db.findUsersWithFacebookToken();
        
        for (const user of users) {
            if (user.facebookAdToken) {
                // Check if enough time has passed since last poll
                const lastPoll = lastPollTime.get(user.id) || 0;
                const timeSinceLastPoll = Date.now() - lastPoll;
                
                if (timeSinceLastPoll >= POLL_INTERVAL_MS - 10000) { // 10 second buffer
                    await pollUserAds(user.id);
                    
                    // Small delay between users to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
    } catch (error) {
        console.error('[Poller] Error in pollAllUsers:', error);
    } finally {
        isPolling = false;
    }
}

// Start the polling system
export function startPolling(intervalMs: number = POLL_INTERVAL_MS): void {
    if (pollingInterval) {
        console.log('[Poller] Polling already started');
        return;
    }

    console.log(`[Poller] Starting polling system (interval: ${intervalMs / 1000}s)`);
    
    // Initial poll after 30 seconds (give server time to start)
    setTimeout(() => {
        pollAllUsers();
    }, 30000);

    // Set up recurring poll
    pollingInterval = setInterval(() => {
        pollAllUsers();
    }, intervalMs);
}

// Stop the polling system
export function stopPolling(): void {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('[Poller] Polling stopped');
    }
}

// Manual trigger for a specific user (useful for "Sync Now" button)
export async function triggerPollForUser(userId: string): Promise<ChangeDetection[]> {
    console.log(`[Poller] Manual poll triggered for user: ${userId}`);
    return await pollUserAds(userId);
}

// Get polling status
export function getPollingStatus(): { isRunning: boolean; interval: number; lastPolls: Record<string, number> } {
    return {
        isRunning: pollingInterval !== null,
        interval: POLL_INTERVAL_MS,
        lastPolls: Object.fromEntries(lastPollTime),
    };
}
