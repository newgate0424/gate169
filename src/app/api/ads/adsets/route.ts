import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAdSets } from '@/lib/facebook';

// GET - Fetch ad sets for selected campaigns
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
        const campaignIds = searchParams.get('campaignIds')?.split(',') || [];
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        
        // Build date range object
        const dateRange = dateFrom && dateTo ? {
            from: new Date(dateFrom),
            to: new Date(dateTo),
        } : undefined;

        if (campaignIds.length === 0) {
            return NextResponse.json({ adsets: [], count: 0 });
        }

        // Fetch ad sets for campaigns with date range
        const adSets = await getAdSets(accessToken, campaignIds, dateRange);

        return NextResponse.json({
            adsets: adSets,
            count: adSets.length
        });

    } catch (error: any) {
        console.error('[AdSets Fetch] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch ad sets' },
            { status: 500 }
        );
    }
}
