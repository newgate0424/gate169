'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AdsTable, AdData } from '@/components/AdsTable';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { subDays, formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { RefreshCw, Loader2, Database, Cloud, AlertCircle } from 'lucide-react';

export default function AdManagerPage() {
    const { data: session } = useSession();
    const [adsData, setAdsData] = useState<AdData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    
    // Initialize date from localStorage or default to last 30 days
    const [date, setDate] = useState<DateRange | undefined>(() => {
        if (typeof window !== 'undefined') {
            const savedDate = localStorage.getItem('admanager_dateRange');
            if (savedDate) {
                try {
                    const parsed = JSON.parse(savedDate);
                    return {
                        from: new Date(parsed.from),
                        to: new Date(parsed.to),
                    };
                } catch (e) {
                    console.error('Failed to parse saved date:', e);
                }
            }
        }
        return {
            from: subDays(new Date(), 30),
            to: new Date(),
        };
    });

    // Save date to localStorage when it changes
    useEffect(() => {
        if (date?.from && date?.to) {
            localStorage.setItem('admanager_dateRange', JSON.stringify({
                from: date.from.toISOString(),
                to: date.to.toISOString(),
            }));
        }
    }, [date]);

    // @ts-ignore
    const facebookToken = session?.user?.facebookAdToken;

    // Load ads from database (fast)
    const loadAdsFromDB = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/ads/sync');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load ads');
            }

            // Transform data to match AdData type
            const transformedAds: AdData[] = data.ads.map((ad: any) => ({
                id: ad.id,
                accountName: ad.accountName,
                accountId: ad.adAccountId,
                currency: ad.currency || 'THB',
                name: ad.name,
                status: ad.effectiveStatus || ad.status,
                delivery: ad.effectiveStatus || ad.status,
                budget: ad.budget || 'N/A',
                results: ad.results || 0,
                reach: ad.reach || 0,
                impressions: ad.impressions || 0,
                spend: ad.spend || 0,
                roas: ad.roas || 0,
                cpm: ad.cpm || 0,
                campaignName: ad.campaignName || '',
                adSetName: ad.adSetName || '',
                thumbnail: ad.thumbnail || '',
                post_engagements: ad.postEngagements || 0,
                link_clicks: ad.linkClicks || 0,
                new_messaging_contact: ad.results || 0,
                video_avg_time: ad.videoAvgTime || 0,
                video_plays: ad.videoPlays || 0,
                video_3sec: ad.videoPlays || 0,
                video_p25: ad.videoP25 || 0,
                video_p50: ad.videoP50 || 0,
                video_p75: ad.videoP75 || 0,
                video_p95: ad.videoP95 || 0,
                video_p100: ad.videoP100 || 0,
                pageId: ad.pageId || 'N/A',
                pageName: ad.pageName || 'N/A',
                pageUsername: ad.pageUsername || null,
            }));

            setAdsData(transformedAds);
            
            if (data.lastSyncAt) {
                setLastSyncAt(new Date(data.lastSyncAt));
            }

        } catch (err: any) {
            console.error('Failed to load ads:', err);
            // Don't set error for empty state
            if (err.message !== 'Failed to load ads') {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load from database
    useEffect(() => {
        if (facebookToken) {
            loadAdsFromDB();
        } else {
            setLoading(false);
        }
    }, [facebookToken, loadAdsFromDB]);

    // No more auto-sync from Facebook! 
    // Data is synced by background cron job every 5 minutes
    // UI just reads from database (fast!)

    if (!facebookToken) {
        return (
            <div className="w-full max-w-[95%] mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Ad Manager</h1>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">เชื่อมต่อ Facebook</h3>
                    <p className="text-gray-500 mb-4">กรุณาเชื่อมต่อ Facebook เพื่อดูข้อมูลโฆษณา</p>
                    <Button onClick={() => window.location.href = '/settings/connect'}>
                        ไปหน้าเชื่อมต่อ
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[95%] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-800">Ad Manager</h1>
                    
                    {/* Status indicator - shows last sync time */}
                    {lastSyncAt && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                            <Database className="h-3 w-3" />
                            อัพเดท {formatDistanceToNow(lastSyncAt, { addSuffix: true, locale: th })}
                        </span>
                    )}
                </div>
                
                {/* Date picker and other controls are now in AdsTable */}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setError(null)}
                        className="ml-auto text-red-600 hover:text-red-700"
                    >
                        ปิด
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <div className="text-sm text-gray-500">กำลังโหลดข้อมูลจากฐานข้อมูล...</div>
                </div>
            ) : adsData.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                    <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่พบข้อมูลโฆษณา</h3>
                    <p className="text-gray-500 mb-4">ระบบกำลัง Sync ข้อมูลอัตโนมัติทุก 5 นาที</p>
                    <p className="text-xs text-gray-400">หรือรอสักครู่แล้วรีเฟรชหน้านี้</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <AdsTable data={adsData} accessToken={facebookToken} user={session?.user} date={date} setDate={setDate} />
                </div>
            )}
        </div>
    );
}
