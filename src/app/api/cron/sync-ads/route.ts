import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { 
    getAdAccounts, 
    getCampaigns, 
    getAdSets, 
    getAdsByAdSets,
    clearUserCache 
} from '@/lib/facebook';

// Background sync for all users with Facebook tokens
// This should be called by a cron job every 5-10 minutes
// Or by Vercel Cron, Railway cron, or external service like cron-job.org

const SYNC_INTERVAL_MINUTES = 5;
const MAX_CONCURRENT_USERS = 5; // Limit concurrent syncs to avoid rate limits

// POST - Trigger background sync for all users
// Can be called by: cron job, webhook, or manual trigger
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        // Verify cron secret (optional security)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        
        // Allow if no secret configured or if secret matches
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find all users with Facebook Ad tokens who need sync
        const usersToSync = await prisma.user.findMany({
            where: {
                facebookAdToken: { not: null },
            },
            select: {
                id: true,
                facebookAdToken: true,
                name: true,
            },
        });

        console.log(`[CronSync] Found ${usersToSync.length} users with Facebook tokens`);

        // Check which users need sync (last sync > SYNC_INTERVAL_MINUTES ago)
        const now = new Date();
        const usersNeedingSync: typeof usersToSync = [];

        for (const user of usersToSync) {
            const lastSync = await prisma.adSyncLog.findFirst({
                where: { 
                    userId: user.id, 
                    status: 'SUCCESS' 
                },
                orderBy: { completedAt: 'desc' },
            });

            if (!lastSync || !lastSync.completedAt) {
                usersNeedingSync.push(user);
            } else {
                const diffMinutes = (now.getTime() - lastSync.completedAt.getTime()) / (1000 * 60);
                if (diffMinutes >= SYNC_INTERVAL_MINUTES) {
                    usersNeedingSync.push(user);
                }
            }
        }

        console.log(`[CronSync] ${usersNeedingSync.length} users need sync`);

        if (usersNeedingSync.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No users need sync',
                usersChecked: usersToSync.length,
                usersSynced: 0,
                duration: Date.now() - startTime,
            });
        }

        // Process users in batches to avoid overwhelming Facebook API
        const results: { userId: string; success: boolean; adsCount?: number; error?: string }[] = [];
        
        for (let i = 0; i < usersNeedingSync.length; i += MAX_CONCURRENT_USERS) {
            const batch = usersNeedingSync.slice(i, i + MAX_CONCURRENT_USERS);
            
            const batchResults = await Promise.allSettled(
                batch.map(user => syncUserData(user.id, user.facebookAdToken!))
            );

            batchResults.forEach((result, index) => {
                const user = batch[index];
                if (result.status === 'fulfilled') {
                    results.push({ userId: user.id, success: true, adsCount: result.value });
                } else {
                    results.push({ userId: user.id, success: false, error: result.reason?.message });
                }
            });

            // Small delay between batches to be nice to Facebook API
            if (i + MAX_CONCURRENT_USERS < usersNeedingSync.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalAds = results.reduce((sum, r) => sum + (r.adsCount || 0), 0);

        console.log(`[CronSync] Completed: ${successCount}/${results.length} users, ${totalAds} ads`);

        return NextResponse.json({
            success: true,
            usersChecked: usersToSync.length,
            usersSynced: successCount,
            totalAds,
            duration: Date.now() - startTime,
            results,
        });

    } catch (error: any) {
        console.error('[CronSync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Sync failed' },
            { status: 500 }
        );
    }
}

// GET - Check sync status for all users
export async function GET(request: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            where: { facebookAdToken: { not: null } },
            select: { id: true, name: true },
        });

        const statuses = await Promise.all(
            users.map(async (user) => {
                const lastSync = await prisma.adSyncLog.findFirst({
                    where: { userId: user.id, status: 'SUCCESS' },
                    orderBy: { completedAt: 'desc' },
                });
                
                const accountCount = await prisma.adAccount.count({
                    where: { userId: user.id },
                });

                return {
                    userId: user.id,
                    userName: user.name,
                    lastSyncAt: lastSync?.completedAt,
                    accountCount,
                    needsSync: !lastSync?.completedAt || 
                        (new Date().getTime() - lastSync.completedAt.getTime()) / (1000 * 60) >= SYNC_INTERVAL_MINUTES,
                };
            })
        );

        return NextResponse.json({
            totalUsers: users.length,
            usersNeedingSync: statuses.filter(s => s.needsSync).length,
            statuses,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Sync data for a single user
async function syncUserData(userId: string, accessToken: string): Promise<number> {
    console.log(`[CronSync] Syncing user ${userId}...`);
    
    // Create sync log
    const syncLog = await prisma.adSyncLog.create({
        data: {
            userId,
            syncType: 'FULL',
            status: 'IN_PROGRESS',
        }
    });

    let totalAdsCount = 0;

    try {
        // Clear cache to get fresh data
        clearUserCache(userId);

        // Get all Ad Accounts
        const fbAccounts = await getAdAccounts(accessToken);

        for (const fbAccount of fbAccounts) {
            // Upsert Ad Account
            await prisma.adAccount.upsert({
                where: { id: fbAccount.id },
                create: {
                    id: fbAccount.id,
                    userId,
                    accountId: fbAccount.account_id,
                    name: fbAccount.name,
                    currency: fbAccount.currency || 'THB',
                    accountStatus: fbAccount.account_status || 1,
                    timezone: fbAccount.timezone_name || null,
                    timezoneOffset: fbAccount.timezone_offset_hours_utc || 0,
                },
                update: {
                    name: fbAccount.name,
                    currency: fbAccount.currency || 'THB',
                    accountStatus: fbAccount.account_status || 1,
                    timezone: fbAccount.timezone_name || null,
                    timezoneOffset: fbAccount.timezone_offset_hours_utc || 0,
                    lastSyncAt: new Date(),
                }
            });

            // Get Campaigns
            const campaigns = await getCampaigns(accessToken, fbAccount.id);
            const campaignIds: string[] = [];
            let accountTotalSpend = 0;
            let accountTotalImpressions = 0;
            let accountTotalReach = 0;
            let accountTotalClicks = 0;

            for (const campaign of campaigns) {
                campaignIds.push(campaign.id);
                accountTotalSpend += campaign.spend || 0;
                accountTotalImpressions += campaign.impressions || 0;
                accountTotalReach += campaign.reach || 0;
                accountTotalClicks += campaign.clicks || 0;

                await prisma.campaign.upsert({
                    where: { id: campaign.id },
                    create: {
                        id: campaign.id,
                        adAccountId: fbAccount.id,
                        name: campaign.name,
                        status: campaign.status || 'UNKNOWN',
                        effectiveStatus: campaign.effectiveStatus || 'UNKNOWN',
                        objective: campaign.objective || null,
                        dailyBudget: campaign.dailyBudget || null,
                        lifetimeBudget: campaign.lifetimeBudget || null,
                        budgetRemaining: campaign.budgetRemaining || null,
                        startTime: campaign.startTime ? new Date(campaign.startTime) : null,
                        stopTime: campaign.stopTime ? new Date(campaign.stopTime) : null,
                        impressions: campaign.impressions || 0,
                        reach: campaign.reach || 0,
                        spend: campaign.spend || 0,
                        clicks: campaign.clicks || 0,
                        results: campaign.results || 0,
                    },
                    update: {
                        name: campaign.name,
                        status: campaign.status || 'UNKNOWN',
                        effectiveStatus: campaign.effectiveStatus || 'UNKNOWN',
                        objective: campaign.objective || null,
                        dailyBudget: campaign.dailyBudget || null,
                        lifetimeBudget: campaign.lifetimeBudget || null,
                        budgetRemaining: campaign.budgetRemaining || null,
                        startTime: campaign.startTime ? new Date(campaign.startTime) : null,
                        stopTime: campaign.stopTime ? new Date(campaign.stopTime) : null,
                        impressions: campaign.impressions || 0,
                        reach: campaign.reach || 0,
                        spend: campaign.spend || 0,
                        clicks: campaign.clicks || 0,
                        results: campaign.results || 0,
                        updatedAt: new Date(),
                    }
                });
            }

            // Get AdSets
            if (campaignIds.length > 0) {
                const adSets = await getAdSets(accessToken, campaignIds);
                const adSetIds: string[] = [];

                for (const adSet of adSets) {
                    adSetIds.push(adSet.id);

                    await prisma.adSet.upsert({
                        where: { id: adSet.id },
                        create: {
                            id: adSet.id,
                            campaignId: adSet.campaignId,
                            adAccountId: fbAccount.id,
                            name: adSet.name,
                            status: adSet.status || 'UNKNOWN',
                            effectiveStatus: adSet.effectiveStatus || 'UNKNOWN',
                            dailyBudget: adSet.dailyBudget || null,
                            lifetimeBudget: adSet.lifetimeBudget || null,
                            budgetRemaining: adSet.budgetRemaining || null,
                            optimizationGoal: adSet.optimizationGoal || null,
                            billingEvent: adSet.billingEvent || null,
                            bidAmount: adSet.bidAmount || null,
                            impressions: adSet.impressions || 0,
                            reach: adSet.reach || 0,
                            spend: adSet.spend || 0,
                            clicks: adSet.clicks || 0,
                            results: adSet.results || 0,
                        },
                        update: {
                            name: adSet.name,
                            status: adSet.status || 'UNKNOWN',
                            effectiveStatus: adSet.effectiveStatus || 'UNKNOWN',
                            dailyBudget: adSet.dailyBudget || null,
                            lifetimeBudget: adSet.lifetimeBudget || null,
                            budgetRemaining: adSet.budgetRemaining || null,
                            optimizationGoal: adSet.optimizationGoal || null,
                            billingEvent: adSet.billingEvent || null,
                            bidAmount: adSet.bidAmount || null,
                            impressions: adSet.impressions || 0,
                            reach: adSet.reach || 0,
                            spend: adSet.spend || 0,
                            clicks: adSet.clicks || 0,
                            results: adSet.results || 0,
                            updatedAt: new Date(),
                        }
                    });
                }

                // Get Ads
                if (adSetIds.length > 0) {
                    const ads = await getAdsByAdSets(accessToken, adSetIds);
                    totalAdsCount += ads.length;

                    for (const ad of ads) {
                        await prisma.facebookAd.upsert({
                            where: { id: ad.id },
                            create: {
                                id: ad.id,
                                adSetId: ad.adSetId,
                                campaignId: ad.campaignId || '',
                                adAccountId: fbAccount.id,
                                name: ad.name,
                                status: ad.status || 'UNKNOWN',
                                effectiveStatus: ad.effectiveStatus || 'UNKNOWN',
                                campaignName: '',
                                adSetName: '',
                                thumbnail: ad.thumbnailUrl || null,
                                pageId: ad.pageId || null,
                                pageName: ad.pageName || null,
                                budget: ad.budget?.toString() || null,
                                impressions: ad.impressions || 0,
                                reach: ad.reach || 0,
                                spend: ad.spend || 0,
                                clicks: ad.clicks || 0,
                                results: ad.results || 0,
                                postEngagements: ad.postEngagements || 0,
                                videoPlays: ad.videoPlays || 0,
                                videoP25: ad.videoP25 || 0,
                                videoP50: ad.videoP50 || 0,
                                videoP75: ad.videoP75 || 0,
                                videoP95: ad.videoP95 || 0,
                                videoP100: ad.videoP100 || 0,
                                videoAvgTime: ad.videoAvgTime || 0,
                            },
                            update: {
                                name: ad.name,
                                status: ad.status || 'UNKNOWN',
                                effectiveStatus: ad.effectiveStatus || 'UNKNOWN',
                                campaignName: '',
                                adSetName: '',
                                thumbnail: ad.thumbnailUrl || null,
                                pageId: ad.pageId || null,
                                pageName: ad.pageName || null,
                                budget: ad.budget?.toString() || null,
                                impressions: ad.impressions || 0,
                                reach: ad.reach || 0,
                                spend: ad.spend || 0,
                                clicks: ad.clicks || 0,
                                results: ad.results || 0,
                                postEngagements: ad.postEngagements || 0,
                                videoPlays: ad.videoPlays || 0,
                                videoP25: ad.videoP25 || 0,
                                videoP50: ad.videoP50 || 0,
                                videoP75: ad.videoP75 || 0,
                                videoP95: ad.videoP95 || 0,
                                videoP100: ad.videoP100 || 0,
                                videoAvgTime: ad.videoAvgTime || 0,
                                updatedAt: new Date(),
                            }
                        });
                    }
                }
            }

            // Update account stats
            const adsInAccount = await prisma.facebookAd.count({
                where: { adAccountId: fbAccount.id }
            });
            const activeAds = await prisma.facebookAd.count({
                where: { adAccountId: fbAccount.id, effectiveStatus: 'ACTIVE' }
            });
            const pausedAds = await prisma.facebookAd.count({
                where: { adAccountId: fbAccount.id, effectiveStatus: 'PAUSED' }
            });

            await prisma.adAccount.update({
                where: { id: fbAccount.id },
                data: {
                    totalAds: adsInAccount,
                    activeAds,
                    pausedAds,
                    totalSpend: accountTotalSpend,
                    totalImpressions: accountTotalImpressions,
                    totalReach: accountTotalReach,
                    totalClicks: accountTotalClicks,
                }
            });
        }

        // Update sync log
        await prisma.adSyncLog.update({
            where: { id: syncLog.id },
            data: {
                status: 'SUCCESS',
                adsCount: totalAdsCount,
                completedAt: new Date(),
            }
        });

        console.log(`[CronSync] User ${userId} synced: ${totalAdsCount} ads`);
        return totalAdsCount;

    } catch (error: any) {
        console.error(`[CronSync] User ${userId} failed:`, error);
        
        await prisma.adSyncLog.update({
            where: { id: syncLog.id },
            data: {
                status: 'FAILED',
                error: error.message,
                completedAt: new Date(),
            }
        });

        throw error;
    }
}
