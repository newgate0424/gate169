import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { startPolling, stopPolling, getPollingStatus } from '@/lib/ads-poller';

// POST - Start or stop polling
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Start polling with 5-minute interval
        startPolling(5 * 60 * 1000); // 5 minutes

        return NextResponse.json({
            success: true,
            message: 'Polling started',
            status: getPollingStatus()
        });

    } catch (error: any) {
        console.error('[Poll Start API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to start polling' },
            { status: 500 }
        );
    }
}

// DELETE - Stop polling
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        stopPolling();

        return NextResponse.json({
            success: true,
            message: 'Polling stopped',
            status: getPollingStatus()
        });

    } catch (error: any) {
        console.error('[Poll Stop API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to stop polling' },
            { status: 500 }
        );
    }
}
