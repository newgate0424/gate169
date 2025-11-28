'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ConnectPlatform } from '@/components/ConnectPlatform';
import { AdsTable, AdData } from '@/components/AdsTable';
import { fetchAdAccounts, fetchAdData, saveFacebookToken } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function AdManagerPage() {
    const { data: session } = useSession();
    const [adsData, setAdsData] = useState<AdData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>(undefined);

    // @ts-ignore
    const facebookToken = session?.user?.facebookAccessToken;

    const handleFacebookConnect = async (token: string) => {
        try {
            await saveFacebookToken(token);
            window.location.reload();
        } catch (e) {
            console.error("Failed to save token", e);
            setError("Failed to save Facebook token");
        }
    };

    const loadAllData = async () => {
        if (!facebookToken) return;

        setLoading(true);
        setError(null);
        setAdsData([]);

        try {
            const accounts = await fetchAdAccounts(facebookToken);

            if (accounts.length === 0) {
                setLoading(false);
                return;
            }

            const results = await Promise.allSettled(accounts.map(async (account: any) => {
                try {
                    const range = date?.from && date?.to ? { from: date.from, to: date.to } : undefined;
                    const data = await fetchAdData(facebookToken, account.id, range);
                    return data.map((ad: any) => ({
                        ...ad,
                        accountName: account.name,
                        accountId: account.account_id,
                        currency: account.currency
                    }));
                } catch (e) {
                    console.error(`Failed to fetch for ${account.name}`, e);
                    return [];
                }
            }));

            const allAds = results
                .filter((result): result is PromiseFulfilledResult<any[]> => result.status === 'fulfilled')
                .flatMap(result => result.value);

            setAdsData(allAds);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (facebookToken) {
            loadAllData();
        }
    }, [facebookToken, date]);

    if (!facebookToken) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name}!</h2>
                    <p className="text-gray-500 mt-2">To get started, please connect your ad platform.</p>
                </div>
                <ConnectPlatform onLogin={handleFacebookConnect} user={session?.user} />
            </div>
        );
    }

    return (
        <div className="w-full max-w-[95%] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Ad Manager</h1>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={loadAllData}
                        disabled={loading}
                        className="bg-white border-gray-200 hover:bg-gray-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="bg-white rounded-md border border-gray-200">
                        <DatePickerWithRange date={date} setDate={setDate} className="border-0" />
                    </div>
                </div>
            </div>

            {loading && adsData.length === 0 ? (
                <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <AdsTable data={adsData} accessToken={facebookToken} user={session?.user} />
                </div>
            )}

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative fixed bottom-4 right-4 max-w-md">
                    {error}
                </div>
            )}
        </div>
    );
}
