import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// Cache for profile pictures (in-memory, clears on restart)
const pictureCache = new Map<string, { data: ArrayBuffer; contentType: string; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Cache for Page Access Tokens (reduce API calls significantly!)
const pageTokenCache = new Map<string, { token: string; timestamp: number }>();
const TOKEN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getPageToken(pageId: string, userAccessToken: string): Promise<string | null> {
    // Check cache first
    const cached = pageTokenCache.get(pageId);
    if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_DURATION) {
        return cached.token;
    }
    
    try {
        const pageResponse = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
        );
        const pageData = await pageResponse.json();
        
        if (pageData.access_token) {
            pageTokenCache.set(pageId, {
                token: pageData.access_token,
                timestamp: Date.now()
            });
            return pageData.access_token;
        }
    } catch (err) {
        console.error('[getPageToken] Error:', err);
    }
    return null;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const pageId = searchParams.get('pageId');
    const size = searchParams.get('size') || 'normal';
    const name = searchParams.get('name') || 'U';

    // Generate fallback avatar URL
    const getFallbackUrl = () => {
        const colors = ['3b82f6', '10b981', 'f59e0b', 'ef4444', '8b5cf6', 'ec4899', '06b6d4', 'f97316'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % colors.length;
        const initial = name.charAt(0).toUpperCase();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${colors[colorIndex]}&color=fff&size=100`;
    };

    if (!userId || !pageId) {
        return NextResponse.redirect(getFallbackUrl());
    }

    // Check cache first
    const cacheKey = `${userId}-${pageId}-${size}`;
    const cached = pictureCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return new Response(new Uint8Array(cached.data), {
            headers: {
                'Content-Type': cached.contentType,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.redirect(getFallbackUrl());
        }

        // @ts-ignore
        const dbUser = await prisma.user.findUnique({
            // @ts-ignore
            where: { id: session.user.id },
            select: { facebookAccessToken: true }
        });

        if (!dbUser?.facebookAccessToken) {
            return NextResponse.redirect(getFallbackUrl());
        }

        // Get Page Access Token (cached)
        const pageToken = await getPageToken(pageId, dbUser.facebookAccessToken);
        
        if (!pageToken) {
            console.log('[ProfilePic] No page access token for page:', pageId);
            return NextResponse.redirect(getFallbackUrl());
        }

        // Fetch profile picture as binary (follow redirects)
        const pictureUrl = `https://graph.facebook.com/${userId}/picture?type=${size}&access_token=${pageToken}`;
        console.log('[ProfilePic] Fetching:', pictureUrl.substring(0, 80) + '...');
        
        const pictureResponse = await fetch(pictureUrl, { redirect: 'follow' });
        
        if (!pictureResponse.ok) {
            // Try to get error message
            const errorText = await pictureResponse.text();
            console.log('[ProfilePic] Failed to fetch picture:', pictureResponse.status, 'for user:', userId, 'error:', errorText.substring(0, 200));
            return NextResponse.redirect(getFallbackUrl());
        }

        const contentType = pictureResponse.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await pictureResponse.arrayBuffer();

        // Check if we got a valid image (not error response)
        if (arrayBuffer.byteLength < 100 || contentType.includes('application/json')) {
            console.log('[ProfilePic] Invalid image response for user:', userId);
            return NextResponse.redirect(getFallbackUrl());
        }

        // Cache the result
        pictureCache.set(cacheKey, {
            data: arrayBuffer,
            contentType,
            timestamp: Date.now(),
        });

        // Clean old cache entries (keep last 500)
        if (pictureCache.size > 500) {
            const entries = Array.from(pictureCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            for (let i = 0; i < 100; i++) {
                pictureCache.delete(entries[i][0]);
            }
        }

        return new Response(new Uint8Array(arrayBuffer), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('[ProfilePic] Error:', error);
        return NextResponse.redirect(getFallbackUrl());
    }
}
