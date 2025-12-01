import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { triggerPollForUser, getPollingStatus } from '@/lib/ads-poller';

// POST - Trigger manual poll for current user
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;

        console.log(`[Poll API] Manual poll triggered by user: ${userId}`);

        // Trigger poll and get changes
        const changes = await triggerPollForUser(userId);

        return NextResponse.json({
            success: true,
            changesCount: changes.length,
            changes: changes,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Poll API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to poll' },
            { status: 500 }
        );
    }
}

// GET - Get polling status
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const status = getPollingStatus();

        return NextResponse.json({
            success: true,
            ...status
        });

    } catch (error: any) {
        console.error('[Poll API] Error getting status:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get status' },
            { status: 500 }
        );
    }
}
