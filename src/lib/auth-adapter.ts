/**
 * Custom NextAuth Adapter with Dual Database Support (MySQL + MongoDB)
 * Automatically switches to MongoDB when MySQL is unavailable
 */

import { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "next-auth/adapters";
import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";

// ======================================
// Configuration
// ======================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads_backup';

// ======================================
// Prisma Client (MySQL)
// ======================================
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ======================================
// Database State
// ======================================
let dbMode: 'mysql' | 'mongodb' = 'mysql';
let mongoConnected = false;
let lastMySQLFailure = 0;
const MYSQL_RETRY_INTERVAL = 60000; // Retry MySQL every 60 seconds

// ======================================
// MongoDB Schemas
// ======================================
const userSchema = new mongoose.Schema({
    _id: String,
    name: String,
    email: { type: String, unique: true, sparse: true },
    emailVerified: Date,
    image: String,
    facebookPageToken: String,
    facebookAdToken: String,
    permissions: String, // JSON string
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
    _id: String,
    sessionToken: { type: String, unique: true, index: true },
    userId: { type: String, index: true },
    expires: Date,
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
    _id: String,
    uniqueKey: { type: String, unique: true }, // provider_providerAccountId
    userId: { type: String, index: true },
    type: String,
    provider: String,
    providerAccountId: String,
    refresh_token: String,
    access_token: String,
    expires_at: Number,
    token_type: String,
    scope: String,
    id_token: String,
    session_state: String,
}, { timestamps: true });

const verificationTokenSchema = new mongoose.Schema({
    identifier: String,
    token: { type: String, unique: true },
    expires: Date,
});
verificationTokenSchema.index({ identifier: 1, token: 1 }, { unique: true });

// Initialize models
let UserModel: mongoose.Model<any>;
let SessionModel: mongoose.Model<any>;
let AccountModel: mongoose.Model<any>;
let VerificationTokenModel: mongoose.Model<any>;

function initModels() {
    if (!UserModel) {
        UserModel = mongoose.models.User || mongoose.model('User', userSchema);
        SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);
        AccountModel = mongoose.models.Account || mongoose.model('Account', accountSchema);
        VerificationTokenModel = mongoose.models.VerificationToken || mongoose.model('VerificationToken', verificationTokenSchema);
    }
}

// ======================================
// Connection Functions
// ======================================
async function connectMongoDB(): Promise<boolean> {
    if (mongoConnected && mongoose.connection.readyState === 1) {
        return true;
    }

    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }
        initModels();
        mongoConnected = true;
        console.log('✅ [Auth-MongoDB] Connected successfully');
        return true;
    } catch (error) {
        console.error('❌ [Auth-MongoDB] Connection failed:', error);
        mongoConnected = false;
        return false;
    }
}

async function checkMySQL(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

async function getDB(): Promise<'mysql' | 'mongodb'> {
    // If we recently failed MySQL, use MongoDB without checking
    if (dbMode === 'mongodb') {
        const now = Date.now();
        if (now - lastMySQLFailure < MYSQL_RETRY_INTERVAL) {
            return 'mongodb';
        }
        // Try MySQL again
        const mysqlOk = await checkMySQL();
        if (mysqlOk) {
            console.log('🔄 [Auth] MySQL recovered, switching back');
            dbMode = 'mysql';
            return 'mysql';
        }
        lastMySQLFailure = now;
        return 'mongodb';
    }

    // Check MySQL
    const mysqlOk = await checkMySQL();
    if (mysqlOk) {
        return 'mysql';
    }

    // MySQL failed, switch to MongoDB
    console.log('⚠️ [Auth] MySQL unavailable, switching to MongoDB...');
    lastMySQLFailure = Date.now();
    const mongoOk = await connectMongoDB();
    if (mongoOk) {
        dbMode = 'mongodb';
        return 'mongodb';
    }

    throw new Error('All databases are unavailable');
}

// Generate CUID-like ID
function generateId(): string {
    return 'c' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ======================================
// Custom Dual Database Adapter
// ======================================
export function DualDatabaseAdapter(): Adapter {
    return {
        async createUser(user: Omit<AdapterUser, 'id'>) {
            const mode = await getDB();
            const id = generateId();

            if (mode === 'mysql') {
                const created = await prisma.user.create({
                    data: { ...user, id }
                });
                return created as AdapterUser;
            } else {
                const created = await UserModel.create({ _id: id, ...user });
                return { id: created._id, ...user } as AdapterUser;
            }
        },

        async getUser(id: string) {
            const mode = await getDB();

            if (mode === 'mysql') {
                const user = await prisma.user.findUnique({ where: { id } });
                return user as AdapterUser | null;
            } else {
                const user = await UserModel.findById(id).lean();
                return user ? { ...user, id: user._id } as AdapterUser : null;
            }
        },

        async getUserByEmail(email: string) {
            const mode = await getDB();

            if (mode === 'mysql') {
                const user = await prisma.user.findUnique({ where: { email } });
                return user as AdapterUser | null;
            } else {
                const user = await UserModel.findOne({ email }).lean();
                return user ? { ...user, id: user._id } as AdapterUser : null;
            }
        },

        async getUserByAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            const mode = await getDB();

            if (mode === 'mysql') {
                const account = await prisma.account.findUnique({
                    where: {
                        provider_providerAccountId: { provider, providerAccountId }
                    },
                    include: { user: true }
                });
                return account?.user as AdapterUser | null;
            } else {
                const account = await AccountModel.findOne({ provider, providerAccountId }).lean();
                if (!account) return null;
                const user = await UserModel.findById(account.userId).lean();
                return user ? { ...user, id: user._id } as AdapterUser : null;
            }
        },

        async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
            const mode = await getDB();
            const { id, ...data } = user;

            if (mode === 'mysql') {
                const updated = await prisma.user.update({
                    where: { id },
                    data
                });
                return updated as AdapterUser;
            } else {
                const updated = await UserModel.findByIdAndUpdate(id, data, { new: true }).lean();
                return updated ? { ...updated, id: updated._id } as AdapterUser : user as AdapterUser;
            }
        },

        async deleteUser(userId: string) {
            const mode = await getDB();

            if (mode === 'mysql') {
                await prisma.user.delete({ where: { id: userId } });
            } else {
                await UserModel.findByIdAndDelete(userId);
            }
        },

        async linkAccount(account: AdapterAccount) {
            const mode = await getDB();
            const id = generateId();

            if (mode === 'mysql') {
                await prisma.account.create({
                    data: { ...account, id }
                });
            } else {
                await AccountModel.create({
                    _id: id,
                    uniqueKey: `${account.provider}_${account.providerAccountId}`,
                    ...account
                });
            }
            return account as AdapterAccount;
        },

        async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            const mode = await getDB();

            if (mode === 'mysql') {
                await prisma.account.delete({
                    where: {
                        provider_providerAccountId: { provider, providerAccountId }
                    }
                });
            } else {
                await AccountModel.deleteOne({ provider, providerAccountId });
            }
        },

        async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
            const mode = await getDB();
            const id = generateId();

            if (mode === 'mysql') {
                const created = await prisma.session.create({
                    data: { ...session, id }
                });
                return created as AdapterSession;
            } else {
                const created = await SessionModel.create({ _id: id, ...session });
                return { id: created._id, ...session } as AdapterSession;
            }
        },

        async getSessionAndUser(sessionToken: string) {
            const mode = await getDB();

            if (mode === 'mysql') {
                const result = await prisma.session.findUnique({
                    where: { sessionToken },
                    include: { user: true }
                });
                if (!result) return null;
                const { user, ...session } = result;
                return { session: session as AdapterSession, user: user as AdapterUser };
            } else {
                const session = await SessionModel.findOne({ sessionToken }).lean();
                if (!session) return null;
                const user = await UserModel.findById(session.userId).lean();
                if (!user) return null;
                return {
                    session: { ...session, id: session._id } as AdapterSession,
                    user: { ...user, id: user._id } as AdapterUser
                };
            }
        },

        async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) {
            const mode = await getDB();
            const { sessionToken, ...data } = session;

            if (mode === 'mysql') {
                const updated = await prisma.session.update({
                    where: { sessionToken },
                    data
                });
                return updated as AdapterSession;
            } else {
                const updated = await SessionModel.findOneAndUpdate(
                    { sessionToken },
                    data,
                    { new: true }
                ).lean();
                return updated ? { ...updated, id: updated._id } as AdapterSession : null;
            }
        },

        async deleteSession(sessionToken: string) {
            const mode = await getDB();

            if (mode === 'mysql') {
                await prisma.session.delete({ where: { sessionToken } });
            } else {
                await SessionModel.deleteOne({ sessionToken });
            }
        },

        async createVerificationToken(token: VerificationToken) {
            const mode = await getDB();

            if (mode === 'mysql') {
                const created = await prisma.verificationToken.create({ data: token });
                return created as VerificationToken;
            } else {
                const created = await VerificationTokenModel.create(token);
                return { identifier: created.identifier, token: created.token, expires: created.expires };
            }
        },

        async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
            const mode = await getDB();

            if (mode === 'mysql') {
                try {
                    const deleted = await prisma.verificationToken.delete({
                        where: { identifier_token: { identifier, token } }
                    });
                    return deleted as VerificationToken;
                } catch {
                    return null;
                }
            } else {
                const deleted = await VerificationTokenModel.findOneAndDelete({ identifier, token }).lean();
                return deleted ? { identifier: deleted.identifier, token: deleted.token, expires: deleted.expires } : null;
            }
        },
    };
}

// Export prisma for direct access if needed
export { prisma };
