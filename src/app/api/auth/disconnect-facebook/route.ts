import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // @ts-ignore
        const userId = session.user.id;

        // Clear Facebook token
        await db.updateUser(userId, {
            facebookPageToken: null,
            facebookAdToken: null
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Facebook:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
}
