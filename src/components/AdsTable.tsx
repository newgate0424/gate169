'use client';

import * as React from 'react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, LayoutGrid, RefreshCw } from 'lucide-react';
import { updateAdStatusAction, saveFacebookAdToken } from '@/app/actions';
import { ConnectModal } from '@/components/ConnectModal';
import { Loader2, ExternalLink } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';

// Sort direction type: 'asc' | 'desc' | null
type SortDirection = 'asc' | 'desc' | null;
type SortConfig = { key: string; direction: SortDirection };

// Sortable Header Component
function SortableHeader({ 
    label, 
    sortKey, 
    currentSort, 
    onSort,
    className = ''
}: { 
    label: string; 
    sortKey: string; 
    currentSort: SortConfig; 
    onSort: (key: string) => void;
    className?: string;
}) {
    const isActive = currentSort.key === sortKey;
    
    return (
        <button
            onClick={() => onSort(sortKey)}
            className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${className}`}
        >
            <span>{label}</span>
            {isActive && currentSort.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
            {isActive && currentSort.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
            {!isActive && <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </button>
    );
}

// Status Badge Component (Facebook Ads style)
function StatusBadge({ status, translatedStatus }: { status: string | null | undefined; translatedStatus: string }) {
    const safeStatus = status || 'UNKNOWN';
    
    // Define colors based on status (Facebook Ads style)
    const getStatusColor = (status: string) => {
        switch (status) {
            // Active states - Green
            case 'ACTIVE':
            case 'LEARNING':
                return 'bg-green-500';
            
            // Learning limited - Light green
            case 'LEARNING_LIMITED':
                return 'bg-green-400';
            
            // Paused/Off states - Gray
            case 'PAUSED':
            case 'CAMPAIGN_PAUSED':
            case 'ADSET_PAUSED':
            case 'AD_PAUSED':
            case 'ADS_PAUSED':
            case 'PARTIALLY_PAUSED':
                return 'bg-gray-400';
            
            // Deleted/Archived - Light gray
            case 'DELETED':
            case 'ARCHIVED':
            case 'NO_ADS':
                return 'bg-gray-300';
            
            // Pending/Review states - Yellow
            case 'PENDING_REVIEW':
            case 'IN_PROCESS':
            case 'PENDING':
            case 'PENDING_BILLING_INFO':
            case 'NOT_PUBLISHED':
                return 'bg-yellow-500';
            
            // Error states - Red
            case 'DISAPPROVED':
            case 'WITH_ISSUES':
            case 'ERROR':
                return 'bg-red-500';
            
            // Not delivering - Orange
            case 'NOT_DELIVERING':
                return 'bg-orange-400';
            
            // Scheduled - Blue
            case 'SCHEDULED':
            case 'PREAPPROVED':
                return 'bg-blue-500';
            
            // Completed - Purple
            case 'COMPLETED':
                return 'bg-purple-500';
            
            default:
                return 'bg-gray-400';
        }
    };

    const getTextColor = (status: string) => {
        switch (status) {
            // Active states - Green
            case 'ACTIVE':
            case 'LEARNING':
            case 'LEARNING_LIMITED':
                return 'text-green-700';
            
            // Error states - Red
            case 'DISAPPROVED':
            case 'WITH_ISSUES':
            case 'ERROR':
                return 'text-red-600';
            
            // Pending states - Yellow/Amber
            case 'PENDING_REVIEW':
            case 'IN_PROCESS':
            case 'PENDING':
            case 'PENDING_BILLING_INFO':
            case 'NOT_PUBLISHED':
                return 'text-yellow-700';
            
            // Not delivering - Orange
            case 'NOT_DELIVERING':
                return 'text-orange-600';
            
            // Scheduled - Blue
            case 'SCHEDULED':
            case 'PREAPPROVED':
                return 'text-blue-600';
            
            // Completed - Purple
            case 'COMPLETED':
                return 'text-purple-600';
            
            // Default - Gray (paused, deleted, etc.)
            default:
                return 'text-gray-600';
        }
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(safeStatus)}`}></span>
            <span className={`text-sm ${getTextColor(safeStatus)}`}>{translatedStatus || safeStatus}</span>
        </div>
    );
}

export type AdData = {
    id: string;
    accountName?: string;
    name: string;
    status: string;
    delivery: string;
    budget: string;
    results: number;
    reach: number;
    impressions: number;
    spend: number;
    roas: number;
    cpm: number;
    post_engagements: number;
    link_clicks: number;
    new_messaging_contact: number;
    video_avg_time: number;
    video_plays: number;
    video_3sec: number;
    video_p25: number;
    video_p50: number;
    video_p75: number;
    video_p95: number;
    video_p100: number;
    thumbnail: string;
    currency?: string;
    accountId?: string;
    pageId?: string;
    pageName?: string;
    pageUsername?: string;
};

export type AdAccountData = {
    id: string;
    accountId: string;
    name: string;
    currency: string;
    accountStatus: number;
    timezone: string;
    timezoneOffset: number;
    totalAds: number | null;
    activeAds: number | null;
    pausedAds: number | null;
    totalSpend: number;
    totalImpressions: number;
    totalReach: number;
    totalClicks: number;
    ctr: number;
    cpm: number;
};

export type CampaignData = {
    id: string;
    adAccountId: string;
    name: string;
    status: string;
    effectiveStatus: string;
    objective: string;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    budgetRemaining: number | null;
    startTime: string;
    stopTime: string;
    createdTime: string;
    impressions: number;
    reach: number;
    spend: number;
    clicks: number;
    results: number;
};

export type AdSetData = {
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    campaignId: string;
    adAccountId: string;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    budgetRemaining: number | null;
    startTime: string;
    endTime: string;
    optimizationGoal: string;
    billingEvent: string;
    bidAmount: number | null;
    // Insights
    impressions: number;
    reach: number;
    spend: number;
    clicks: number;
    results: number;
};

export type AdByAdSetData = {
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    adSetId: string;
    campaignId: string;
    adAccountId: string;
    thumbnailUrl: string;
    // Page info
    pageId: string;
    pageName: string;
    // Metrics
    budget: number;
    results: number;
    reach: number;
    impressions: number;
    postEngagements: number;
    clicks: number;
    newMessagingContacts: number;
    spend: number;
    costPerNewMessagingContact: number;
    videoAvgTime: number;
    videoPlays: number;
    video3sec: number;
    videoP25: number;
    videoP50: number;
    videoP75: number;
    videoP95: number;
    videoP100: number;
};

export function AdsTable({ data, accessToken, user, date, setDate }: { data: AdData[], accessToken: string, user?: any, date?: DateRange, setDate?: (date: DateRange | undefined) => void }) {
    const { t } = useLanguage();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [localData, setLocalData] = React.useState(data);
    const [adAccounts, setAdAccounts] = React.useState<AdAccountData[]>([]);
    const [loadingAccounts, setLoadingAccounts] = React.useState(false);
    const [campaigns, setCampaigns] = React.useState<CampaignData[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = React.useState(false);
    const [adSets, setAdSets] = React.useState<AdSetData[]>([]);
    const [loadingAdSets, setLoadingAdSets] = React.useState(false);
    const [adsByAdSets, setAdsByAdSets] = React.useState<AdByAdSetData[]>([]);
    const [loadingAdsByAdSets, setLoadingAdsByAdSets] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    // Loading progress state
    const [loadingProgress, setLoadingProgress] = React.useState<{ current: number; total: number; label: string } | null>(null);
    
    // Loading insights state (separate from basic data)
    const [loadingInsights, setLoadingInsights] = React.useState(false);

    // Helper function to translate status
    const translateStatus = (status: string | null | undefined): string => {
        const safeStatus = status || 'UNKNOWN';
        const translatedStatus = t(`status.${safeStatus}`);
        // If translation not found, return original status
        return translatedStatus.startsWith('status.') ? safeStatus : translatedStatus;
    };

    // Helper function to render insight values (shows loading state)
    const renderInsightValue = (value: number | null | undefined, formatter?: (v: number) => string) => {
        if (value === null || value === undefined) {
            return <span className="text-gray-400 animate-pulse">...</span>;
        }
        return formatter ? formatter(value) : value.toLocaleString();
    };

    // Sorting state for each tab
    const [accountSort, setAccountSort] = React.useState<SortConfig>({ key: '', direction: null });
    const [campaignSort, setCampaignSort] = React.useState<SortConfig>({ key: '', direction: null });
    const [adSetSort, setAdSetSort] = React.useState<SortConfig>({ key: '', direction: null });
    const [adsSort, setAdsSort] = React.useState<SortConfig>({ key: '', direction: null });

    // Generic sort handler
    const handleSort = (key: string, currentSort: SortConfig, setSort: React.Dispatch<React.SetStateAction<SortConfig>>) => {
        let newDirection: SortDirection = 'asc';
        if (currentSort.key === key) {
            if (currentSort.direction === 'asc') newDirection = 'desc';
            else if (currentSort.direction === 'desc') newDirection = null;
            else newDirection = 'asc';
        }
        setSort({ key: newDirection ? key : '', direction: newDirection });
    };

    // Generic sort function
    const sortData = <T,>(data: T[], sortConfig: SortConfig): T[] => {
        if (!sortConfig.key || !sortConfig.direction) return data;
        
        return [...data].sort((a: any, b: any) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            
            // String comparison
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const comparison = aVal.localeCompare(bVal);
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }
            
            // Number comparison
            if (sortConfig.direction === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    };

    // Sorted data for each tab
    const sortedAccounts = React.useMemo(() => sortData(adAccounts, accountSort), [adAccounts, accountSort]);
    const sortedCampaigns = React.useMemo(() => sortData(campaigns, campaignSort), [campaigns, campaignSort]);
    const sortedAdSets = React.useMemo(() => sortData(adSets, adSetSort), [adSets, adSetSort]);
    const sortedAds = React.useMemo(() => sortData(adsByAdSets, adsSort), [adsByAdSets, adsSort]);

    // Initialize state from localStorage
    const [activeTab, setActiveTab] = React.useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('admanager_activeTab') || 'Ad Accounts';
        }
        return 'Ad Accounts';
    });

    const [selectedAccounts, setSelectedAccounts] = React.useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('admanager_selectedAccounts');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    const [selectedCampaigns, setSelectedCampaigns] = React.useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('admanager_selectedCampaigns');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    const [selectedAdSets, setSelectedAdSets] = React.useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('admanager_selectedAdSets');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });

    // Save to localStorage when state changes
    React.useEffect(() => {
        localStorage.setItem('admanager_activeTab', activeTab);
    }, [activeTab]);

    React.useEffect(() => {
        localStorage.setItem('admanager_selectedAccounts', JSON.stringify(Array.from(selectedAccounts)));
    }, [selectedAccounts]);

    React.useEffect(() => {
        localStorage.setItem('admanager_selectedCampaigns', JSON.stringify(Array.from(selectedCampaigns)));
    }, [selectedCampaigns]);

    React.useEffect(() => {
        localStorage.setItem('admanager_selectedAdSets', JSON.stringify(Array.from(selectedAdSets)));
    }, [selectedAdSets]);

    React.useEffect(() => {
        setLocalData(data);
    }, [data]);

    // Toast for notifications
    const { toast } = useToast();

    // Auto-refresh state
    const [lastSyncAt, setLastSyncAt] = React.useState<Date | null>(null);
    const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const POLLING_INTERVAL = 30 * 1000; // 30 seconds - poll from DB (fast!)
    
    // Silent refresh from database (no toast - runs in background)
    const silentRefresh = React.useCallback(async () => {
        try {
            console.log('[Polling] Refreshing from database...');
            
            // Reload current tab's data silently
            switch (activeTab) {
                case 'Ad Accounts':
                    await loadAdAccounts();
                    break;
                case 'Campaigns':
                    if (selectedAccounts.size > 0) await loadCampaigns();
                    break;
                case 'Ad Sets':
                    if (selectedCampaigns.size > 0) await loadAdSets();
                    break;
                case 'Ads':
                    if (selectedAdSets.size > 0) await loadAdsByAdSets();
                    break;
            }
            
            // Check last sync time
            const response = await fetch('/api/ads/sync-to-db');
            const status = await response.json();
            if (status.lastSyncAt) {
                setLastSyncAt(new Date(status.lastSyncAt));
            }
        } catch (error) {
            console.error('[Polling] Failed:', error);
        }
    }, [activeTab, selectedAccounts, selectedCampaigns, selectedAdSets]);
    
    // Manual refresh (with toast feedback)
    const refreshData = React.useCallback(async () => {
        if (isRefreshing) return;
        
        setIsRefreshing(true);
        try {
            await silentRefresh();
            toast({
                title: '✅ รีเฟรชสำเร็จ',
                description: 'ข้อมูลอัพเดทจากฐานข้อมูลแล้ว',
            });
        } catch (error) {
            toast({
                title: '❌ รีเฟรชล้มเหลว',
                description: 'ไม่สามารถโหลดข้อมูลได้',
                variant: 'destructive',
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, silentRefresh, toast]);
    
    // Initial load + auto-polling from DB
    React.useEffect(() => {
        // Check last sync time from server
        const checkSyncStatus = async () => {
            try {
                const response = await fetch('/api/ads/sync-to-db');
                const status = await response.json();
                
                if (status.lastSyncAt) {
                    const lastSync = new Date(status.lastSyncAt);
                    setLastSyncAt(lastSync);
                    console.log(`[Init] Last sync: ${lastSync.toLocaleTimeString()}`);
                }
            } catch (error) {
                console.error('[Init] Check failed:', error);
            }
        };
        
        checkSyncStatus();
        
        // Setup polling - refresh from database every 30 seconds
        // (The actual sync from Facebook is done by cron job every 5 minutes)
        pollingIntervalRef.current = setInterval(() => {
            console.log('[Polling] Auto-refresh triggered');
            silentRefresh();
        }, POLLING_INTERVAL);
        
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [silentRefresh]);
    
    // Reload data when date changes
    React.useEffect(() => {
        if (date?.from && date?.to) {
            console.log('[DateChange] Date changed, reloading data for:', {
                from: date.from.toISOString().split('T')[0],
                to: date.to.toISOString().split('T')[0]
            });
            
            // Reload current tab's data with new date range
            switch (activeTab) {
                case 'Campaigns':
                    if (selectedAccounts.size > 0) loadCampaigns();
                    break;
                case 'Ad Sets':
                    if (selectedCampaigns.size > 0) loadAdSets();
                    break;
                case 'Ads':
                    if (selectedAdSets.size > 0) loadAdsByAdSets();
                    break;
            }
        }
    }, [date?.from?.getTime(), date?.to?.getTime()]);
    
    // Load ad accounts when tab changes (always from cache/DB)
    React.useEffect(() => {
        if (activeTab === 'Ad Accounts') {
            loadAdAccounts();
        }
    }, [activeTab]);

    // Load campaigns when switching to Campaigns tab with selected accounts
    React.useEffect(() => {
        if (activeTab === 'Campaigns' && selectedAccounts.size > 0) {
            loadCampaigns();
        }
    }, [activeTab, selectedAccounts, date]);

    // Load ad sets when switching to Ad Sets tab with selected campaigns
    React.useEffect(() => {
        if (activeTab === 'Ad Sets' && selectedCampaigns.size > 0) {
            loadAdSets();
        }
    }, [activeTab, selectedCampaigns, date]);

    // Load ads when switching to Ads tab with selected ad sets
    React.useEffect(() => {
        if (activeTab === 'Ads' && selectedAdSets.size > 0) {
            loadAdsByAdSets();
        }
    }, [activeTab, selectedAdSets, date]);

    const loadAdAccounts = async () => {
        try {
            setLoadingAccounts(true);
            
            // Always load from database (cached) - fast!
            const response = await fetch('/api/ads/cached?type=accounts');
            const result = await response.json();
            
            if (response.ok) {
                // Map cached data to expected format
                const accounts = (result.data || []).map((acc: any) => ({
                    id: acc.id,
                    accountId: acc.accountId,
                    name: acc.name,
                    currency: acc.currency || 'THB',
                    accountStatus: acc.accountStatus || 1,
                    timezone: acc.timezone || 'Unknown',
                    timezoneOffset: acc.timezoneOffset || 0,
                    totalAds: acc.totalAds,
                    activeAds: acc.activeAds,
                    pausedAds: acc.pausedAds,
                    totalSpend: acc.totalSpend || 0,
                    totalImpressions: acc.totalImpressions || 0,
                    totalReach: acc.totalReach || 0,
                    totalClicks: acc.totalClicks || 0,
                    ctr: acc.totalImpressions > 0 ? (acc.totalClicks / acc.totalImpressions) * 100 : 0,
                    cpm: acc.totalImpressions > 0 ? (acc.totalSpend / acc.totalImpressions) * 1000 : 0,
                }));
                setAdAccounts(accounts);
                if (result.lastSyncAt) {
                    setLastSyncAt(new Date(result.lastSyncAt));
                }
            }
        } catch (error) {
            console.error('Failed to load ad accounts:', error);
        } finally {
            setLoadingAccounts(false);
        }
    };

    // Build date params for API calls
    const getDateParams = () => {
        if (!date?.from || !date?.to) return '';
        return `&dateFrom=${date.from.toISOString()}&dateTo=${date.to.toISOString()}`;
    };

    // Load campaigns - Basic first, then insights
    const loadCampaigns = async () => {
        try {
            setLoadingCampaigns(true);
            setLoadingProgress({ current: 1, total: 2, label: 'ขั้นตอน (โหลดข้อมูลหลัก)' });
            
            const allCampaigns: CampaignData[] = [];
            const accountIds = Array.from(selectedAccounts);
            
            // Step 1: Load basic data first (FAST)
            for (let i = 0; i < accountIds.length; i++) {
                const accountId = accountIds[i];
                const response = await fetch(`/api/ads/basic?type=campaigns&accountId=${accountId}`);
                const result = await response.json();
                if (response.ok && result.data) {
                    allCampaigns.push(...result.data);
                }
            }
            
            // Show basic data immediately
            setCampaigns(allCampaigns);
            setLoadingCampaigns(false);
            
            // Step 2: Load insights in background
            setLoadingInsights(true);
            setLoadingProgress({ current: 2, total: 2, label: 'ขั้นตอน (โหลดสถิติ)' });
            
            const dateParams = getDateParams();
            const campaignsWithInsights: CampaignData[] = [];
            
            for (let i = 0; i < accountIds.length; i++) {
                const accountId = accountIds[i];
                const apiUrl = `/api/ads/insights?type=campaigns&accountId=${accountId}${dateParams}`;
                const response = await fetch(apiUrl);
                const result = await response.json();
                if (response.ok && result.data) {
                    campaignsWithInsights.push(...result.data);
                }
            }
            
            // Update with full insights
            setCampaigns(campaignsWithInsights);
            
        } catch (error) {
            console.error('Failed to load campaigns:', error);
        } finally {
            setLoadingCampaigns(false);
            setLoadingInsights(false);
            setLoadingProgress(null);
        }
    };

    // Load ad sets - Basic first, then insights
    const loadAdSets = async () => {
        try {
            setLoadingAdSets(true);
            setLoadingProgress({ current: 1, total: 2, label: 'ขั้นตอน (โหลดข้อมูลหลัก)' });
            
            const campaignIdsList = Array.from(selectedCampaigns);
            
            if (campaignIdsList.length === 0) {
                setAdSets([]);
                return;
            }
            
            // Step 1: Load basic data first (FAST)
            const response = await fetch(`/api/ads/basic?type=adsets&campaignIds=${campaignIdsList.join(',')}`);
            const result = await response.json();
            
            if (response.ok && result.data) {
                // Show basic data immediately
                setAdSets(result.data);
            }
            
            setLoadingAdSets(false);
            
            // Step 2: Load insights in background
            setLoadingInsights(true);
            setLoadingProgress({ current: 2, total: 2, label: 'ขั้นตอน (โหลดสถิติ)' });
            
            const dateParams = getDateParams();
            const apiUrl = `/api/ads/insights?type=adsets&campaignIds=${campaignIdsList.join(',')}${dateParams}`;
            const insightsResponse = await fetch(apiUrl);
            const insightsResult = await insightsResponse.json();
            
            if (insightsResponse.ok && insightsResult.data) {
                setAdSets(insightsResult.data);
            }
            
        } catch (error) {
            console.error('Failed to load ad sets:', error);
        } finally {
            setLoadingAdSets(false);
            setLoadingInsights(false);
            setLoadingProgress(null);
        }
    };

    // Load ads - Basic first, then insights
    const loadAdsByAdSets = async () => {
        try {
            setLoadingAdsByAdSets(true);
            setLoadingProgress({ current: 1, total: 2, label: 'ขั้นตอน (โหลดข้อมูลหลัก)' });
            
            const adSetIdsList = Array.from(selectedAdSets);
            
            if (adSetIdsList.length === 0) {
                setAdsByAdSets([]);
                return;
            }
            
            // Step 1: Load basic data first (FAST)
            const response = await fetch(`/api/ads/basic?type=ads&adSetIds=${adSetIdsList.join(',')}`);
            const result = await response.json();
            
            if (response.ok && result.data) {
                // Show basic data immediately
                setAdsByAdSets(result.data);
            }
            
            setLoadingAdsByAdSets(false);
            
            // Step 2: Load insights in background
            setLoadingInsights(true);
            setLoadingProgress({ current: 2, total: 2, label: 'ขั้นตอน (โหลดสถิติ)' });
            
            const dateParams = getDateParams();
            const apiUrl = `/api/ads/insights?type=ads&adSetIds=${adSetIdsList.join(',')}${dateParams}`;
            const insightsResponse = await fetch(apiUrl);
            const insightsResult = await insightsResponse.json();
            
            if (insightsResponse.ok && insightsResult.data) {
                setAdsByAdSets(insightsResult.data);
            }
            
        } catch (error) {
            console.error('Failed to load ads by ad sets:', error);
        } finally {
            setLoadingAdsByAdSets(false);
            setLoadingInsights(false);
            setLoadingProgress(null);
        }
    };

    // Refresh current tab data
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            switch (activeTab) {
                case 'Ad Accounts':
                    await loadAdAccounts();
                    break;
                case 'Campaigns':
                    if (selectedAccounts.size > 0) await loadCampaigns();
                    break;
                case 'Ad Sets':
                    if (selectedCampaigns.size > 0) await loadAdSets();
                    break;
                case 'Ads':
                    if (selectedAdSets.size > 0) await loadAdsByAdSets();
                    break;
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    const toggleAccountSelection = (accountId: string) => {
        setSelectedAccounts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(accountId)) {
                newSet.delete(accountId);
            } else {
                newSet.add(accountId);
            }
            return newSet;
        });
    };

    const toggleAllAccounts = () => {
        if (selectedAccounts.size === adAccounts.length) {
            setSelectedAccounts(new Set());
        } else {
            setSelectedAccounts(new Set(adAccounts.map(a => a.id)));
        }
    };

    const toggleCampaignSelection = (campaignId: string) => {
        setSelectedCampaigns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(campaignId)) {
                newSet.delete(campaignId);
            } else {
                newSet.add(campaignId);
            }
            return newSet;
        });
    };

    const toggleAllCampaigns = () => {
        if (selectedCampaigns.size === campaigns.length) {
            setSelectedCampaigns(new Set());
        } else {
            setSelectedCampaigns(new Set(campaigns.map(c => c.id)));
        }
    };

    const toggleAdSetSelection = (adsetId: string) => {
        setSelectedAdSets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(adsetId)) {
                newSet.delete(adsetId);
            } else {
                newSet.add(adsetId);
            }
            return newSet;
        });
    };

    const toggleAllAdSets = () => {
        if (selectedAdSets.size === adSets.length) {
            setSelectedAdSets(new Set());
        } else {
            setSelectedAdSets(new Set(adSets.map(a => a.id)));
        }
    };

    // Helper function to get currency symbol based on currency code
    const getCurrencySymbol = (currencyCode: string): string => {
        const symbols: Record<string, string> = {
            'THB': '฿',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CNY': '¥',
            'KRW': '₩',
            'VND': '₫',
            'MYR': 'RM',
            'SGD': 'S$',
            'PHP': '₱',
            'IDR': 'Rp',
            'INR': '₹',
            'AUD': 'A$',
            'CAD': 'C$',
            'HKD': 'HK$',
            'TWD': 'NT$',
        };
        return symbols[currencyCode] || currencyCode + ' ';
    };

    // Get currency from selected accounts (use first account's currency or default to THB)
    const getAccountCurrency = (accountId?: string): string => {
        if (accountId) {
            const account = adAccounts.find(a => a.id === accountId || a.id === `act_${accountId}`);
            if (account) return account.currency;
        }
        // Use first selected account's currency
        const firstSelectedAccountId = Array.from(selectedAccounts)[0];
        const firstAccount = adAccounts.find(a => a.id === firstSelectedAccountId);
        return firstAccount?.currency || 'THB';
    };

    // Format currency with proper symbol
    const formatCurrency = (amount: number, accountId?: string): string => {
        const currency = getAccountCurrency(accountId);
        const symbol = getCurrencySymbol(currency);
        return `${symbol}${amount.toLocaleString()}`;
    };

    const handleStatusToggle = async (adId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

        // Optimistic update
        setLocalData(prev => prev.map(ad =>
            ad.id === adId ? { ...ad, status: newStatus, delivery: newStatus } : ad
        ));

        const result = await updateAdStatusAction(accessToken, adId, newStatus);

        if (!result.success) {
            // Revert on failure
            setLocalData(prev => prev.map(ad =>
                ad.id === adId ? { ...ad, status: currentStatus, delivery: currentStatus } : ad
            ));
            alert('Failed to update status');
        }
    };

    const handleConnect = async (token: string) => {
        try {
            await saveFacebookAdToken(token);
            window.location.reload();
        } catch (e) {
            console.error("Failed to save token", e);
            alert("Failed to save token");
        }
    };

    const columns = React.useMemo<ColumnDef<AdData>[]>(() => [
        {
            id: "index",
            header: "#",
            cell: ({ row, table }) => {
                const pageIndex = table.getState().pagination.pageIndex;
                const pageSize = table.getState().pagination.pageSize;
                const rowIndex = table.getRowModel().rows.indexOf(row);
                return (
                    <div className="text-center text-gray-500 w-[30px]">
                        {pageIndex * pageSize + rowIndex + 1}
                    </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'status',
            header: 'On/Off',
            cell: ({ row }) => {
                const status = row.getValue('status') as string;
                const isActive = status === 'ACTIVE';
                return (
                    <Switch
                        checked={isActive}
                        onCheckedChange={() => handleStatusToggle(row.original.id, status)}
                        aria-label="Toggle ad status"
                        className="data-[state=checked]:bg-blue-500"
                    />
                );
            },
        },
        {
            accessorKey: 'accountName',
            header: 'Ad Account',
            cell: ({ row }) => {
                const name = row.getValue('accountName') as string;
                const accountId = row.original.accountId;
                if (!accountId) return <div className="font-medium text-gray-700">{name || 'N/A'}</div>;

                // Remove 'act_' prefix if present for the URL
                const cleanAccountId = accountId.replace(/^act_/, '');

                return (
                    <div className="flex flex-col">
                        <a
                            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAccountId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                        >
                            {name || 'N/A'}
                        </a>
                        <span className="text-xs text-gray-500">ID: {accountId}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'pageId',
            header: 'ID Page',
            cell: ({ row }) => {
                const pageId = row.original.pageId;
                const pageName = row.original.pageName;
                const pageUsername = row.original.pageUsername;

                if (!pageId) return <div className="text-gray-500">N/A</div>;

                return (
                    <div className="flex flex-col">
                        <a
                            href={`https://www.facebook.com/${pageId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                        >
                            {pageUsername || pageName || pageId}
                        </a>
                        <span className="text-xs text-gray-500">ID: {pageId}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'name',
            header: 'Ad Name',
            cell: ({ row }) => {
                const thumbnail = row.original.thumbnail;
                return (
                    <div className="flex items-center gap-3 min-w-[250px]">
                        {thumbnail && <img src={thumbnail} alt="Ad" className="w-12 h-12 object-cover rounded-md border border-gray-200" />}
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-900 line-clamp-2">{row.getValue('name')}</span>
                            <span className="text-xs text-gray-500">ID: {row.original.id}</span>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: 'delivery',
            header: 'Delivery',
            cell: ({ row }) => {
                const delivery = row.getValue('delivery') as string;
                return (
                    <Badge
                        variant={delivery === 'ACTIVE' ? 'default' : 'secondary'}
                        className={delivery === 'ACTIVE' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}
                    >
                        {delivery}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'budget',
            header: () => <div className="text-right">Budget</div>,
            cell: ({ row }) => {
                const budget = row.getValue('budget') as string;
                const currency = row.original.currency || 'USD';
                if (budget === 'N/A') return <div className="text-right text-gray-500">N/A</div>;

                const amount = parseFloat(budget) / 100;

                return (
                    <div className="text-right font-medium text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currency,
                            minimumFractionDigits: 2
                        }).format(amount)}
                    </div>
                );
            },
        },
        {
            accessorKey: 'results',
            header: ({ column }) => {
                return (
                    <div className="text-right">
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="p-0 hover:bg-transparent"
                        >
                            Results
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )
            },
            cell: ({ row }) => <div className="text-right font-medium text-gray-900">{new Intl.NumberFormat('en-US').format(row.getValue('results'))}</div>,
        },
        {
            accessorKey: 'reach',
            header: () => <div className="text-right">Reach</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('reach'))}</div>,
        },
        {
            accessorKey: 'impressions',
            header: () => <div className="text-right">Impressions</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('impressions'))}</div>,
        },
        {
            accessorKey: 'post_engagements',
            header: () => <div className="text-right">Post engagements</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('post_engagements'))}</div>,
        },
        {
            accessorKey: 'link_clicks',
            header: () => <div className="text-right">Link clicks</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('link_clicks'))}</div>,
        },
        {
            accessorKey: 'new_messaging_contact',
            header: () => <div className="text-right">New messaging contact</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('new_messaging_contact'))}</div>,
        },
        {
            accessorKey: 'spend',
            header: () => <div className="text-right">Amount spent</div>,
            cell: ({ row }) => {
                const spend = row.getValue('spend') as number;
                const currency = row.original.currency || 'USD';
                return (
                    <div className="text-right text-gray-700">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currency,
                            minimumFractionDigits: 2
                        }).format(spend)}
                    </div>
                );
            },
        },
        {
            accessorKey: 'video_avg_time',
            header: () => <div className="text-right">Video average time</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{row.getValue('video_avg_time')}</div>,
        },
        {
            accessorKey: 'video_plays',
            header: () => <div className="text-right">Video play</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_plays'))}</div>,
        },
        {
            accessorKey: 'video_3sec',
            header: () => <div className="text-right">3-second Video play</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_3sec'))}</div>,
        },
        {
            accessorKey: 'video_p25',
            header: () => <div className="text-right">Video play at 25%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p25'))}</div>,
        },
        {
            accessorKey: 'video_p50',
            header: () => <div className="text-right">Video play at 50%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p50'))}</div>,
        },
        {
            accessorKey: 'video_p75',
            header: () => <div className="text-right">Video play at 75%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p75'))}</div>,
        },
        {
            accessorKey: 'video_p95',
            header: () => <div className="text-right">Video play at 95%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p95'))}</div>,
        },
        {
            accessorKey: 'video_p100',
            header: () => <div className="text-right">Video play at 100%</div>,
            cell: ({ row }) => <div className="text-right text-gray-700">{new Intl.NumberFormat('en-US').format(row.getValue('video_p100'))}</div>,
        },
    ], [accessToken]);

    const table = useReactTable({
        data: localData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
        initialState: {
            pagination: {
                pageSize: 20,
            },
        },
    });

    const tabs = ['Ad Accounts', 'Campaigns', 'Ad Sets', 'Ads'];

    // Search state for each tab
    const [searchQuery, setSearchQuery] = React.useState('');

    return (
        <div className="w-full bg-white">
            {/* Tabs */}
            <div className="border-b border-gray-200 px-6 flex justify-between items-center">
                <div className="flex gap-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="py-2">
                    <ConnectModal onLogin={handleConnect} user={user} />
                </div>
            </div>

            {/* Filters & Search - Shared across all tabs */}
            <div className="p-4 flex items-center justify-between gap-4 border-b border-gray-100">
                <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                        placeholder={`Search ${activeTab.toLowerCase()}...`}
                        value={activeTab === 'Ads' ? (table.getColumn("name")?.getFilterValue() as string) ?? "" : searchQuery}
                        onChange={(event) => {
                            if (activeTab === 'Ads') {
                                table.getColumn("name")?.setFilterValue(event.target.value);
                            } else {
                                setSearchQuery(event.target.value);
                            }
                        }}
                        className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshData()}
                        disabled={isRefreshing}
                        className="bg-white border-gray-200 hover:bg-gray-50 gap-1.5"
                        title="รีเฟรชข้อมูลจากฐานข้อมูล"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span className="text-xs">รีเฟรช</span>
                    </Button>

                    {/* Sync Status - Shows when data was last synced from Facebook */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                        {lastSyncAt ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs text-gray-600">
                                    Sync: {lastSyncAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-xs text-gray-400">(อัพเดททุก 5 นาที)</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                <span className="text-xs text-gray-600">รอ Sync...</span>
                            </>
                        )}
                    </div>
                    
                    {/* Date Range Picker */}
                    {date && setDate && (
                        <div className="bg-white rounded-md border border-gray-200">
                            <DatePickerWithRange date={date} setDate={setDate} className="border-0" />
                        </div>
                    )}
                    <Select
                        value={(table.getColumn("delivery")?.getFilterValue() as string) ?? "ALL"}
                        onValueChange={(value) => {
                            if (value === "ALL") {
                                table.getColumn("delivery")?.setFilterValue(undefined);
                            } else {
                                table.getColumn("delivery")?.setFilterValue(value);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[150px] bg-white border-gray-200">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" className="border-gray-200 text-gray-500">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="border-gray-200 text-gray-500">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Ad Accounts Tab Content */}
            {activeTab === 'Ad Accounts' && (
                <div className="p-4">
                    {loadingAccounts ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : adAccounts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ไม่พบบัญชีโฆษณา กรุณากด Sync เพื่อดึงข้อมูล
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <Table className="border-collapse">
                                <TableHeader className="bg-gray-50">
                                    <TableRow className="border-b border-gray-200">
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center w-12">#</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 w-14">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={selectedAccounts.size === sortedAccounts.length && sortedAccounts.length > 0}
                                                    onCheckedChange={toggleAllAccounts}
                                                    aria-label="Select all"
                                                    className="h-5 w-5"
                                                />
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                            <SortableHeader label="ชื่อบัญชี" sortKey="name" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                            <SortableHeader label="สกุลเงิน" sortKey="currency" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-center" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                            <SortableHeader label="สถานะ" sortKey="accountStatus" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-center" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                            <SortableHeader label="Timezone" sortKey="timezone" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-center" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="โฆษณาทั้งหมด" sortKey="totalAds" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="Active" sortKey="activeAds" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="Paused" sortKey="pausedAds" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="ใช้จ่ายรวม" sortKey="totalSpend" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="Impressions" sortKey="totalImpressions" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="Reach" sortKey="totalReach" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="Clicks" sortKey="totalClicks" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="CTR" sortKey="ctr" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right border-r border-gray-200">
                                            <SortableHeader label="CPM" sortKey="cpm" currentSort={accountSort} onSort={(key) => handleSort(key, accountSort, setAccountSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAccounts.map((account, index) => {
                                        const cleanAccountId = account.id.replace(/^act_/, '');
                                        const statusMap: { [key: number]: { label: string; color: string } } = {
                                            1: { label: 'ACTIVE', color: 'bg-green-100 text-green-700' },
                                            2: { label: 'DISABLED', color: 'bg-red-100 text-red-700' },
                                            3: { label: 'UNSETTLED', color: 'bg-yellow-100 text-yellow-700' },
                                            7: { label: 'PENDING_REVIEW', color: 'bg-orange-100 text-orange-700' },
                                            8: { label: 'PENDING_CLOSURE', color: 'bg-gray-100 text-gray-700' },
                                            9: { label: 'IN_GRACE_PERIOD', color: 'bg-blue-100 text-blue-700' },
                                            100: { label: 'PENDING_RISK_REVIEW', color: 'bg-purple-100 text-purple-700' },
                                            101: { label: 'PENDING_SETTLEMENT', color: 'bg-indigo-100 text-indigo-700' },
                                            201: { label: 'ANY_ACTIVE', color: 'bg-green-100 text-green-700' },
                                            202: { label: 'ANY_CLOSED', color: 'bg-gray-100 text-gray-700' },
                                        };
                                        const status = statusMap[account.accountStatus] || { label: 'UNKNOWN', color: 'bg-gray-100 text-gray-700' };
                                        
                                        return (
                                            <TableRow key={account.id} className="border-b border-gray-200 hover:bg-blue-50/50">
                                                <TableCell className="text-gray-500 border-r border-gray-200 text-center">{index + 1}</TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={selectedAccounts.has(account.id)}
                                                            onCheckedChange={() => toggleAccountSelection(account.id)}
                                                            aria-label={`Select ${account.name}`}
                                                            className="h-5 w-5"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <a
                                                            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAccountId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-medium text-blue-600 hover:underline"
                                                        >
                                                            {account.name}
                                                        </a>
                                                        <span className="text-xs text-gray-500">ID: {account.accountId}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-center">
                                                    <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-center">
                                                    <Badge className={`${status.color} text-xs`}>{status.label}</Badge>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-center text-sm text-gray-600">
                                                    {account.timezone} | {account.timezoneOffset >= 0 ? '+' : ''}{account.timezoneOffset}
                                                </TableCell>
                                                <TableCell className="text-right font-medium border-r border-gray-200">
                                                    {account.totalAds !== null ? account.totalAds : <span className="text-gray-400">-</span>}
                                                </TableCell>
                                                <TableCell className="text-right text-green-600 border-r border-gray-200">
                                                    {account.activeAds !== null ? account.activeAds : <span className="text-gray-400">-</span>}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-500 border-r border-gray-200">
                                                    {account.pausedAds !== null ? account.pausedAds : <span className="text-gray-400">-</span>}
                                                </TableCell>
                                                <TableCell className="text-right font-medium border-r border-gray-200">
                                                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: account.currency }).format(account.totalSpend)}
                                                </TableCell>
                                                <TableCell className="text-right border-r border-gray-200">{new Intl.NumberFormat().format(account.totalImpressions)}</TableCell>
                                                <TableCell className="text-right border-r border-gray-200">{new Intl.NumberFormat().format(account.totalReach)}</TableCell>
                                                <TableCell className="text-right border-r border-gray-200">{new Intl.NumberFormat().format(account.totalClicks)}</TableCell>
                                                <TableCell className="text-right border-r border-gray-200">{account.ctr.toFixed(2)}%</TableCell>
                                                <TableCell className="text-right border-r border-gray-200">
                                                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: account.currency }).format(account.cpm)}
                                                </TableCell>
                                                <TableCell>
                                                    <a
                                                        href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAccountId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        จัดการ
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* Campaigns Tab Content */}
            {activeTab === 'Campaigns' && (
                <div className="p-4">
                    {selectedAccounts.size === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-lg font-medium mb-2">กรุณาเลือก Ad Account ก่อน</div>
                            <p>ไปที่แท็บ Ad Accounts และติ๊กเลือกบัญชีที่ต้องการดู Campaigns</p>
                        </div>
                    ) : loadingCampaigns ? (
                        <div className="flex flex-col justify-center items-center h-48 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            {loadingProgress && (
                                <div className="text-sm text-gray-500">
                                    กำลังโหลด {loadingProgress.current}/{loadingProgress.total} {loadingProgress.label}...
                                </div>
                            )}
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ไม่พบ Campaigns ในบัญชีที่เลือก
                        </div>
                    ) : (
                        <>
                            {loadingInsights && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm rounded-t-lg">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    กำลังโหลดสถิติ...
                                </div>
                            )}
                            <div className="overflow-x-auto border rounded-lg">
                                <Table className="border-collapse">
                                    <TableHeader className="bg-gray-50">
                                        <TableRow className="border-b border-gray-200">
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center w-12">#</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 w-14">
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={selectedCampaigns.size === sortedCampaigns.length && sortedCampaigns.length > 0}
                                                        onCheckedChange={toggleAllCampaigns}
                                                    aria-label="Select all"
                                                    className="h-5 w-5"
                                                />
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">On/Off</TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                            <SortableHeader label="Campaign Name" sortKey="name" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                            <SortableHeader label="Status" sortKey="effectiveStatus" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-center" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                            <SortableHeader label="Objective" sortKey="objective" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-center" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Budget" sortKey="dailyBudget" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Spend" sortKey="spend" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Results" sortKey="results" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Reach" sortKey="reach" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Impressions" sortKey="impressions" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Clicks" sortKey="clicks" currentSort={campaignSort} onSort={(key) => handleSort(key, campaignSort, setCampaignSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedCampaigns.map((campaign, index) => {
                                        const cleanAccountId = (campaign.adAccountId || '').replace(/^act_/, '');
                                        const isActive = campaign.effectiveStatus === 'ACTIVE';
                                        const budget = campaign.dailyBudget || campaign.lifetimeBudget || 0;
                                        const budgetType = campaign.dailyBudget ? '/day' : '';
                                        
                                        return (
                                            <TableRow key={campaign.id} className="border-b border-gray-200 hover:bg-blue-50/50">
                                                <TableCell className="text-gray-500 border-r border-gray-200 text-center">{index + 1}</TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={selectedCampaigns.has(campaign.id)}
                                                            onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                                                            aria-label={`Select ${campaign.name}`}
                                                            className="h-5 w-5"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <Switch
                                                        checked={isActive}
                                                        className="data-[state=checked]:bg-blue-500"
                                                    />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{campaign.name}</span>
                                                        <span className="text-xs text-gray-500">ID: {campaign.id}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <StatusBadge status={campaign.effectiveStatus || campaign.status} translatedStatus={translateStatus(campaign.effectiveStatus || campaign.status)} />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-center">
                                                    <Badge variant="outline" className="text-xs">{campaign.objective}</Badge>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {budget > 0 ? `${formatCurrency(budget, campaign.adAccountId)}${budgetType}` : '-'}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right font-medium">
                                                    {renderInsightValue(campaign.spend, (v) => formatCurrency(v, campaign.adAccountId))}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(campaign.results)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(campaign.reach)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(campaign.impressions)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(campaign.clicks)}
                                                </TableCell>
                                                <TableCell>
                                                    <a
                                                        href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAccountId}&campaign_ids=${campaign.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        จัดการ
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        </>
                    )}
                </div>
            )}

            {/* Ad Sets Tab Content */}
            {activeTab === 'Ad Sets' && (
                <div className="p-4">
                    {selectedCampaigns.size === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-lg font-medium mb-2">กรุณาเลือก Campaign ก่อน</div>
                            <p>ไปที่แท็บ Campaigns และติ๊กเลือก Campaign ที่ต้องการดู Ad Sets</p>
                        </div>
                    ) : loadingAdSets ? (
                        <div className="flex flex-col justify-center items-center h-48 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            {loadingProgress && (
                                <div className="text-sm text-gray-500">
                                    กำลังโหลด {loadingProgress.current}/{loadingProgress.total} {loadingProgress.label}...
                                </div>
                            )}
                        </div>
                    ) : adSets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ไม่พบ Ad Sets ใน Campaign ที่เลือก
                        </div>
                    ) : (
                        <>
                            {loadingInsights && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm rounded-t-lg">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    กำลังโหลดสถิติ...
                                </div>
                            )}
                            <div className="overflow-x-auto border rounded-lg">
                                <Table className="border-collapse">
                                    <TableHeader className="bg-gray-50">
                                        <TableRow className="border-b border-gray-200">
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center w-12">#</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 w-14">
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={selectedAdSets.size === sortedAdSets.length && sortedAdSets.length > 0}
                                                        onCheckedChange={toggleAllAdSets}
                                                        aria-label="Select all"
                                                        className="h-5 w-5"
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">On/Off</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                                <SortableHeader label="Ad Set Name" sortKey="name" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                                <SortableHeader label="Status" sortKey="effectiveStatus" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-center" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center">
                                                <SortableHeader label="Optimization" sortKey="optimizationGoal" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-center" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Budget" sortKey="dailyBudget" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Spend" sortKey="spend" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Results" sortKey="results" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Reach" sortKey="reach" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                            </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Impressions" sortKey="impressions" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Clicks" sortKey="clicks" currentSort={adSetSort} onSort={(key) => handleSort(key, adSetSort, setAdSetSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAdSets.map((adset, index) => {
                                        const cleanAccountId = (adset.adAccountId || '').replace(/^act_/, '');
                                        const isActive = adset.effectiveStatus === 'ACTIVE';
                                        const budget = adset.dailyBudget || adset.lifetimeBudget || 0;
                                        const budgetType = adset.dailyBudget ? '/day' : '';
                                        
                                        return (
                                            <TableRow key={adset.id} className="border-b border-gray-200 hover:bg-blue-50/50">
                                                <TableCell className="text-gray-500 border-r border-gray-200 text-center">{index + 1}</TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={selectedAdSets.has(adset.id)}
                                                            onCheckedChange={() => toggleAdSetSelection(adset.id)}
                                                            aria-label={`Select ${adset.name}`}
                                                            className="h-5 w-5"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <Switch
                                                        checked={isActive}
                                                        className="data-[state=checked]:bg-blue-500"
                                                    />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{adset.name}</span>
                                                        <span className="text-xs text-gray-500">ID: {adset.id}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <StatusBadge status={adset.effectiveStatus || adset.status} translatedStatus={translateStatus(adset.effectiveStatus || adset.status)} />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-center">
                                                    <Badge variant="outline" className="text-xs">{adset.optimizationGoal}</Badge>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {budget > 0 ? `${formatCurrency(budget, adset.adAccountId)}${budgetType}` : '-'}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right font-medium">
                                                    {renderInsightValue(adset.spend, (v) => formatCurrency(v, adset.adAccountId))}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(adset.results)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(adset.reach)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(adset.impressions)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(adset.clicks)}
                                                </TableCell>
                                                <TableCell>
                                                    <a
                                                        href={`https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${cleanAccountId}&adset_ids=${adset.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        จัดการ
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        </>
                    )}
                </div>
            )}

            {/* Ads Tab Content */}
            {activeTab === 'Ads' && (
                <div className="p-4">
                    {selectedAdSets.size === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="text-lg font-medium mb-2">กรุณาเลือก Ad Set ก่อน</div>
                            <p>ไปที่แท็บ Ad Sets และติ๊กเลือก Ad Set ที่ต้องการดู Ads</p>
                        </div>
                    ) : loadingAdsByAdSets ? (
                        <div className="flex flex-col justify-center items-center h-48 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            {loadingProgress && (
                                <div className="text-sm text-gray-500">
                                    กำลังโหลด {loadingProgress.current}/{loadingProgress.total} {loadingProgress.label}...
                                </div>
                            )}
                        </div>
                    ) : adsByAdSets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ไม่พบ Ads ใน Ad Set ที่เลือก
                        </div>
                    ) : (
                        <>
                            {loadingInsights && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm rounded-t-lg">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    กำลังโหลดสถิติ...
                                </div>
                            )}
                            <div className="overflow-x-auto border rounded-lg">
                                <Table className="border-collapse">
                                    <TableHeader className="bg-gray-50">
                                        <TableRow className="border-b border-gray-200">
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-center w-12">#</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">On/Off</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                                <SortableHeader label="Page" sortKey="pageName" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">Preview</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                                <SortableHeader label="Ad Name" sortKey="name" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">
                                                <SortableHeader label="Status" sortKey="effectiveStatus" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Budget" sortKey="budget" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Results" sortKey="results" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Reach" sortKey="reach" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Impressions" sortKey="impressions" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Post Engagements" sortKey="postEngagements" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                                <SortableHeader label="Clicks" sortKey="clicks" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                            </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="New Messaging Contacts" sortKey="newMessagingContacts" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Spend" sortKey="spend" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Cost/Msg Contact" sortKey="costPerNewMessagingContact" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Video Avg Time" sortKey="videoAvgTime" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="Video Plays" sortKey="videoPlays" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="3-sec Plays" sortKey="video3sec" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="25%" sortKey="videoP25" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="50%" sortKey="videoP50" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="75%" sortKey="videoP75" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="95%" sortKey="videoP95" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase border-r border-gray-200 text-right">
                                            <SortableHeader label="100%" sortKey="videoP100" currentSort={adsSort} onSort={(key) => handleSort(key, adsSort, setAdsSort)} className="justify-end" />
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold text-gray-500 uppercase">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAds.map((ad, index) => {
                                        const cleanAccountId = ad.adAccountId?.replace(/^act_/, '') || '';
                                        const isActive = ad.effectiveStatus === 'ACTIVE';
                                        
                                        return (
                                            <TableRow key={ad.id} className="border-b border-gray-200 hover:bg-blue-50/50">
                                                <TableCell className="text-gray-500 border-r border-gray-200 text-center">{index + 1}</TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <Switch
                                                        checked={isActive}
                                                        className="data-[state=checked]:bg-blue-500"
                                                    />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900 text-sm">{ad.pageName || '-'}</span>
                                                        <span className="text-xs text-gray-500">{ad.pageId || '-'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    {ad.thumbnailUrl ? (
                                                        <img 
                                                            src={ad.thumbnailUrl} 
                                                            alt={ad.name}
                                                            className="w-12 h-12 object-cover rounded"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                                            <span className="text-gray-400 text-xs">No img</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{ad.name}</span>
                                                        <span className="text-xs text-gray-500">ID: {ad.id}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200">
                                                    <StatusBadge status={ad.effectiveStatus} translatedStatus={translateStatus(ad.effectiveStatus)} />
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {ad.budget > 0 ? formatCurrency(ad.budget, ad.adAccountId) : '-'}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.results)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.reach)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.impressions)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.postEngagements)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.clicks)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.newMessagingContacts)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right font-medium">
                                                    {renderInsightValue(ad.spend, (v) => formatCurrency(v, ad.adAccountId))}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {ad.costPerNewMessagingContact !== null && ad.costPerNewMessagingContact > 0 
                                                        ? formatCurrency(ad.costPerNewMessagingContact, ad.adAccountId) 
                                                        : renderInsightValue(ad.costPerNewMessagingContact)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {ad.videoAvgTime !== null && ad.videoAvgTime > 0 ? `${ad.videoAvgTime.toFixed(1)}s` : renderInsightValue(ad.videoAvgTime)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoPlays)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.video3sec)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoP25)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoP50)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoP75)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoP95)}
                                                </TableCell>
                                                <TableCell className="border-r border-gray-200 text-right">
                                                    {renderInsightValue(ad.videoP100)}
                                                </TableCell>
                                                <TableCell>
                                                    <a
                                                        href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${cleanAccountId}&selected_ad_ids=${ad.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        จัดการ
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
