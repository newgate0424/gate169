'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function updateProfile(formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return { error: "Not authenticated" };
    }

    // @ts-ignore
    const userId = session.user.id;
    const name = formData.get('name') as string;
    const imageFile = formData.get('imageFile') as File | null;

    try {
        let imageUrl = undefined;

        if (imageFile && imageFile.size > 0) {
            // Validate file type
            if (!imageFile.type.startsWith('image/')) {
                return { error: "Invalid file type" };
            }

            // Validate file size (e.g., 5MB)
            if (imageFile.size > 5 * 1024 * 1024) {
                return { error: "File size too large (max 5MB)" };
            }

            const bytes = await imageFile.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Create unique filename
            const ext = imageFile.name.split('.').pop();
            const filename = `${userId}-${Date.now()}.${ext}`;

            // Ensure uploads directory exists
            const uploadDir = join(process.cwd(), "public", "uploads");
            await mkdir(uploadDir, { recursive: true });

            // Save file
            const filePath = join(uploadDir, filename);
            await writeFile(filePath, buffer);

            imageUrl = `/uploads/${filename}`;
        }

        await db.updateUser(userId, {
            name: name,
            ...(imageUrl && { image: imageUrl })
        });

        revalidatePath('/settings/account');
        return { success: true };
    } catch (error) {
        console.error("Failed to update profile:", error);
        return { error: "Failed to update profile" };
    }
}

export async function changePassword(prevState: any, formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return { error: "Not authenticated" };
    }

    // @ts-ignore
    const userId = session.user.id;
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: "Please fill in all fields" };
    }

    if (newPassword !== confirmPassword) {
        return { error: "New passwords do not match" };
    }

    if (newPassword.length < 6) {
        return { error: "Password must be at least 6 characters" };
    }

    try {
        // Verify current password
        // @ts-ignore
        const user = await db.findUserById(userId);
        if (!user || !user.password) {
            return { error: "User not found" };
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return { error: "Incorrect current password" };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.updateUser(userId, { password: hashedPassword });

        return { success: true };
    } catch (error) {
        console.error("Failed to change password:", error);
        return { error: "Failed to change password" };
    }
}

export async function getLinkedAccounts() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return { accounts: [], hasPassword: false };
    }

    // @ts-ignore
    const userId = session.user.id;
    const mode = await db.getMode();

    try {
        let accounts = [];
        let hasPassword = false;

        if (mode === 'mysql') {
            // Check for password
            const user = await db.prisma.user.findUnique({
                where: { id: userId },
                select: { password: true }
            });
            hasPassword = !!user?.password;

            // Use raw query to bypass Prisma Client validation for new fields
            const rawAccounts = await db.prisma.$queryRaw`
                SELECT provider, providerEmail, providerImage 
                FROM Account 
                WHERE userId = ${userId}
            ` as any[];

            accounts = rawAccounts.map(account => ({
                provider: account.provider,
                providerEmail: account.providerEmail || (account.provider === 'google' ? session.user?.email : null),
                providerImage: account.providerImage || (account.provider === 'google' ? session.user?.image : null),
            }));
        } else {
            const { Account, User } = db.models;
            const user = await User.findById(userId).select('password');
            hasPassword = !!user?.password;

            const rawAccounts = await Account.find({ userId: userId }).select('provider providerEmail providerImage createdAt').lean();
            accounts = rawAccounts.map((a: any) => ({
                provider: a.provider,
                providerEmail: a.providerEmail || (a.provider === 'google' ? session.user?.email : null),
                providerImage: a.providerImage || (a.provider === 'google' ? session.user?.image : null),
                createdAt: a.createdAt
            }));
        }

        return { accounts, hasPassword };
    } catch (error) {
        console.error("Failed to get linked accounts:", error);
        return { accounts: [], hasPassword: false };
    }
}

export async function unlinkGoogleAccount() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return { error: "Not authenticated" };
    }

    // @ts-ignore
    const userId = session.user.id;
    const mode = await db.getMode();

    try {
        if (mode === 'mysql') {
            await db.prisma.account.deleteMany({
                where: {
                    userId: userId,
                    provider: 'google'
                }
            });
        } else {
            const { Account } = db.models;
            await Account.deleteMany({ userId: userId, provider: 'google' });
        }

        revalidatePath('/settings/account');
        return { success: true };
    } catch (error) {
        console.error("Failed to unlink Google account:", error);
        return { error: "Failed to unlink account" };
    }
}

export async function deleteAccount() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return { error: "Not authenticated" };
    }

    // @ts-ignore
    const userId = session.user.id;
    const mode = await db.getMode();

    try {
        if (mode === 'mysql') {
            await db.prisma.user.delete({
                where: { id: userId }
            });
        } else {
            const { User, Account, Session } = db.models;
            await Session.deleteMany({ userId: userId });
            await Account.deleteMany({ userId: userId });
            await User.deleteOne({ _id: userId });
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to delete account:", error);
        return { error: "Failed to delete account" };
    }
}
