import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
    getCampaigns, 
    getAdSets, 
    getAdsByAdSets 
} from '@/lib/facebook';

// GET - Fetch ad insights for specific date range from Facebook API
// This is called when user changes date picker
export async function GET(request: NextRequest) {
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
                error: 'Facebook Ad Token not found' 
            }, { status: 400 });
        }

        const accessToken = user.facebookAdToken;
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'campaigns';
        const accountId = searchParams.get('accountId');
        const campaignIds = searchParams.get('campaignIds')?.split(',').filter(Boolean) || [];
        const adSetIds = searchParams.get('adSetIds')?.split(',').filter(Boolean) || [];
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        // Parse date range
        let dateRange: { from: Date, to: Date } | undefined;
        if (dateFrom && dateTo) {
            dateRange = {
                from: new Date(dateFrom),
                to: new Date(dateTo)
            };
        }

        let data: any = null;

        switch (type) {
            case 'campaigns':
                if (!accountId) {
                    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
                }
                
                console.log(`[Insights] Fetching campaigns for ${accountId} with date range:`, dateRange);
                const campaigns = await getCampaigns(accessToken, accountId, dateRange);
                
                data = campaigns.map((c: any) => ({
                    id: c.id,
                    adAccountId: accountId,
                    name: c.name,
                    status: c.status,
                    effectiveStatus: c.effectiveStatus,
                    objective: c.objective,
                    dailyBudget: c.dailyBudget,
                    lifetimeBudget: c.lifetimeBudget,
                    budgetRemaining: c.budgetRemaining,
                    startTime: c.startTime,
                    stopTime: c.stopTime,
                    impressions: c.impressions || 0,
                    reach: c.reach || 0,
                    spend: c.spend || 0,
                    clicks: c.clicks || 0,
                    results: c.results || 0,
                }));
                break;

            case 'adsets':
                if (campaignIds.length === 0) {
                    return NextResponse.json({ error: 'campaignIds required' }, { status: 400 });
                }
                
                console.log(`[Insights] Fetching adsets for ${campaignIds.length} campaigns with date range:`, dateRange);
                const adSets = await getAdSets(accessToken, campaignIds, dateRange);
                
                data = adSets.map((as: any) => ({
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
                    impressions: as.impressions || 0,
                    reach: as.reach || 0,
                    spend: as.spend || 0,
                    clicks: as.clicks || 0,
                    results: as.results || 0,
                }));
                break;

            case 'ads':
                if (adSetIds.length === 0) {
                    return NextResponse.json({ error: 'adSetIds required' }, { status: 400 });
                }
                
                console.log(`[Insights] Fetching ads for ${adSetIds.length} adsets with date range:`, dateRange);
                const ads = await getAdsByAdSets(accessToken, adSetIds, dateRange);
                
                data = ads.map((ad: any) => ({
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    effectiveStatus: ad.effectiveStatus,
                    adSetId: ad.adSetId,
                    campaignId: ad.campaignId,
                    adAccountId: ad.adAccountId,
                    thumbnailUrl: ad.thumbnailUrl || '',
                    pageId: ad.pageId || '',
                    pageName: ad.pageName || '',
                    budget: ad.budget || 0,
                    results: ad.results || 0,
                    reach: ad.reach || 0,
                    impressions: ad.impressions || 0,
                    postEngagements: ad.postEngagements || 0,
                    clicks: ad.clicks || 0,
                    newMessagingContacts: ad.results || 0,
                    spend: ad.spend || 0,
                    costPerNewMessagingContact: ad.results > 0 ? ad.spend / ad.results : 0,
                    videoAvgTime: ad.videoAvgTime || 0,
                    videoPlays: ad.videoPlays || 0,
                    video3sec: 0,
                    videoP25: ad.videoP25 || 0,
                    videoP50: ad.videoP50 || 0,
                    videoP75: ad.videoP75 || 0,
                    videoP95: ad.videoP95 || 0,
                    videoP100: ad.videoP100 || 0,
                }));
                break;

            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json({
            data,
            count: data.length,
            dateRange: dateRange ? {
                from: dateRange.from.toISOString(),
                to: dateRange.to.toISOString()
            } : null,
        });

    } catch (error: any) {
        console.error('[Insights API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch insights' },
            { status: 500 }
        );
    }
}
