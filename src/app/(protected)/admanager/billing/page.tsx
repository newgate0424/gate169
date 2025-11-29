'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    CreditCard,
    Download,
    Calendar,
    DollarSign,
    FileText,
    CheckCircle2
} from 'lucide-react';

export default function BillingPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();

    const invoices = [
        { id: 'INV-001', date: '2024-01-01', amount: 99.00, status: 'Paid' },
        { id: 'INV-002', date: '2024-02-01', amount: 99.00, status: 'Paid' },
        { id: 'INV-003', date: '2024-03-01', amount: 99.00, status: 'Paid' },
    ];

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-4 md:gap-6">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t('billing.title')}</h1>

                {/* Current Plan */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <CreditCard className="h-5 w-5" />
                            {t('billing.currentPlan')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg md:text-xl font-semibold">{t('billing.professionalPlan')}</h3>
                                <p className="text-gray-600 mt-1 text-sm md:text-base">$99{t('billing.perMonth')} • {t('billing.billedMonthly')}</p>
                                <p className="text-xs md:text-sm text-gray-500 mt-2">{t('billing.nextBilling')}: April 1, 2024</p>
                            </div>
                            <Button variant="outline" className="w-full md:w-auto">{t('billing.upgradePlan')}</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Method */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <CreditCard className="h-5 w-5" />
                            {t('billing.paymentMethod')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    VISA
                                </div>
                                <div>
                                    <p className="font-medium text-sm md:text-base">•••• •••• •••• 4242</p>
                                    <p className="text-xs md:text-sm text-gray-500">{t('billing.expires')} 12/2025</p>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full md:w-auto">{t('billing.update')}</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Billing History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <FileText className="h-5 w-5" />
                            {t('billing.history')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 md:space-y-4">
                            {invoices.map((invoice) => (
                                <div key={invoice.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <Calendar className="h-4 w-4 md:h-5 md:w-5 text-gray-400 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-sm md:text-base">{invoice.id}</p>
                                            <p className="text-xs md:text-sm text-gray-500">{invoice.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4">
                                        <div className="text-left md:text-right">
                                            <p className="font-semibold text-sm md:text-base">${invoice.amount.toFixed(2)}</p>
                                            <div className="flex items-center gap-1 text-xs md:text-sm text-green-600">
                                                <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" />
                                                {t('billing.paid')}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                                            <Download className="h-4 w-4" />
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
