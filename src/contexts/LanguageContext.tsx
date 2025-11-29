'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'th' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations = {
    th: {
        // Header
        'header.overview': 'ภาพรวม',
        'header.adbox': 'ข้อความ',
        'header.admanager': 'จัดการโฆษณา',
        'header.settings': 'การตั้งค่า',
        'header.logout': 'ออกจากระบบ',

        // Sidebar
        'sidebar.overview': 'ภาพรวม',
        'sidebar.adbox': 'ข้อความ',
        'sidebar.admanager': 'จัดการโฆษณา',
        'sidebar.audiences': 'กลุ่มเป้าหมาย',
        'sidebar.reports': 'รายงาน',
        'sidebar.billing': 'การเรียกเก็บเงิน',
        'sidebar.settings': 'การตั้งค่า',

        // Overview Page
        'overview.title': 'แผงควบคุม',
        'overview.search': 'ค้นหา',
        'overview.refresh': 'รีเฟรช',
        'overview.addConnection': 'เพิ่มการเชื่อมต่อ',
        'overview.multiMode': 'หลายโหมด',
        'overview.all': 'ทั้งหมด',
        'overview.facebook': 'Facebook',
        'overview.close': 'ปิด',

        // Connect Platform Dialog
        'connect.title': 'เชื่อมต่อแพลตฟอร์ม',
        'connect.subtitle': 'เลือกแพลตฟอร์มที่คุณต้องการเชื่อมต่อ',
        'connect.facebook': 'Facebook',
        'connect.facebookDesc': 'เชื่อมต่อเพจ Facebook ของคุณ',
        'connect.instagram': 'Instagram',
        'connect.instagramDesc': 'เชื่อมต่อบัญชี Instagram ของคุณ',
        'connect.line': 'LINE',
        'connect.lineDesc': 'เชื่อมต่อบัญชี LINE Official ของคุณ',
        'connect.connectButton': 'เชื่อมต่อ',
        'connect.comingSoon': 'เร็วๆ นี้',

        // AdBox Page
        'adbox.chat': 'แชท',
        'adbox.search': 'ค้นหาข้อความ...',
        'adbox.all': 'ทั้งหมด',
        'adbox.unread': 'ยังไม่ได้อ่าน',
        'adbox.read': 'อ่านแล้ว',
        'adbox.selectPages': 'เลือกเพจ',
        'adbox.choosePages': 'เลือกเพจที่คุณต้องการดูข้อความ',
        'adbox.pagesAvailable': 'เพจที่มี',
        'adbox.selectAll': 'เลือกทั้งหมด',
        'adbox.deselectAll': 'ยกเลิกทั้งหมด',
        'adbox.cancel': 'ยกเลิก',
        'adbox.applyChanges': 'ใช้การเปลี่ยนแปลง',
        'adbox.typeMessage': 'พิมพ์ข้อความ...',
        'adbox.newMessage': 'ข้อความใหม่',

        // Billing Page
        'billing.title': 'การเรียกเก็บเงินและการชำระเงิน',
        'billing.currentPlan': 'แพ็กเกจปัจจุบัน',
        'billing.professionalPlan': 'แพ็กเกจมืออาชีพ',
        'billing.perMonth': '/เดือน',
        'billing.billedMonthly': 'เรียกเก็บรายเดือน',
        'billing.nextBilling': 'วันเรียกเก็บเงินครั้งถัดไป',
        'billing.upgradePlan': 'อัพเกรดแพ็กเกจ',
        'billing.paymentMethod': 'วิธีการชำระเงิน',
        'billing.expires': 'หมดอายุ',
        'billing.update': 'อัพเดท',
        'billing.history': 'ประวัติการเรียกเก็บเงิน',
        'billing.paid': 'ชำระแล้ว',

        // Reports Page
        'reports.title': 'รายงานและการวิเคราะห์',
        'reports.last30Days': '30 วันที่ผ่านมา',
        'reports.exportReport': 'ส่งออกรายงาน',
        'reports.totalImpressions': 'การแสดงผลทั้งหมด',
        'reports.totalClicks': 'การคลิกทั้งหมด',
        'reports.totalConversions': 'การแปลงทั้งหมด',
        'reports.totalSpend': 'ค่าใช้จ่ายทั้งหมด',
        'reports.campaignPerformance': 'ผลการดำเนินงานแคมเปญ',
        'reports.campaignName': 'ชื่อแคมเปญ',
        'reports.impressions': 'การแสดงผล',
        'reports.clicks': 'การคลิก',
        'reports.conversions': 'การแปลง',
        'reports.spend': 'ค่าใช้จ่าย',

        // Audiences Page
        'audiences.title': 'กลุ่มเป้าหมาย',
        'audiences.subtitle': 'จัดการและสร้างกลุ่มเป้าหมายสำหรับแคมเปญของคุณ',
        'audiences.createAudience': 'สร้างกลุ่มเป้าหมาย',
        'audiences.totalAudiences': 'กลุ่มเป้าหมายทั้งหมด',
        'audiences.totalReach': 'การเข้าถึงทั้งหมด',
        'audiences.activeCampaigns': 'แคมเปญที่ใช้งาน',
        'audiences.search': 'ค้นหากลุ่มเป้าหมาย...',
        'audiences.yourAudiences': 'กลุ่มเป้าหมายของคุณ',
        'audiences.people': 'คน',
        'audiences.updated': 'อัพเดท',
        'audiences.active': 'ใช้งาน',
    },
    en: {
        // Header
        'header.overview': 'Overview',
        'header.adbox': 'AdBox',
        'header.admanager': 'Ad Manager',
        'header.settings': 'Settings',
        'header.logout': 'Log out',

        // Sidebar
        'sidebar.overview': 'Overview',
        'sidebar.adbox': 'AdBox',
        'sidebar.admanager': 'Ad Manager',
        'sidebar.audiences': 'Audiences',
        'sidebar.reports': 'Reports',
        'sidebar.billing': 'Billing',
        'sidebar.settings': 'Settings',

        // Overview Page
        'overview.title': 'Dashboard',
        'overview.search': 'Search',
        'overview.refresh': 'Refresh',
        'overview.addConnection': 'Add Connection',
        'overview.multiMode': 'Multi Mode',
        'overview.all': 'All',
        'overview.facebook': 'Facebook',
        'overview.close': 'Close',

        // Connect Platform Dialog
        'connect.title': 'Connect Platform',
        'connect.subtitle': 'Choose the platform you want to connect',
        'connect.facebook': 'Facebook',
        'connect.facebookDesc': 'Connect your Facebook pages',
        'connect.instagram': 'Instagram',
        'connect.instagramDesc': 'Connect your Instagram account',
        'connect.line': 'LINE',
        'connect.lineDesc': 'Connect your LINE Official Account',
        'connect.connectButton': 'Connect',
        'connect.comingSoon': 'Coming Soon',

        // AdBox Page
        'adbox.chat': 'Chat',
        'adbox.search': 'Search messages...',
        'adbox.all': 'All',
        'adbox.unread': 'Unread',
        'adbox.read': 'Read',
        'adbox.selectPages': 'Select Pages',
        'adbox.choosePages': 'Choose which pages you want to see messages from',
        'adbox.pagesAvailable': 'Pages Available',
        'adbox.selectAll': 'Select All',
        'adbox.deselectAll': 'Deselect All',
        'adbox.cancel': 'Cancel',
        'adbox.applyChanges': 'Apply Changes',
        'adbox.typeMessage': 'Type a message...',
        'adbox.newMessage': 'New Message',

        // Billing Page
        'billing.title': 'Billing & Payments',
        'billing.currentPlan': 'Current Plan',
        'billing.professionalPlan': 'Professional Plan',
        'billing.perMonth': '/month',
        'billing.billedMonthly': 'Billed monthly',
        'billing.nextBilling': 'Next billing date',
        'billing.upgradePlan': 'Upgrade Plan',
        'billing.paymentMethod': 'Payment Method',
        'billing.expires': 'Expires',
        'billing.update': 'Update',
        'billing.history': 'Billing History',
        'billing.paid': 'Paid',

        // Reports Page
        'reports.title': 'Reports & Analytics',
        'reports.last30Days': 'Last 30 Days',
        'reports.exportReport': 'Export Report',
        'reports.totalImpressions': 'Total Impressions',
        'reports.totalClicks': 'Total Clicks',
        'reports.totalConversions': 'Total Conversions',
        'reports.totalSpend': 'Total Spend',
        'reports.campaignPerformance': 'Campaign Performance',
        'reports.campaignName': 'Campaign Name',
        'reports.impressions': 'Impressions',
        'reports.clicks': 'Clicks',
        'reports.conversions': 'Conversions',
        'reports.spend': 'Spend',

        // Audiences Page
        'audiences.title': 'Audiences',
        'audiences.subtitle': 'Manage and create custom audiences for your campaigns',
        'audiences.createAudience': 'Create Audience',
        'audiences.totalAudiences': 'Total Audiences',
        'audiences.totalReach': 'Total Reach',
        'audiences.activeCampaigns': 'Active Campaigns',
        'audiences.search': 'Search audiences...',
        'audiences.yourAudiences': 'Your Audiences',
        'audiences.people': 'people',
        'audiences.updated': 'Updated',
        'audiences.active': 'Active',
    },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('th');

    useEffect(() => {
        const saved = localStorage.getItem('language') as Language;
        if (saved && (saved === 'th' || saved === 'en')) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = (key: string): string => {
        const dict = translations[language] as Record<string, string>;
        return dict[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
