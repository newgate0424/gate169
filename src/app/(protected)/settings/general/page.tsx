'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Save } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function GeneralSettingsPage() {
    const { notificationsEnabled, soundEnabled, setNotificationsEnabled, setSoundEnabled } = useAppSettings();
    return (
        <div className="flex flex-col h-full px-4 md:px-8 py-6 space-y-6">
            {/* Header Section */}
            <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">การตั้งค่าทั่วไป</h2>
                        <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลพื้นฐานและการตั้งค่าระบบของคุณ</p>
                    </div>
                    <Button className="gap-2">
                        <Save className="h-4 w-4" />
                        บันทึกการเปลี่ยนแปลง
                    </Button>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
                <div className="h-full overflow-y-auto p-8 space-y-8">

                    {/* Store Information */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ข้อมูลร้านค้า</h3>
                            <p className="text-sm text-gray-500">ข้อมูลพื้นฐานที่จะแสดงในระบบและใบเสร็จ</p>
                        </div>
                        <Separator />
                        <div className="grid gap-6 max-w-2xl">
                            <div className="grid gap-2">
                                <Label htmlFor="store-name">ชื่อร้านค้า / บริษัท</Label>
                                <Input id="store-name" placeholder="ระบุชื่อร้านค้าของคุณ" defaultValue="My Awesome Shop" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">อีเมลติดต่อ</Label>
                                    <Input id="email" type="email" placeholder="contact@example.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                                    <Input id="phone" placeholder="0xx-xxx-xxxx" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Localization */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ภาษาและภูมิภาค</h3>
                            <p className="text-sm text-gray-500">ตั้งค่าภาษา สกุลเงิน และโซนเวลา</p>
                        </div>
                        <Separator />
                        <div className="grid gap-6 max-w-2xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>ภาษาของระบบ</Label>
                                    <Select defaultValue="th">
                                        <SelectTrigger>
                                            <SelectValue placeholder="เลือกภาษา" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="th">ไทย (Thai)</SelectItem>
                                            <SelectItem value="en">อังกฤษ (English)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>สกุลเงินหลัก</Label>
                                    <Select defaultValue="thb">
                                        <SelectTrigger>
                                            <SelectValue placeholder="เลือกสกุลเงิน" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="thb">บาท (THB)</SelectItem>
                                            <SelectItem value="usd">ดอลลาร์ (USD)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>โซนเวลา</Label>
                                <Select defaultValue="asia-bangkok">
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกโซนเวลา" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asia-bangkok">(GMT+07:00) Bangkok, Hanoi, Jakarta</SelectItem>
                                        <SelectItem value="utc">(GMT+00:00) UTC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">การแจ้งเตือน</h3>
                            <p className="text-sm text-gray-500">กำหนดช่องทางและเหตุการณ์ที่ต้องการรับการแจ้งเตือน</p>
                        </div>
                        <Separator />
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50">
                                <div className="space-y-0.5">
                                    <Label className="text-base">แจ้งเตือนผ่านอีเมล</Label>
                                    <p className="text-sm text-gray-500">รับสรุปรายงานประจำวันและแจ้งเตือนสำคัญทางอีเมล</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50">
                                <div className="space-y-0.5">
                                    <Label className="text-base">แจ้งเตือนลูกค้าใหม่</Label>
                                    <p className="text-sm text-gray-500">แจ้งเตือนทันทีเมื่อมีลูกค้าทักแชทหรือคอมเมนต์ใหม่</p>
                                </div>
                                <Switch
                                    checked={notificationsEnabled}
                                    onCheckedChange={setNotificationsEnabled}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50">
                                <div className="space-y-0.5">
                                    <Label className="text-base">เสียงแจ้งเตือน</Label>
                                    <p className="text-sm text-gray-500">เล่นเสียงเมื่อมีข้อความเข้าขณะเปิดหน้าจอค้างไว้</p>
                                </div>
                                <Switch
                                    checked={soundEnabled}
                                    onCheckedChange={setSoundEnabled}
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
