import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAdsByAdSets, initFacebookApi } from '@/lib/facebook';

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

// GET - Fetch ads for selected ad sets
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
        const adSetIds = searchParams.get('adsetIds')?.split(',') || [];
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        
        // Build date range object
        const dateRange = dateFrom && dateTo ? {
            from: new Date(dateFrom),
            to: new Date(dateTo),
        } : undefined;

        if (adSetIds.length === 0) {
            return NextResponse.json({ ads: [], count: 0 });
        }

        // Fetch ads for ad sets with date range
        const ads = await getAdsByAdSets(accessToken, adSetIds, dateRange);
        
        // Get unique page IDs to fetch page names
        const pageIds = [...new Set(ads.map((ad: any) => ad.pageId).filter(Boolean))];
        const pageNamesMap = new Map<string, string>();
        
        if (pageIds.length > 0) {
            const api = initFacebookApi(accessToken);
            // Fetch page names with rate limiting to avoid API limits
            const pageResults = await processBatch(
                pageIds,
                async (pageId) => {
                    try {
                        const pageData = await api.call('GET', [pageId], {
                            fields: 'name,username'
                        });
                        return { pageId, name: pageData.username || pageData.name || pageId };
                    } catch (error) {
                        console.error(`Error fetching page ${pageId}:`, error);
                        return { pageId, name: pageId };
                    }
                },
                2, // batch size - 2 pages at a time
                500 // 500ms delay between batches
            );
            pageResults.forEach(({ pageId, name }) => {
                pageNamesMap.set(pageId, name);
            });
        }
        
        // Add page names to ads
        const adsWithPageNames = ads.map((ad: any) => ({
            ...ad,
            pageName: pageNamesMap.get(ad.pageId) || ad.pageId || 'Unknown',
        }));

        return NextResponse.json({
            ads: adsWithPageNames,
            count: adsWithPageNames.length
        });

    } catch (error: any) {
        console.error('[Ads by AdSets Fetch] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch ads' },
            { status: 500 }
        );
    }
}
