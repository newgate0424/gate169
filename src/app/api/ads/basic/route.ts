import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { initFacebookApi } from '@/lib/facebook';
import { AdAccount } from 'facebook-nodejs-business-sdk';

// GET - Fetch BASIC ad data (no insights) - FAST!
// Used for initial quick load, then insights loaded separately
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { facebookAdToken: true }
        });

        if (!user?.facebookAdToken) {
            return NextResponse.json({ error: 'Facebook Ad Token not found' }, { status: 400 });
        }

        const accessToken = user.facebookAdToken;
        const api = initFacebookApi(accessToken);
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'campaigns';
        const accountId = searchParams.get('accountId');
        const campaignIds = searchParams.get('campaignIds')?.split(',').filter(Boolean) || [];
        const adSetIds = searchParams.get('adSetIds')?.split(',').filter(Boolean) || [];

        let data: any = null;

        switch (type) {
            case 'campaigns': {
                if (!accountId) {
                    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
                }
                
                const account = new AdAccount(accountId, undefined, undefined, api);
                const campaigns = await account.getCampaigns([
                    'name',
                    'status',
                    'effective_status',
                    'objective',
                    'daily_budget',
                    'lifetime_budget',
                ], { limit: 500 });

                data = campaigns.map((c: any) => ({
                    id: c.id,
                    adAccountId: accountId,
                    name: c.name,
                    status: c.status,
                    effectiveStatus: c.effective_status,
                    objective: c.objective,
                    dailyBudget: c.daily_budget ? parseInt(c.daily_budget) / 100 : null,
                    lifetimeBudget: c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
                    // Insights will be null - loaded separately
                    impressions: null,
                    reach: null,
                    spend: null,
                    clicks: null,
                    results: null,
                }));
                break;
            }

            case 'adsets': {
                if (campaignIds.length === 0) {
                    return NextResponse.json({ error: 'campaignIds required' }, { status: 400 });
                }

                const allAdSets: any[] = [];
                
                // Get ad sets for each campaign
                for (const campaignId of campaignIds) {
                    try {
                        const response = await api.call('GET', [campaignId, 'adsets'], {
                            fields: 'name,status,effective_status,campaign_id,account_id,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount',
                            limit: 500
                        });
                        if (response?.data) {
                            allAdSets.push(...response.data);
                        }
                    } catch (e) {
                        console.error(`Error fetching adsets for campaign ${campaignId}:`, e);
                    }
                }

                data = allAdSets.map((as: any) => ({
                    id: as.id,
                    name: as.name,
                    status: as.status,
                    effectiveStatus: as.effective_status,
                    campaignId: as.campaign_id,
                    adAccountId: as.account_id ? `act_${as.account_id}` : null,
                    dailyBudget: as.daily_budget ? parseInt(as.daily_budget) / 100 : null,
                    lifetimeBudget: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : null,
                    optimizationGoal: as.optimization_goal,
                    billingEvent: as.billing_event,
                    bidAmount: as.bid_amount,
                    // Insights will be null - loaded separately
                    impressions: null,
                    reach: null,
                    spend: null,
                    clicks: null,
                    results: null,
                }));
                break;
            }

            case 'ads': {
                if (adSetIds.length === 0) {
                    return NextResponse.json({ error: 'adSetIds required' }, { status: 400 });
                }

                const allAds: any[] = [];
                
                // Get ads for each ad set
                for (const adSetId of adSetIds) {
                    try {
                        const response = await api.call('GET', [adSetId, 'ads'], {
                            fields: 'name,status,effective_status,adset_id,campaign_id,account_id,creative{thumbnail_url}',
                            limit: 500
                        });
                        if (response?.data) {
                            allAds.push(...response.data);
                        }
                    } catch (e) {
                        console.error(`Error fetching ads for adset ${adSetId}:`, e);
                    }
                }

                data = allAds.map((ad: any) => ({
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    effectiveStatus: ad.effective_status,
                    adSetId: ad.adset_id,
                    campaignId: ad.campaign_id,
                    adAccountId: ad.account_id ? `act_${ad.account_id}` : null,
                    thumbnailUrl: ad.creative?.thumbnail_url || '',
                    // Insights will be null - loaded separately
                    results: null,
                    reach: null,
                    impressions: null,
                    postEngagements: null,
                    clicks: null,
                    spend: null,
                    costPerNewMessagingContact: null,
                    videoAvgTime: null,
                    videoPlays: null,
                    videoP25: null,
                    videoP50: null,
                    videoP75: null,
                    videoP95: null,
                    videoP100: null,
                }));
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json({ 
            data,
            hasInsights: false, // Flag to indicate insights need to be loaded
        });

    } catch (error: any) {
        console.error('Error in /api/ads/basic:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch data',
            details: error?.message 
        }, { status: 500 });
    }
}
