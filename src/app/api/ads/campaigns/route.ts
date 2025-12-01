import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCampaigns } from '@/lib/facebook';

// Rate limiting helper - delay in ms
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process items in batches with delay to avoid rate limits
const processBatch = async <T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 3,
    delayMs: number = 500
): Promise<R[]> => {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
        if (i + batchSize < items.length) {
            await delay(delayMs);
        }
    }
    return results;
};

// GET - Fetch campaigns for selected ad accounts
export async function GET(request: NextRequest) {
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

        // Get params from query
        const { searchParams } = new URL(request.url);
        const accountIds = searchParams.get('accountIds')?.split(',') || [];
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        
        // Build date range object
        const dateRange = dateFrom && dateTo ? {
            from: new Date(dateFrom),
            to: new Date(dateTo),
        } : undefined;

        if (accountIds.length === 0) {
            return NextResponse.json({ campaigns: [], count: 0 });
        }

        // Fetch campaigns with rate limiting to avoid API limits
        const results = await processBatch(
            accountIds,
            async (accountId) => {
                try {
                    const campaigns = await getCampaigns(accessToken, accountId, dateRange);
                    // Add account info to each campaign
                    return campaigns.map((campaign: any) => ({
                        ...campaign,
                        adAccountId: accountId,
                    }));
                } catch (error) {
                    console.error(`Error fetching campaigns for ${accountId}:`, error);
                    return [];
                }
            },
            2, // batch size - 2 accounts at a time
            500 // 500ms delay between batches
        );
        const allCampaigns = results.flat();

        return NextResponse.json({
            campaigns: allCampaigns,
            count: allCampaigns.length
        });

    } catch (error: any) {
        console.error('[Campaigns Fetch] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch campaigns' },
            { status: 500 }
        );
    }
}
