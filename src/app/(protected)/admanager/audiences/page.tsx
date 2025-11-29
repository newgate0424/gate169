'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Users,
    Plus,
    Search,
    MoreVertical,
    TrendingUp,
    Target,
    UserPlus
} from 'lucide-react';

export default function AudiencesPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    const audiences = [
        {
            id: 1,
            name: 'High-Value Customers',
            size: 12500,
            type: 'Custom Audience',
            status: 'Active',
            lastUpdated: '2024-03-15'
        },
        {
            id: 2,
            name: 'Cart Abandoners',
            size: 8900,
            type: 'Retargeting',
            status: 'Active',
            lastUpdated: '2024-03-14'
        },
        {
            id: 3,
            name: 'Newsletter Subscribers',
            size: 25600,
            type: 'Email List',
            status: 'Active',
            lastUpdated: '2024-03-13'
        },
        {
            id: 4,
            name: 'Website Visitors (30 days)',
            size: 45300,
            type: 'Website Traffic',
            status: 'Active',
            lastUpdated: '2024-03-12'
        },
        {
            id: 5,
            name: 'Lookalike - Top Buyers',
            size: 150000,
            type: 'Lookalike',
            status: 'Active',
            lastUpdated: '2024-03-11'
        },
    ];

    const filteredAudiences = audiences.filter(audience =>
        audience.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        audience.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-4 md:gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t('audiences.title')}</h1>
                        <p className="text-gray-600 mt-1 text-sm md:text-base">{t('audiences.subtitle')}</p>
                    </div>
                    <Button className="gap-2 bg-blue-500 hover:bg-blue-600 w-full md:w-auto justify-center">
                        <Plus className="h-4 w-4" />
                        {t('audiences.createAudience')}
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <Card>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs md:text-sm text-gray-600">{t('audiences.totalAudiences')}</p>
                                    <p className="text-xl md:text-2xl font-bold mt-1 md:mt-2">{audiences.length}</p>
                                </div>
                                <div className="p-2 md:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                                    <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs md:text-sm text-gray-600">{t('audiences.totalReach')}</p>
                                    <p className="text-xl md:text-2xl font-bold mt-1 md:mt-2">242,300</p>
                                </div>
                                <div className="p-2 md:p-3 bg-green-50 rounded-lg flex-shrink-0">
                                    <Target className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs md:text-sm text-gray-600">{t('audiences.activeCampaigns')}</p>
                                    <p className="text-xl md:text-2xl font-bold mt-1 md:mt-2">8</p>
                                </div>
                                <div className="p-2 md:p-3 bg-purple-50 rounded-lg flex-shrink-0">
                                    <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card>
                    <CardContent className="p-3 md:p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={t('audiences.search')}
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Audiences List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <Users className="h-5 w-5" />
                            {t('audiences.yourAudiences')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {filteredAudiences.map((audience) => (
                                <div
                                    key={audience.id}
                                    className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3"
                                >
                                    <div className="flex items-start md:items-center gap-3 md:gap-4 flex-1 min-w-0">
                                        <div className="p-2 md:p-3 bg-blue-50 rounded-lg flex-shrink-0">
                                            <UserPlus className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">{audience.name}</h3>
                                            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-gray-500">
                                                <span>{audience.type}</span>
                                                <span className="hidden sm:inline">•</span>
                                                <span>
                                                    {audience.size.toLocaleString()} {t('audiences.people')}
                                                </span>
                                                <span className="hidden md:inline">•</span>
                                                <span className="hidden md:inline">
                                                    {t('audiences.updated')} {audience.lastUpdated}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-3">
                                        <span className="px-2 md:px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                            {t('audiences.active')}
                                        </span>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
