'use client';

import { Button } from '@/components/ui/button';
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
import { Moon, Sun, Monitor, LayoutTemplate, List, Save } from 'lucide-react';

export default function DisplaySettingsPage() {
    return (
        <div className="flex flex-col h-full px-4 md:px-8 py-6 space-y-6">
            {/* Header Section */}
            <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">การแสดงผล</h2>
                        <p className="text-sm text-gray-500 mt-1">ปรับแต่งหน้าตาการใช้งานและธีมของระบบ</p>
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

                    {/* Theme */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ธีม (Theme)</h3>
                            <p className="text-sm text-gray-500">เลือกโหมดการแสดงผลที่สบายตาสำหรับคุณ</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-3 gap-4 max-w-2xl">
                            <button className="flex flex-col items-center gap-3 p-4 border-2 border-blue-600 bg-blue-50 rounded-xl transition-all">
                                <div className="h-20 w-full bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center">
                                    <Sun className="h-8 w-8 text-orange-500" />
                                </div>
                                <span className="font-medium text-blue-700">Light Mode</span>
                            </button>
                            <button className="flex flex-col items-center gap-3 p-4 border-2 border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
                                <div className="h-20 w-full bg-gray-900 border border-gray-800 rounded-lg shadow-sm flex items-center justify-center">
                                    <Moon className="h-8 w-8 text-blue-400" />
                                </div>
                                <span className="font-medium text-gray-600">Dark Mode</span>
                            </button>
                            <button className="flex flex-col items-center gap-3 p-4 border-2 border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
                                <div className="h-20 w-full bg-gradient-to-br from-white to-gray-900 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center">
                                    <Monitor className="h-8 w-8 text-gray-500" />
                                </div>
                                <span className="font-medium text-gray-600">System</span>
                            </button>
                        </div>
                    </div>

                    {/* Layout Density */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ความหนาแน่นของข้อมูล</h3>
                            <p className="text-sm text-gray-500">ปรับขนาดการแสดงผลของตารางและรายการต่างๆ</p>
                        </div>
                        <Separator />
                        <div className="grid gap-6 max-w-2xl">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        <LayoutTemplate className="h-6 w-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">มุมมองปกติ (Comfortable)</p>
                                        <p className="text-sm text-gray-500">ระยะห่างมาตรฐาน อ่านง่าย สบายตา</p>
                                    </div>
                                </div>
                                <div className="h-4 w-4 rounded-full border-2 border-blue-600 bg-blue-600" />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        <List className="h-6 w-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">มุมมองกะทัดรัด (Compact)</p>
                                        <p className="text-sm text-gray-500">ลดระยะห่าง แสดงข้อมูลได้มากขึ้นในหน้าเดียว</p>
                                    </div>
                                </div>
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                            </div>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">รูปแบบวันที่และเวลา</h3>
                        </div>
                        <Separator />
                        <div className="grid gap-6 max-w-2xl">
                            <div className="grid gap-2">
                                <Label>รูปแบบวันที่</Label>
                                <Select defaultValue="ddmmyyyy">
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกรูปแบบวันที่" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ddmmyyyy">31/01/2024 (DD/MM/YYYY)</SelectItem>
                                        <SelectItem value="mmddyyyy">01/31/2024 (MM/DD/YYYY)</SelectItem>
                                        <SelectItem value="buddhist">31 ม.ค. 2567 (พุทธศักราช)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
