'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    BarChart3,
    TrendingUp,
    Users,
    MousePointerClick,
    Eye,
    DollarSign,
    Calendar,
    Download
} from 'lucide-react';

export default function ReportsPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();

    const stats = [
        { label: t('reports.totalImpressions'), value: '1,234,567', icon: Eye, change: '+12.5%', trend: 'up' },
        { label: t('reports.totalClicks'), value: '45,678', icon: MousePointerClick, change: '+8.3%', trend: 'up' },
        { label: t('reports.totalConversions'), value: '2,345', icon: TrendingUp, change: '+15.2%', trend: 'up' },
        { label: t('reports.totalSpend'), value: '$12,345', icon: DollarSign, change: '+5.1%', trend: 'up' },
    ];

    const campaigns = [
        { name: 'Summer Sale 2024', impressions: 456789, clicks: 12345, conversions: 789, spend: 4500 },
        { name: 'Product Launch', impressions: 345678, clicks: 10234, conversions: 654, spend: 3800 },
        { name: 'Brand Awareness', impressions: 234567, clicks: 8901, conversions: 456, spend: 2900 },
        { name: 'Retargeting Campaign', impressions: 197533, clicks: 14199, conversions: 446, spend: 1145 },
    ];

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-4 md:gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full md:w-auto">
                        <Button variant="outline" className="gap-2 justify-center">
                            <Calendar className="h-4 w-4" />
                            {t('reports.last30Days')}
                        </Button>
                        <Button className="gap-2 bg-blue-500 hover:bg-blue-600 justify-center">
                            <Download className="h-4 w-4" />
                            {t('reports.exportReport')}
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <Card key={stat.label}>
                                <CardContent className="p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs md:text-sm text-gray-600">{stat.label}</p>
                                            <p className="text-xl md:text-2xl font-bold mt-1 md:mt-2">{stat.value}</p>
                                            <p className="text-xs md:text-sm text-green-600 mt-1">{stat.change}</p>
                                        </div>
                                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                                            <Icon className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Campaign Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <BarChart3 className="h-5 w-5" />
                            {t('reports.campaignPerformance')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                            <div className="inline-block min-w-full align-middle">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm">{t('reports.campaignName')}</th>
                                            <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm">{t('reports.impressions')}</th>
                                            <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm hidden sm:table-cell">{t('reports.clicks')}</th>
                                            <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm hidden md:table-cell">{t('reports.conversions')}</th>
                                            <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm">{t('reports.spend')}</th>
                                            <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-gray-700 text-xs md:text-sm">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((campaign) => {
                                            const ctr = ((campaign.clicks / campaign.impressions) * 100).toFixed(2);
                                            return (
                                                <tr key={campaign.name} className="border-b hover:bg-gray-50 transition-colors">
                                                    <td className="py-2 md:py-3 px-2 md:px-4 font-medium text-xs md:text-sm">{campaign.name}</td>
                                                    <td className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">{campaign.impressions.toLocaleString()}</td>
                                                    <td className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm hidden sm:table-cell">{campaign.clicks.toLocaleString()}</td>
                                                    <td className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm hidden md:table-cell">{campaign.conversions.toLocaleString()}</td>
                                                    <td className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">${campaign.spend.toLocaleString()}</td>
                                                    <td className="text-right py-2 md:py-3 px-2 md:px-4 text-green-600 font-medium text-xs md:text-sm">{ctr}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
