import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
    getAdAccounts, 
    getCampaigns, 
    getAdSets, 
    getAdsByAdSets,
    clearUserCache 
} from '@/lib/facebook';

// POST - Sync Facebook data to database
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        
        // Get user's Facebook token
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { facebookAdToken: true }
        });

        if (!user?.facebookAdToken) {
            return NextResponse.json({ 
                error: 'Facebook Ad Token not found. Please connect your Facebook Ads account.' 
            }, { status: 400 });
        }

        const accessToken = user.facebookAdToken;
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId'); // Optional - sync specific account

        // Create sync log
        const syncLog = await prisma.adSyncLog.create({
            data: {
                userId,
                adAccountId: accountId,
                syncType: accountId ? 'INCREMENTAL' : 'FULL',
                status: 'IN_PROGRESS',
            }
        });

        let totalAdsCount = 0;
        let error: string | null = null;

        try {
            // Clear cache to get fresh data
            clearUserCache(userId);

            // Step 1: Get all Ad Accounts
            console.log('[Sync] Fetching ad accounts...');
            const fbAccounts = await getAdAccounts(accessToken);
            
            // Filter if specific account requested
            const accountsToSync = accountId 
                ? fbAccounts.filter((a: any) => a.id === accountId)
                : fbAccounts;

            console.log(`[Sync] Found ${accountsToSync.length} accounts to sync`);

            for (const fbAccount of accountsToSync) {
                console.log(`[Sync] Syncing account: ${fbAccount.name} (${fbAccount.id})`);
                
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

                // Step 2: Get Campaigns for this account
                console.log(`[Sync] Fetching campaigns for ${fbAccount.id}...`);
                const campaigns = await getCampaigns(accessToken, fbAccount.id);
                console.log(`[Sync] Found ${campaigns.length} campaigns`);

                const campaignIds: string[] = [];
                let accountTotalSpend = 0;
                let accountTotalImpressions = 0;
                let accountTotalReach = 0;
                let accountTotalClicks = 0;

                for (const campaign of campaigns) {
                    campaignIds.push(campaign.id);
                    
                    // Update campaign stats aggregates
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

                // Step 3: Get AdSets for all campaigns (batched)
                console.log(`[Sync] Fetching adsets for ${campaignIds.length} campaigns...`);
                const adSets = campaignIds.length > 0 ? await getAdSets(accessToken, campaignIds) : [];
                console.log(`[Sync] Found ${adSets.length} adsets`);

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
                            startTime: adSet.startTime ? new Date(adSet.startTime) : null,
                            endTime: adSet.endTime ? new Date(adSet.endTime) : null,
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
                            startTime: adSet.startTime ? new Date(adSet.startTime) : null,
                            endTime: adSet.endTime ? new Date(adSet.endTime) : null,
                            impressions: adSet.impressions || 0,
                            reach: adSet.reach || 0,
                            spend: adSet.spend || 0,
                            clicks: adSet.clicks || 0,
                            results: adSet.results || 0,
                            updatedAt: new Date(),
                        }
                    });
                }

                // Step 4: Get Ads for all adsets (batched)
                console.log(`[Sync] Fetching ads for ${adSetIds.length} adsets...`);
                const ads = adSetIds.length > 0 ? await getAdsByAdSets(accessToken, adSetIds) : [];
                console.log(`[Sync] Found ${ads.length} ads`);

                let accountActiveCount = 0;
                let accountPausedCount = 0;

                for (const ad of ads) {
                    await prisma.facebookAd.upsert({
                        where: { id: ad.id },
                        create: {
                            id: ad.id,
                            adAccountId: fbAccount.id,
                            adSetId: ad.adSetId || null,
                            campaignId: ad.campaignId || null,
                            campaignName: null, // Will be fetched separately if needed
                            adSetName: null,
                            name: ad.name,
                            status: ad.status || 'UNKNOWN',
                            effectiveStatus: ad.effectiveStatus || 'UNKNOWN',
                            thumbnail: ad.thumbnailUrl || null,
                            budget: ad.budget ? String(ad.budget) : null,
                            pageId: ad.pageId || null,
                            pageName: ad.pageName || null,
                            impressions: ad.impressions || 0,
                            reach: ad.reach || 0,
                            spend: ad.spend || 0,
                            clicks: ad.clicks || 0,
                            results: ad.results || 0,
                            postEngagements: ad.postEngagements || 0,
                            linkClicks: ad.clicks || 0,
                            videoPlays: ad.videoPlays || 0,
                            videoP25: ad.videoP25 || 0,
                            videoP50: ad.videoP50 || 0,
                            videoP75: ad.videoP75 || 0,
                            videoP95: ad.videoP95 || 0,
                            videoP100: ad.videoP100 || 0,
                            videoAvgTime: ad.videoAvgTime || 0,
                        },
                        update: {
                            adSetId: ad.adSetId || null,
                            campaignId: ad.campaignId || null,
                            name: ad.name,
                            status: ad.status || 'UNKNOWN',
                            effectiveStatus: ad.effectiveStatus || 'UNKNOWN',
                            thumbnail: ad.thumbnailUrl || null,
                            budget: ad.budget ? String(ad.budget) : null,
                            pageId: ad.pageId || null,
                            pageName: ad.pageName || null,
                            impressions: ad.impressions || 0,
                            reach: ad.reach || 0,
                            spend: ad.spend || 0,
                            clicks: ad.clicks || 0,
                            results: ad.results || 0,
                            postEngagements: ad.postEngagements || 0,
                            linkClicks: ad.clicks || 0,
                            videoPlays: ad.videoPlays || 0,
                            videoP25: ad.videoP25 || 0,
                            videoP50: ad.videoP50 || 0,
                            videoP75: ad.videoP75 || 0,
                            videoP95: ad.videoP95 || 0,
                            videoP100: ad.videoP100 || 0,
                            videoAvgTime: ad.videoAvgTime || 0,
                            lastSyncAt: new Date(),
                            updatedAt: new Date(),
                        }
                    });

                    // Count stats
                    if (ad.effectiveStatus === 'ACTIVE') accountActiveCount++;
                    if (ad.effectiveStatus === 'PAUSED') accountPausedCount++;
                    totalAdsCount++;
                }

                // Update account stats
                await prisma.adAccount.update({
                    where: { id: fbAccount.id },
                    data: {
                        totalAds: ads.length,
                        activeAds: accountActiveCount,
                        pausedAds: accountPausedCount,
                        totalSpend: accountTotalSpend,
                        totalImpressions: accountTotalImpressions,
                        totalReach: accountTotalReach,
                        totalClicks: accountTotalClicks,
                        lastSyncAt: new Date(),
                    }
                });

                console.log(`[Sync] Completed account ${fbAccount.name}: ${ads.length} ads, ${campaigns.length} campaigns, ${adSets.length} adsets`);
            }

        } catch (syncError: any) {
            console.error('[Sync] Error during sync:', syncError);
            error = syncError.message || 'Unknown error';
        }

        // Update sync log
        await prisma.adSyncLog.update({
            where: { id: syncLog.id },
            data: {
                status: error ? 'FAILED' : 'SUCCESS',
                adsCount: totalAdsCount,
                error,
                completedAt: new Date(),
            }
        });

        const duration = Date.now() - startTime;
        console.log(`[Sync] Completed in ${duration}ms. Total ads: ${totalAdsCount}`);

        return NextResponse.json({
            success: !error,
            adsCount: totalAdsCount,
            duration,
            error,
        });

    } catch (error: any) {
        console.error('[Sync API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync data' },
            { status: 500 }
        );
    }
}

// GET - Get sync status/history
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;

        const logs = await prisma.adSyncLog.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            take: 10,
        });

        // Get last successful sync
        const lastSuccess = logs.find(l => l.status === 'SUCCESS');
        
        // Check if sync is in progress
        const inProgress = logs.find(l => l.status === 'IN_PROGRESS');

        return NextResponse.json({
            lastSyncAt: lastSuccess?.completedAt || null,
            inProgress: !!inProgress,
            recentLogs: logs,
        });

    } catch (error: any) {
        console.error('[Sync Status API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get sync status' },
            { status: 500 }
        );
    }
}
