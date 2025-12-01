import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - Fetch cached ad data from database (FAST!)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'accounts'; // accounts, campaigns, adsets, ads
        const accountId = searchParams.get('accountId');
        const campaignId = searchParams.get('campaignId');
        const adSetId = searchParams.get('adSetId');

        let data: any = null;
        let lastSyncAt: Date | null = null;

        switch (type) {
            case 'accounts':
                // Get all ad accounts for user with stats
                const accounts = await prisma.adAccount.findMany({
                    where: { userId },
                    orderBy: { name: 'asc' },
                });
                
                // Get last sync time
                const lastSync = await prisma.adSyncLog.findFirst({
                    where: { userId, status: 'SUCCESS' },
                    orderBy: { completedAt: 'desc' },
                });
                lastSyncAt = lastSync?.completedAt || null;
                
                data = accounts.map(acc => ({
                    id: acc.id,
                    accountId: acc.accountId,
                    name: acc.name,
                    currency: acc.currency,
                    accountStatus: acc.accountStatus,
                    timezone: acc.timezone || 'Unknown',
                    timezoneOffset: acc.timezoneOffset,
                    totalAds: acc.totalAds,
                    activeAds: acc.activeAds,
                    pausedAds: acc.pausedAds,
                    totalSpend: acc.totalSpend,
                    totalImpressions: acc.totalImpressions,
                    totalReach: acc.totalReach,
                    totalClicks: acc.totalClicks,
                    lastSyncAt: acc.lastSyncAt,
                }));
                break;

            case 'campaigns':
                if (!accountId) {
                    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
                }
                const campaigns = await prisma.campaign.findMany({
                    where: { adAccountId: accountId },
                    orderBy: { name: 'asc' },
                });
                data = campaigns.map(c => ({
                    id: c.id,
                    adAccountId: c.adAccountId,
                    name: c.name,
                    status: c.status,
                    effectiveStatus: c.effectiveStatus,
                    objective: c.objective,
                    dailyBudget: c.dailyBudget,
                    lifetimeBudget: c.lifetimeBudget,
                    budgetRemaining: c.budgetRemaining,
                    startTime: c.startTime,
                    stopTime: c.stopTime,
                    impressions: c.impressions,
                    reach: c.reach,
                    spend: c.spend,
                    clicks: c.clicks,
                    results: c.results,
                }));
                break;

            case 'adsets':
                if (!campaignId) {
                    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
                }
                const adSets = await prisma.adSet.findMany({
                    where: { campaignId },
                    orderBy: { name: 'asc' },
                });
                data = adSets.map(as => ({
                    id: as.id,
                    name: as.name,
                    status: as.status,
                    effectiveStatus: as.effectiveStatus,
                    campaignId: as.campaignId,
                    adAccountId: as.adAccountId,
                    dailyBudget: as.dailyBudget,
                    lifetimeBudget: as.lifetimeBudget,
                    budgetRemaining: as.budgetRemaining,
                    optimizationGoal: as.optimizationGoal,
                    billingEvent: as.billingEvent,
                    bidAmount: as.bidAmount,
                    impressions: as.impressions,
                    reach: as.reach,
                    spend: as.spend,
                    clicks: as.clicks,
                    results: as.results,
                }));
                break;

            case 'ads':
                if (!adSetId) {
                    return NextResponse.json({ error: 'adSetId required' }, { status: 400 });
                }
                const ads = await prisma.facebookAd.findMany({
                    where: { adSetId },
                    orderBy: { name: 'asc' },
                });
                data = ads.map(ad => ({
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    effectiveStatus: ad.effectiveStatus,
                    adSetId: ad.adSetId,
                    campaignId: ad.campaignId,
                    campaignName: ad.campaignName,
                    adSetName: ad.adSetName,
                    adAccountId: ad.adAccountId,
                    thumbnailUrl: ad.thumbnail,
                    pageId: ad.pageId,
                    pageName: ad.pageName,
                    budget: ad.budget ? parseFloat(ad.budget) : 0,
                    impressions: ad.impressions,
                    reach: ad.reach,
                    spend: ad.spend,
                    clicks: ad.clicks,
                    results: ad.results,
                    postEngagements: ad.postEngagements,
                    videoPlays: ad.videoPlays,
                    videoP25: ad.videoP25,
                    videoP50: ad.videoP50,
                    videoP75: ad.videoP75,
                    videoP95: ad.videoP95,
                    videoP100: ad.videoP100,
                    videoAvgTime: ad.videoAvgTime,
                }));
                break;

            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json({
            data,
            count: data.length,
            lastSyncAt,
            cached: true, // Indicate this is from cache
        });

    } catch (error: any) {
        console.error('[Cached Ads API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch cached data' },
            { status: 500 }
        );
    }
}
