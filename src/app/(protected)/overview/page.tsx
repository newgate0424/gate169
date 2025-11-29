'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { fetchPages, saveFacebookToken } from '@/app/actions';
import { ConnectPlatform } from '@/components/ConnectPlatform';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Search,
    RefreshCw,
    Plus,
    LayoutGrid,
    Facebook,
    Loader2,
} from 'lucide-react';

interface Page {
    id: string;
    name: string;
    access_token?: string;
    category?: string;
    tasks?: string[];
    picture?: {
        data: {
            url: string;
        }
    };
    link?: string;
}

export default function OverviewPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [showConnectDialog, setShowConnectDialog] = useState(false);

    const handleFacebookConnect = async (token: string) => {
        try {
            await saveFacebookToken(token);
            setShowConnectDialog(false);
            await loadPages();
        } catch (e) {
            console.error("Failed to save token", e);
        }
    };

    const loadPages = async () => {
        try {
            setRefreshing(true);
            const data = await fetchPages();
            setPages(data);
        } catch (error) {
            console.error("Failed to fetch pages:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (session?.user) {
            loadPages();
        }
    }, [session]);

    const filteredPages = pages.filter(page =>
        page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.id.includes(searchTerm)
    );

    return (
        <div className="h-full px-4 md:px-[300px] py-6 space-y-3">
            {/* Top Section: Controls */}
            <Card className="p-6 bg-white shadow-sm border rounded-xl">
                <div className="flex flex-col gap-6">
                    <h1 className="text-xl font-semibold text-gray-900">{t('overview.title')}</h1>

                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={t('overview.search')}
                                className="pl-10 bg-gray-100 border-0 focus-visible:ring-1"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={loadPages}
                                disabled={refreshing}
                                className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                            >
                                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>

                            <Button
                                onClick={() => setShowConnectDialog(true)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-900 gap-2 flex-1 md:flex-initial border-0"
                                size="sm"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('overview.addConnection')}</span>
                                <span className="sm:hidden">+</span>
                            </Button>

                            <Button variant="secondary" className="gap-2 hidden lg:flex bg-gray-100 hover:bg-gray-200 text-gray-900 border-0">
                                <LayoutGrid className="h-4 w-4" />
                                {t('overview.multiMode')}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Middle Section: Filters */}
            <Card className="p-2 bg-white shadow-sm border rounded-xl">
                <div className="flex items-center gap-2 w-full overflow-x-auto">
                    <Button variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 gap-2 h-9 flex-shrink-0 rounded-lg">
                        <div className="bg-gray-500 rounded p-0.5">
                            <LayoutGrid className="h-3 w-3 text-white" />
                        </div>
                        {t('overview.all')}
                        <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {pages.length}
                        </span>
                    </Button>

                    <Button variant="ghost" className="text-gray-600 hover:bg-gray-50 gap-2 h-9 flex-shrink-0 rounded-lg">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        {t('overview.facebook')}
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {pages.length}
                        </span>
                    </Button>
                </div>
            </Card>

            {/* Bottom Section: Pages Grid */}
            <Card className="flex-1 p-6 bg-white shadow-sm border rounded-xl min-h-[500px]">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredPages.map((page) => (
                            <Card key={page.id} className="hover:shadow-md transition-shadow border border-gray-200 rounded-xl">
                                <CardContent className="p-2 flex items-center gap-3">
                                    <Avatar className="h-12 w-12 rounded-lg border border-gray-100 flex-shrink-0">
                                        <AvatarImage src={page.picture?.data?.url} alt={page.name} />
                                        <AvatarFallback className="rounded-lg bg-gray-100 text-gray-400">
                                            {page.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate text-sm leading-none mb-0.5">{page.name}</h3>
                                        <p className="text-[10px] text-gray-500 truncate leading-none">
                                            {page.category || 'Facebook Page'}
                                        </p>

                                        <div className="flex items-center gap-1 mt-1">
                                            <Facebook className="h-2.5 w-2.5 text-blue-600 flex-shrink-0" />
                                            <a
                                                href={page.link || `https://facebook.com/${page.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-gray-500 hover:text-blue-600 truncate leading-none"
                                            >
                                                {page.name}
                                            </a>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </Card>

            {showConnectDialog && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowConnectDialog(false)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ConnectPlatform
                            onLogin={handleFacebookConnect}
                            user={session?.user}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
