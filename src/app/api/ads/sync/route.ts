import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAdAccounts, getAdInsights, clearUserCache } from '@/lib/facebook';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        const user = await db.findUserWithToken(userId);
        const accessToken = user?.facebookAdToken;

        if (!accessToken) {
            return NextResponse.json({ error: 'No Facebook token' }, { status: 400 });
        }

        // Get date range from request
        const body = await request.json().catch(() => ({}));
        const dateRange = body.dateRange;
        const forceRefresh = body.forceRefresh ?? true; // Default to force refresh for sync
        
        // Clear cache if force refresh
        if (forceRefresh) {
            console.log('[Ad Sync] Clearing cache before sync...');
            clearUserCache(accessToken);
        }

        // Create sync log
        const syncLog = await db.createSyncLog({
            userId,
            syncType: 'FULL'
        });

        try {
            // Fetch ad accounts from Facebook
            console.log('[Ad Sync] Fetching ad accounts...');
            const accounts = await getAdAccounts(accessToken);
            console.log(`[Ad Sync] Found ${accounts.length} ad accounts`);

            let totalAds = 0;

            // Process each account
            for (const account of accounts) {
                // Save/update ad account
                await db.upsertAdAccount({
                    id: account.id,
                    userId,
                    accountId: account.account_id,
                    name: account.name,
                    currency: account.currency,
                    accountStatus: account.account_status
                });

                // Fetch ads with insights
                console.log(`[Ad Sync] Fetching ads for ${account.name}...`);
                
                try {
                    const range = dateRange?.from && dateRange?.to 
                        ? { from: new Date(dateRange.from), to: new Date(dateRange.to) }
                        : undefined;

                    const adsData = await getAdInsights(accessToken, account.id, range);
                    
                    if (adsData && adsData.length > 0) {
                        // Transform and save ads
                        const adsToSave = adsData.map((ad: any) => ({
                            id: ad.id,
                            adAccountId: account.id,
                            name: ad.name,
                            status: ad.status,
                            effectiveStatus: ad.effectiveStatus || ad.delivery,
                            campaignName: ad.campaignName,
                            adSetName: ad.adSetName,
                            thumbnail: ad.thumbnail,
                            budget: ad.budget?.toString(),
                            pageId: ad.pageId,
                            pageName: ad.pageName,
                            pageUsername: ad.pageUsername,
                            impressions: ad.impressions || 0,
                            reach: ad.reach || 0,
                            spend: ad.spend || 0,
                            clicks: ad.link_clicks || 0,
                            results: ad.results || 0,
                            roas: ad.roas || 0,
                            cpm: ad.cpm || 0,
                            videoPlays: ad.video_plays || 0,
                            videoP25: ad.video_p25 || 0,
                            videoP50: ad.video_p50 || 0,
                            videoP75: ad.video_p75 || 0,
                            videoP95: ad.video_p95 || 0,
                            videoP100: ad.video_p100 || 0,
                            videoAvgTime: ad.video_avg_time || 0,
                            postEngagements: ad.post_engagements || 0,
                            linkClicks: ad.link_clicks || 0
                        }));

                        await db.upsertManyFacebookAds(adsToSave);
                        
                        // Clean up deleted ads
                        const activeAdIds = adsToSave.map((a: { id: string }) => a.id);
                        await db.deleteAdsNotInList(account.id, activeAdIds);
                        
                        totalAds += adsToSave.length;
                        console.log(`[Ad Sync] Saved ${adsToSave.length} ads for ${account.name}`);
                    }
                } catch (adError) {
                    console.error(`[Ad Sync] Error fetching ads for ${account.name}:`, adError);
                }
            }

            // Update sync log
            await db.updateSyncLog(syncLog.id, {
                status: 'SUCCESS',
                adsCount: totalAds
            });

            return NextResponse.json({
                success: true,
                accountsCount: accounts.length,
                adsCount: totalAds,
                syncedAt: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('[Ad Sync] Error:', error);
            await db.updateSyncLog(syncLog.id, {
                status: 'FAILED',
                error: error.message
            });
            throw error;
        }

    } catch (error: any) {
        console.error('[Ad Sync] Failed:', error);
        return NextResponse.json(
            { error: error.message || 'Sync failed' },
            { status: 500 }
        );
    }
}

// GET - Fetch cached ads from database
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;

        // Get ads from database
        const ads = await db.getAdsByUser(userId);
        const lastSync = await db.getLastSyncTime(userId);

        return NextResponse.json({
            ads,
            lastSyncAt: lastSync?.toISOString() || null,
            count: ads.length
        });

    } catch (error: any) {
        console.error('[Ad Fetch] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch ads' },
            { status: 500 }
        );
    }
}
