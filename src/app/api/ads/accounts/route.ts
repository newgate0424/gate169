import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAdAccounts, getAdAccountInsights, getAdAccountAdCounts } from '@/lib/facebook';

// GET - Fetch ad accounts with insights from Facebook
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

        // Get date params from query
        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        
        const dateRange = dateFrom && dateTo ? {
            from: new Date(dateFrom),
            to: new Date(dateTo),
        } : undefined;

        // Fetch fresh data from Facebook
        const facebookAccounts = await getAdAccounts(accessToken);
        
        // Get account IDs
        const accountIds = facebookAccounts.map((acc: any) => acc.id);
        
        // Check if we should skip ad counts for faster loading
        const skipCounts = searchParams.get('skipCounts') === 'true';
        
        // Fetch insights (required) and ad counts (optional) in PARALLEL
        const [insightsMap, adCountsMap] = await Promise.all([
            getAdAccountInsights(accessToken, accountIds, dateRange),
            skipCounts ? Promise.resolve(new Map()) : getAdAccountAdCounts(accessToken, accountIds).catch(() => new Map())
        ]);

        // Combine Facebook data with insights and ad counts
        const accountsWithStats = facebookAccounts.map((account: any) => {
            const insight = insightsMap.get(account.id) || {};
            const adCounts = adCountsMap.get(account.id) || { totalAds: null, activeAds: null, pausedAds: null };
            
            const totalSpend = parseFloat(insight.spend || '0');
            const totalImpressions = parseInt(insight.impressions || '0');
            const totalReach = parseInt(insight.reach || '0');
            const totalClicks = parseInt(insight.clicks || '0');
            
            return {
                id: account.id,
                accountId: account.account_id,
                name: account.name,
                currency: account.currency || 'THB',
                accountStatus: account.account_status,
                timezone: account.timezone_name || 'Unknown',
                timezoneOffset: account.timezone_offset_hours_utc || 0,
                totalAds: adCounts.totalAds,
                activeAds: adCounts.activeAds,
                pausedAds: adCounts.pausedAds,
                totalSpend,
                totalImpressions,
                totalReach,
                totalClicks,
                ctr: parseFloat(insight.ctr || '0'),
                cpm: parseFloat(insight.cpm || '0'),
            };
        });

        return NextResponse.json({
            accounts: accountsWithStats,
            count: accountsWithStats.length,
            countsLoaded: !skipCounts
        });

    } catch (error: any) {
        console.error('[Ad Accounts Fetch] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch ad accounts' },
            { status: 500 }
        );
    }
}

// POST - Sync ad accounts from Facebook
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

        // Fetch ad accounts from Facebook
        const accounts = await getAdAccounts(accessToken);

        // Save each account
        for (const account of accounts) {
            await db.upsertAdAccount({
                id: account.id,
                userId,
                accountId: account.account_id,
                name: account.name,
                currency: account.currency,
                accountStatus: account.account_status
            });
        }

        return NextResponse.json({
            success: true,
            count: accounts.length
        });

    } catch (error: any) {
        console.error('[Ad Accounts Sync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync ad accounts' },
            { status: 500 }
        );
    }
}
