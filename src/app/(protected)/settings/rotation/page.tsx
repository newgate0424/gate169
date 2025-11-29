'use client';

import { useState, useEffect } from 'react';
import { getPageRoles, getPageSettings, updatePageSettings } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Users, MessageSquare, MessageCircle, Info, Search, RotateCcw, UserCircle, Hand } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface User {
    id: string;
    name: string;
    image: string;
    email: string;
    role?: string;
}

interface PageSettings {
    rotationMode: string;
    distributionMethod: string;
    keepAssignment: boolean;
    shuffleUsers: boolean;
    maxUsersPerChat: number;
    activeRotationUserIds: string[];
    transferIfUnreadMinutes: number | null;
    transferIfOffline: boolean;
    unreadLimitPerUser: number | null;
    rotationSchedule: string;
    nonSelectedCanViewAll: boolean;
    assignToNonSelected: string | null;
}

export default function ChatRotationPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<PageSettings>({
        rotationMode: 'OFF',
        distributionMethod: 'EQUAL',
        keepAssignment: false,
        shuffleUsers: false,
        maxUsersPerChat: 1,
        activeRotationUserIds: [],
        transferIfUnreadMinutes: null,
        transferIfOffline: false,
        unreadLimitPerUser: null,
        rotationSchedule: 'ALWAYS',
        nonSelectedCanViewAll: false,
        assignToNonSelected: null
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const pageId = '104825352182678'; // Default page ID

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesData, settingsData] = await Promise.all([
                getPageRoles(pageId),
                getPageSettings(pageId)
            ]);

            // Map roles to User interface for display
            const mappedUsers = (rolesData.roles || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                image: r.picture?.data?.url || '',
                email: '',
                role: r.role
            }));

            setUsers(mappedUsers);
            if (settingsData) {
                setSettings(settingsData as PageSettings);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            toast({
                title: "Error",
                description: "Failed to load settings",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = async (key: keyof PageSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        try {
            await updatePageSettings(pageId, newSettings);
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast({
                title: "Error",
                description: "Failed to save settings",
                variant: "destructive",
            });
        }
    };

    const toggleUserRotation = async (userId: string) => {
        const currentActive = settings.activeRotationUserIds || [];
        const isActive = currentActive.includes(userId);

        let newActive;
        if (isActive) {
            newActive = currentActive.filter(id => id !== userId);
        } else {
            newActive = [...currentActive, userId];
        }

        // Optimistic update
        setSettings(prev => ({ ...prev, activeRotationUserIds: newActive }));

        try {
            await updatePageSettings(pageId, { ...settings, activeRotationUserIds: newActive });
        } catch (error) {
            console.error('Failed to update rotation list:', error);
            toast({
                title: "Error",
                description: "Failed to update rotation list",
                variant: "destructive",
            });
            // Revert
            setSettings(prev => ({ ...prev, activeRotationUserIds: currentActive }));
        }
    };

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeUsersCount = (settings.activeRotationUserIds || []).length;
    const commentUsersCount = 0;

    return (
        <div className="space-y-6 pb-20 px-[200px] pt-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">ระบบการหมุนรอบแชท</h2>
                <div className="mt-2 bg-blue-50 text-blue-700 p-3 rounded-md text-sm flex gap-2 items-start">
                    <Info className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>การตั้งค่าด้านล่างนี้เป็นการตั้งค่าสำหรับเพจปัจจุบัน หากต้องการนำไปใช้กับเพจอื่น ให้กดปุ่ม Sync Settings</p>
                </div>
            </div>

            {/* Mode Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">การตั้งค่าโหมดการหมุนรอบแชท</CardTitle>
                    <CardDescription>เลือกโหมดการแชร์สนทนาสำหรับพนักงาน</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            className={`p-4 rounded-lg border-2 cursor-pointer flex items-center gap-4 transition-all ${settings.rotationMode === 'OFF' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => handleSettingChange('rotationMode', 'OFF')}
                        >
                            <div className={`p-2 rounded-full ${settings.rotationMode === 'OFF' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <RotateCcw className="h-6 w-6" />
                            </div>
                            <span className="font-medium">ปิดระบบหมุนรอบแชท</span>
                        </div>

                        <div
                            className={`p-4 rounded-lg border-2 cursor-pointer flex items-center gap-4 transition-all ${settings.rotationMode === 'MANUAL' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => handleSettingChange('rotationMode', 'MANUAL')}
                        >
                            <div className={`p-2 rounded-full ${settings.rotationMode === 'MANUAL' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <Hand className="h-6 w-6" />
                            </div>
                            <span className="font-medium">กำหนดการมอบหมายแชทด้วยตัวเอง</span>
                        </div>

                        <div
                            className={`p-4 rounded-lg border-2 cursor-pointer flex items-center gap-4 transition-all ${settings.rotationMode === 'GROUP' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => handleSettingChange('rotationMode', 'GROUP')}
                        >
                            <div className={`p-2 rounded-full ${settings.rotationMode === 'GROUP' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <Users className="h-6 w-6" />
                            </div>
                            <span className="font-medium">กำหนดการมอบหมายแบ่งตามกลุ่ม</span>
                        </div>

                        <div
                            className={`p-4 rounded-lg border-2 cursor-pointer flex items-center gap-4 transition-all ${settings.rotationMode === 'USER' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => handleSettingChange('rotationMode', 'USER')}
                        >
                            <div className={`p-2 rounded-full ${settings.rotationMode === 'USER' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                <UserCircle className="h-6 w-6" />
                            </div>
                            <span className="font-medium">กำหนดตามผู้ใช้งาน (พนักงาน)</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User List */}
            {settings.rotationMode === 'USER' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">รายชื่อผู้ใช้งาน</CardTitle>
                        <CardDescription>เลือกผู้ใช้งาน(พนักงาน) ด้านล่างเพื่อกำหนดแชท</CardDescription>
                        <div className="mt-2 bg-blue-50 text-blue-700 p-3 rounded-md text-sm flex gap-2 items-start">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>รายชื่อพนักงานด้านล่างนี้รวมถึง ทั้งหมด ของพนักงานจากหน้าที่คุณกำลังรวมกัน</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-4">
                                <div className={`pb-2 border-b-2 font-medium cursor-pointer ${true ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                                    พนักงาน
                                </div>
                                <div className="pb-2 border-b-2 border-transparent text-gray-500 cursor-pointer hover:text-gray-700">
                                    อัตราส่วนของพนักงาน
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="ค้นหาพนักงาน"
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="icon">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <div className="grid grid-cols-2 divide-x border-b bg-gray-50">
                                <div className="p-3 font-medium text-gray-700 flex justify-between items-center">
                                    <span>แชท</span>
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">ที่เลือก {activeUsersCount}</span>
                                </div>
                                <div className="p-3 font-medium text-gray-700 flex justify-between items-center">
                                    <span>คอมเม้น</span>
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">ที่เลือก {commentUsersCount}</span>
                                </div>
                            </div>

                            <div className="divide-y">
                                {loading ? (
                                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                                ) : (
                                    filteredUsers.map(user => {
                                        const isInRotation = (settings.activeRotationUserIds || []).includes(user.id);
                                        return (
                                            <div key={user.id} className="grid grid-cols-2 divide-x hover:bg-gray-50/50">
                                                {/* Chat Column */}
                                                <div className="p-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={user.image} />
                                                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${isInRotation ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{user.name}</span>
                                                            <span className="text-xs text-gray-500">{user.role || 'Staff'}</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isInRotation ? 'default' : 'ghost'}
                                                        className={`h-8 w-8 p-0 rounded-full ${isInRotation ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                                                        onClick={() => toggleUserRotation(user.id)}
                                                    >
                                                        <MessageSquare className="h-4 w-4 text-white" />
                                                    </Button>
                                                </div>

                                                {/* Comment Column (Placeholder) */}
                                                <div className="p-3 flex items-center justify-between opacity-50 cursor-not-allowed">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={user.image} />
                                                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-300`} />
                                                        </div>
                                                        <span className="text-sm font-medium">{user.name}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled
                                                        className="h-8 w-8 p-0 rounded-full bg-gray-200"
                                                    >
                                                        <MessageCircle className="h-4 w-4 text-white" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Detailed Settings */}
            {settings.rotationMode !== 'OFF' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">ตั้งค่าอย่างละเอียด</CardTitle>
                        <CardDescription>รายละเอียดการตั้งค่าระบบแชทที่เลือก</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 divide-y">

                        {/* Distribution Method */}
                        <div className="pt-4 first:pt-0">
                            <div className="flex items-start gap-3">
                                <RotateCcw className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h3 className="font-medium">วิธีการแบ่งแชท</h3>
                                        <p className="text-sm text-muted-foreground">แบ่งแชทให้ผู้ใช้งาน (พนักงาน) ที่เลือกในอัตราเท่ากันทุกคน</p>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">วิธีการแบ่ง</span>
                                        <Select
                                            value={settings.distributionMethod}
                                            onValueChange={(val) => handleSettingChange('distributionMethod', val)}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="เลือกวิธีการ" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="EQUAL">แบ่งแชทเท่ากัน</SelectItem>
                                                <SelectItem value="PERFORMANCE">ตามประสิทธิภาพ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">ผู้ใช้ที่ถูกเลือกในรายการจะยังคงได้รับมอบหมายบทสนทนา แม้ว่าจะถูกเพิกถอนสิทธิ์บนหน้าแล้วก็ตาม</span>
                                        <Switch
                                            checked={settings.keepAssignment}
                                            onCheckedChange={(val) => handleSettingChange('keepAssignment', val)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shuffle */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <RefreshCw className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-medium">สลับรายการผู้ใช้</h3>
                                            <p className="text-sm text-muted-foreground">เมื่อเริ่มรอบการสนทนาใหม่ ระบบจะสลับผู้ใช้ที่เลือกไว้ในรายการโดยอัตโนมัติ</p>
                                        </div>
                                        <Switch
                                            checked={settings.shuffleUsers}
                                            onCheckedChange={(val) => handleSettingChange('shuffleUsers', val)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Max Users Per Chat */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <UserCircle className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <h3 className="font-medium">จำนวนผู้ใช้งานหลัก (พนักงาน) ต่อแชท</h3>
                                            <p className="text-sm text-muted-foreground max-w-xl">
                                                ผู้ใช้งานหลักคือผู้ใช้งานที่ได้รับมอบหมายงานในแต่ละแชท ผู้ใช้งานท่านอื่นจะถูกเพิ่มเข้ามาในแชทนั้นและถูกแทนตามตัวเลือกการโอนแชทด้านล่าง
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm border px-3 py-1.5 rounded-md">{settings.maxUsersPerChat} บัญชี</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Transfer Settings */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <RefreshCw className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1 space-y-4">
                                    <h3 className="font-medium">การโอนแชท</h3>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">โอนแชทไปยังผู้ใช้งาน (พนักงาน) ท่านอื่น หากแชทไม่ได้ถูกอ่านภายใน: <strong>{settings.transferIfUnreadMinutes ? `${settings.transferIfUnreadMinutes} นาที` : 'OFF'}</strong></span>
                                        <Select
                                            value={settings.transferIfUnreadMinutes?.toString() || "OFF"}
                                            onValueChange={(val) => handleSettingChange('transferIfUnreadMinutes', val === "OFF" ? null : parseInt(val))}
                                        >
                                            <SelectTrigger className="w-[100px]">
                                                <SelectValue placeholder="ปิด" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OFF">ปิด</SelectItem>
                                                <SelectItem value="5">5 นาที</SelectItem>
                                                <SelectItem value="15">15 นาที</SelectItem>
                                                <SelectItem value="30">30 นาที</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">โอนแชทไปยังผู้ใช้งาน (พนักงาน) ท่านอื่น หากผู้ใช้ที่ได้รับมอบหมายไม่ออนไลน์ในขณะนั้น</span>
                                        <Switch
                                            checked={settings.transferIfOffline}
                                            onCheckedChange={(val) => handleSettingChange('transferIfOffline', val)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Limits */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <MessageSquare className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <h3 className="font-medium">จำกัดจำนวนแชทค้างที่รอการอ่าน ต่อ 1 ผู้ใช้งาน (พนักงาน)</h3>
                                            <p className="text-sm text-muted-foreground max-w-xl">
                                                จำนวนแชทค้างสูงสุดที่รอการอ่านต่อ 1 ผู้ใช้งาน (พนักงาน) หากตัวเลือกนี้ถูกปิด ระบบจะไม่มีการจำกัดยอดแชทค้างต่อ 1 ผู้ใช้งาน (พนักงาน)
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.unreadLimitPerUser !== null}
                                            onCheckedChange={(val) => handleSettingChange('unreadLimitPerUser', val ? 10 : null)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <RotateCcw className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <h3 className="font-medium">ระยะเวลาใช้ระบบหมุนแชท</h3>
                                            <p className="text-sm text-muted-foreground">
                                                มอบหมายสนทนาโดยอัตโนมัติในช่วงเวลาทำงานหรือตลอดเวลา
                                            </p>
                                        </div>
                                        <Select
                                            value={settings.rotationSchedule}
                                            onValueChange={(val) => handleSettingChange('rotationSchedule', val)}
                                        >
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALWAYS">ตลอดเวลา</SelectItem>
                                                <SelectItem value="WORKING_HOURS">เวลาทำงาน</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Access */}
                        <div className="pt-6">
                            <div className="flex items-start gap-3">
                                <Users className="h-5 w-5 mt-1 text-gray-500" />
                                <div className="flex-1 space-y-4">
                                    <h3 className="font-medium">สิทธิ์ในการเข้าถึงแชท</h3>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">ผู้ใช้งาน (พนักงาน) ที่ไม่ได้ถูกเลือกด้านบน สามารถดูแชททั้งหมดในเพจได้</span>
                                        <Switch
                                            checked={settings.nonSelectedCanViewAll}
                                            onCheckedChange={(val) => handleSettingChange('nonSelectedCanViewAll', val)}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm max-w-xl">
                                            ผู้ใช้งาน (พนักงาน) สามารถเห็นแชทผ่าน 2 ตัวเลือก ตัวเลือก <strong>มอบหมายให้ตัวเอง</strong> และ <strong>ยังไม่มีการมอบหมายให้พนักงานคนอื่น</strong> จะไม่ใช้งานได้หากมีการตั้งค่า จำกัดจำนวนแชทค้างที่รอการอื่นต่อ 1 ผู้ใช้งาน (พนักงาน) ด้านบน
                                        </span>
                                        <Select
                                            value={settings.assignToNonSelected || "ASSIGN_TO_THEM"}
                                            onValueChange={(val) => handleSettingChange('assignToNonSelected', val)}
                                        >
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ASSIGN_TO_THEM">มอบหมายให้เขา</SelectItem>
                                                <SelectItem value="VIEW_ONLY">ดูอย่างเดียว</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            )}
        </div>
    );
}
