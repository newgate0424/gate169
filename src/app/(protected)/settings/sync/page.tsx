'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Facebook, CheckCircle2, AlertCircle, History } from 'lucide-react';

export default function SyncSettingsPage() {
    return (
        <div className="flex flex-col h-full px-[100px] py-6 space-y-6">
            {/* Header Section */}
            <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">ซิงค์ข้อมูล</h2>
                        <p className="text-sm text-gray-500 mt-1">จัดการการเชื่อมต่อกับแพลตฟอร์มภายนอกและการซิงค์ข้อมูล</p>
                    </div>
                    <Button className="gap-2" variant="outline">
                        <RefreshCw className="h-4 w-4" />
                        ซิงค์ข้อมูลทันที
                    </Button>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
                <div className="h-full overflow-y-auto p-8 space-y-8">

                    {/* Platform Connections */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">การเชื่อมต่อแพลตฟอร์ม</h3>
                            <p className="text-sm text-gray-500">สถานะการเชื่อมต่อกับ Facebook และแพลตฟอร์มอื่นๆ</p>
                        </div>
                        <Separator />
                        <div className="grid gap-4 max-w-2xl">
                            {/* Facebook Page */}
                            <div className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-[#1877F2] rounded-full flex items-center justify-center text-white">
                                        <Facebook className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-gray-900">Facebook Page</h4>
                                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Connected
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-500">เชื่อมต่อกับเพจ: <strong>My Awesome Shop</strong></p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                                    ตัดการเชื่อมต่อ
                                </Button>
                            </div>

                            {/* Ad Account */}
                            <div className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-gray-900">Ad Account</h4>
                                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                                Not Connected
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-500">เชื่อมต่อบัญชีโฆษณาเพื่อดูสถิติเชิงลึก</p>
                                    </div>
                                </div>
                                <Button size="sm">
                                    เชื่อมต่อ
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Sync Configuration */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ตั้งค่าการซิงค์</h3>
                            <p className="text-sm text-gray-500">กำหนดความถี่และเงื่อนไขในการดึงข้อมูล</p>
                        </div>
                        <Separator />
                        <div className="grid gap-6 max-w-2xl">
                            <div className="grid gap-2">
                                <Label>ความถี่ในการซิงค์อัตโนมัติ</Label>
                                <Select defaultValue="15m">
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกความถี่" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="realtime">Real-time (Webhooks)</SelectItem>
                                        <SelectItem value="15m">ทุก 15 นาที</SelectItem>
                                        <SelectItem value="30m">ทุก 30 นาที</SelectItem>
                                        <SelectItem value="1h">ทุก 1 ชั่วโมง</SelectItem>
                                        <SelectItem value="manual">ด้วยตนเองเท่านั้น (Manual)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">การซิงค์แบบ Real-time อาจมีการใช้งาน API Limit สูงกว่าปกติ</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">ซิงค์รูปภาพและไฟล์แนบ</Label>
                                        <p className="text-sm text-gray-500">ดาวน์โหลดรูปภาพจากแชทมาเก็บไว้ในระบบอัตโนมัติ</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">ซิงค์ความคิดเห็น (Comments)</Label>
                                        <p className="text-sm text-gray-500">ดึงความคิดเห็นจากโพสต์โฆษณา</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync History */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ประวัติการซิงค์</h3>
                        </div>
                        <Separator />
                        <div className="max-w-2xl border rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-gray-700">
                                <History className="h-4 w-4" />
                                รายการล่าสุด
                            </div>
                            <div className="divide-y">
                                <div className="px-4 py-3 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">ซิงค์ข้อมูลแชทและข้อความ</span>
                                    <span className="text-gray-400">2 นาทีที่แล้ว</span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">ซิงค์ข้อมูลลูกค้า (Leads)</span>
                                    <span className="text-gray-400">15 นาทีที่แล้ว</span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">อัปเดตสถานะโฆษณา</span>
                                    <span className="text-gray-400">1 ชั่วโมงที่แล้ว</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
