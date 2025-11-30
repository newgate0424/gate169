'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save, User, Lock, LogOut, Trash2, Camera, Loader2 } from 'lucide-react';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useRef, useEffect, useActionState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { updateProfile, changePassword, getLinkedAccounts, unlinkGoogleAccount, deleteAccount } from '@/app/settings/actions';
import { GoogleIcon } from '@/components/ui/google-icon';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function AccountSettingsPage() {
    const { data: session, update } = useSession();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
    const [hasPassword, setHasPassword] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Dialog states
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isSignOutOpen, setIsSignOutOpen] = useState(false);
    const [isSaveOpen, setIsSaveOpen] = useState(false);

    const profileFormRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            let description = "เกิดข้อผิดพลาดในการเชื่อมต่อ";
            if (error === 'OAuthAccountNotLinked') {
                description = "บัญชีนี้ถูกเชื่อมต่อกับผู้ใช้อื่นแล้ว หรืออีเมลไม่ตรงกัน";
            }

            toast({
                title: "การเชื่อมต่อล้มเหลว",
                description: description,
                variant: "destructive",
            });

            // Clear error from URL
            router.replace('/settings/account');
        }
    }, [searchParams, toast, router]);

    useEffect(() => {
        getLinkedAccounts().then(data => {
            // Handle both old (array) and new (object) return types for safety during transition
            if (Array.isArray(data)) {
                setLinkedAccounts(data);
                setHasPassword(true); // Default to true if unknown
            } else {
                setLinkedAccounts(data.accounts);
                setHasPassword(data.hasPassword);
            }
        });
    }, []);

    const googleAccount = linkedAccounts.find(a => a.provider === 'google');
    const isGoogleConnected = !!googleAccount;

    // Password form state
    const [passwordState, passwordAction] = useActionState(changePassword, null);
    const passwordFormRef = useRef<HTMLFormElement>(null);

    // Handle password success/error
    if (passwordState?.success && passwordFormRef.current) {
        passwordFormRef.current.reset();
    }

    const handleProfileUpdate = async (formData: FormData) => {
        setIsPending(true);
        setIsSaveOpen(false); // Close dialog
        try {
            const result = await updateProfile(formData);
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                });
            } else {
                await update(); // Update session
                toast({
                    title: "Success",
                    description: "Profile updated successfully",
                    className: "bg-green-500 text-white border-none"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        } finally {
            setIsPending(false);
        }
    };

    const handleUnlinkGoogle = async () => {
        setIsPending(true);
        try {
            const result = await unlinkGoogleAccount();
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                });
            } else {
                setLinkedAccounts(prev => prev.filter(a => a.provider !== 'google'));
                toast({
                    title: "Success",
                    description: "Disconnected Google account",
                    className: "bg-green-500 text-white border-none"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        } finally {
            setIsPending(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsPending(true);
        try {
            const result = await deleteAccount();
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                });
            } else {
                await signOut({ callbackUrl: '/' });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        } finally {
            setIsPending(false);
            setIsDeleteOpen(false);
        }
    };

    if (!session) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <div className="flex flex-col h-full px-4 md:px-8 py-6 space-y-6">
            {/* Header Section */}
            <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">จัดการบัญชี</h2>
                        <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</p>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
                <div className="h-full overflow-y-auto p-8 space-y-8">

                    {/* Profile Section */}
                    <form ref={profileFormRef} action={handleProfileUpdate} className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">ข้อมูลส่วนตัว</h3>
                            <p className="text-sm text-gray-500">อัปเดตข้อมูลโปรไฟล์และรูปภาพของคุณ</p>
                        </div>
                        <Separator />

                        <div className="flex items-start gap-8 max-w-3xl">
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative group cursor-pointer" onClick={() => document.getElementById('image-upload')?.click()}>
                                    <Avatar className="h-24 w-24 border-2 border-gray-100">
                                        <AvatarImage src={previewImage || session.user?.image || "https://github.com/shadcn.png"} />
                                        <AvatarFallback>{session.user?.name?.charAt(0) || "U"}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="w-full"
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                >
                                    เปลี่ยนรูปโปรไฟล์
                                </Button>
                                <input
                                    type="file"
                                    id="image-upload"
                                    name="imageFile"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const url = URL.createObjectURL(file);
                                            setPreviewImage(url);
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex-1 grid gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">ชื่อที่แสดง</Label>
                                    <Input id="name" name="name" defaultValue={session.user?.name || ""} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">อีเมล</Label>
                                    <Input id="email" type="email" value={session.user?.email || ""} disabled className="bg-gray-50" />
                                    <p className="text-xs text-muted-foreground">อีเมลใช้สำหรับเข้าสู่ระบบ ไม่สามารถเปลี่ยนได้</p>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                                        <DialogTrigger asChild>
                                            <Button type="button" disabled={isPending} className="gap-2">
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                บันทึกข้อมูลส่วนตัว
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>ยืนยันการบันทึกข้อมูล</DialogTitle>
                                                <DialogDescription>
                                                    คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลส่วนตัวใช่หรือไม่?
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
                                                    ยกเลิก
                                                </Button>
                                                <Button
                                                    onClick={() => profileFormRef.current?.requestSubmit()}
                                                    disabled={isPending}
                                                >
                                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ยืนยัน"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* Connected Accounts Section - Only show if has password */}
                    {hasPassword && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">บัญชีที่เชื่อมต่อ</h3>
                                <p className="text-sm text-gray-500">จัดการการเชื่อมต่อกับบัญชีภายนอก</p>
                            </div>
                            <Separator />

                            <div className="max-w-2xl space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-gray-100 rounded-full overflow-hidden">
                                            {googleAccount?.providerImage ? (
                                                <img src={googleAccount.providerImage} alt="Google" className="h-6 w-6 rounded-full" />
                                            ) : (
                                                <GoogleIcon className="h-6 w-6" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Google Account</p>
                                            <div className="text-sm text-gray-500">
                                                {isGoogleConnected ? (
                                                    <div className="flex flex-col">
                                                        <span>{googleAccount.providerEmail || "เชื่อมต่อแล้ว"}</span>
                                                        {googleAccount.createdAt && (
                                                            <span className="text-xs text-gray-400">
                                                                เชื่อมต่อเมื่อ {new Date(googleAccount.createdAt).toLocaleDateString('th-TH', {
                                                                    year: 'numeric',
                                                                    month: 'long',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    "เชื่อมต่อเพื่อเข้าสู่ระบบด้วย Google"
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isGoogleConnected ? (
                                        <Button
                                            variant="outline"
                                            onClick={handleUnlinkGoogle}
                                            disabled={isPending}
                                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ยกเลิกการเชื่อมต่อ"}
                                        </Button>
                                    ) : (
                                        <Button variant="outline" onClick={() => signIn('google', { callbackUrl: '/settings/account' })}>
                                            เชื่อมต่อ
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Password Section - Only show if has password */}
                    {hasPassword && (
                        <form ref={passwordFormRef} action={passwordAction} className="space-y-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">รหัสผ่านและความปลอดภัย</h3>
                                <p className="text-sm text-gray-500">จัดการรหัสผ่านและการเข้าถึงบัญชี</p>
                            </div>
                            <Separator />

                            <div className="max-w-2xl space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
                                    <Input id="current-password" name="currentPassword" type="password" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                                        <Input id="new-password" name="newPassword" type="password" required minLength={6} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                                        <Input id="confirm-password" name="confirmPassword" type="password" required minLength={6} />
                                    </div>
                                </div>

                                {passwordState?.error && (
                                    <p className="text-sm text-red-500">{passwordState.error}</p>
                                )}
                                {passwordState?.success && (
                                    <p className="text-sm text-green-500">Password changed successfully</p>
                                )}

                                <div className="pt-2">
                                    <Button type="submit" variant="outline" className="gap-2">
                                        <Lock className="h-4 w-4" />
                                        เปลี่ยนรหัสผ่าน
                                    </Button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Danger Zone */}
                    <div className="space-y-4 pt-4">
                        <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-base font-medium text-red-900">พื้นที่อันตราย</h3>
                                    <p className="text-sm text-red-700">การกระทำเหล่านี้ไม่สามารถย้อนกลับได้</p>
                                </div>
                            </div>
                            <div className="mt-4 flex gap-4 justify-end">
                                <Dialog open={isSignOutOpen} onOpenChange={setIsSignOutOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            className="gap-2 bg-red-600 hover:bg-red-700"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            ออกจากระบบ
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>ยืนยันการออกจากระบบ</DialogTitle>
                                            <DialogDescription>
                                                คุณต้องการออกจากระบบใช่หรือไม่?
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsSignOutOpen(false)}>
                                                ยกเลิก
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => signOut({ callbackUrl: '/' })}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                ยืนยัน
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            className="gap-2 bg-red-600 hover:bg-red-700"
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            ลบบัญชี
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>คุณแน่ใจหรือไม่ที่จะลบบัญชี?</DialogTitle>
                                            <DialogDescription>
                                                การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดของคุณจะถูกลบออกจากระบบอย่างถาวร
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isPending}>
                                                ยกเลิก
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={handleDeleteAccount}
                                                disabled={isPending}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ยืนยันการลบ"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
