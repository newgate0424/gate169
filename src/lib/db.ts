/**
 * Dual Database System - MySQL (Primary) + MongoDB (Backup)
 * Automatically switches to MongoDB when MySQL is unavailable
 */

import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

// ======================================
// Database Connection State
// ======================================
let dbMode: 'mysql' | 'mongodb' = 'mysql';
let mysqlConnected = false;
let mongoConnected = false;
let lastMySQLCheck = 0;
let lastMySQLFailed = 0;
const MYSQL_CHECK_INTERVAL = 30000; // Check MySQL every 30 seconds when using MongoDB
const MYSQL_RETRY_DELAY = 60000; // Wait 60 seconds before retrying after failure

// Prisma Client (MySQL)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads_backup';

// ======================================
// MongoDB Schemas
// ======================================
const userSchema = new mongoose.Schema({
    _id: String, // cuid from MySQL
    name: String,
    email: { type: String, unique: true, sparse: true },
    emailVerified: Date,
    image: String,
    facebookPageToken: String, // For AdBox
    facebookAdToken: String,   // For AdManager
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
    _id: String,
    sessionToken: { type: String, unique: true },
    userId: String,
    expires: Date,
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
    _id: String,
    userId: String,
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
    providerEmail: String,
    providerImage: String,
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
    _id: String, // Facebook Conversation ID
    pageId: String,
    lastMessageAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: null }, // เวลาที่ user อ่านครั้งล่าสุด
    snippet: String,
    unreadCount: { type: Number, default: 0 },
    participantId: String,
    participantName: String,
    facebookLink: String,
    adId: String,
    adName: String,
    assigneeId: String,
    viewedBy: String,
    viewedByName: String,
    viewedAt: Date,
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    _id: String, // Facebook Message ID
    conversationId: String,
    senderId: String,
    senderName: String,
    content: String,
    attachments: String, // JSON string
    stickerUrl: String,
    createdAt: Date,
    isFromPage: { type: Boolean, default: false },
}, { timestamps: false });

const pageSettingsSchema = new mongoose.Schema({
    _id: String, // pageId
    pageId: { type: String, unique: true },
    rotationMode: { type: String, default: 'OFF' },
    distributionMethod: { type: String, default: 'EQUAL' },
    keepAssignment: { type: Boolean, default: false },
    shuffleUsers: { type: Boolean, default: false },
    maxUsersPerChat: { type: Number, default: 1 },
    activeRotationUserIds: String, // JSON string
    transferIfUnreadMinutes: Number,
    transferIfOffline: { type: Boolean, default: false },
    unreadLimitPerUser: Number,
    rotationSchedule: { type: String, default: 'ALWAYS' },
    nonSelectedCanViewAll: { type: Boolean, default: false },
    assignToNonSelected: String,
}, { timestamps: true });

// Ad Manager Schemas
const adAccountSchema = new mongoose.Schema({
    _id: String, // Facebook Ad Account ID (act_xxxx)
    userId: String,
    accountId: String,
    name: String,
    currency: { type: String, default: 'THB' },
    accountStatus: { type: Number, default: 1 },
}, { timestamps: true });

const facebookAdSchema = new mongoose.Schema({
    _id: String, // Facebook Ad ID
    adAccountId: String,
    name: String,
    status: String,
    effectiveStatus: String,
    campaignId: String,
    campaignName: String,
    adSetId: String,
    adSetName: String,
    thumbnail: String,
    budget: String,
    pageId: String,
    pageName: String,
    pageUsername: String,
    // Insights
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    spend: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    results: { type: Number, default: 0 },
    roas: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    // Video metrics
    videoPlays: { type: Number, default: 0 },
    videoP25: { type: Number, default: 0 },
    videoP50: { type: Number, default: 0 },
    videoP75: { type: Number, default: 0 },
    videoP95: { type: Number, default: 0 },
    videoP100: { type: Number, default: 0 },
    videoAvgTime: { type: Number, default: 0 },
    // Engagement
    postEngagements: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },
    lastSyncAt: { type: Date, default: Date.now },
}, { timestamps: true });

const adSyncLogSchema = new mongoose.Schema({
    userId: String,
    adAccountId: String,
    syncType: String,
    status: String,
    adsCount: { type: Number, default: 0 },
    error: String,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
}, { timestamps: true });

// Create indexes
conversationSchema.index({ pageId: 1 });
conversationSchema.index({ adId: 1 });
conversationSchema.index({ lastMessageAt: -1 });
messageSchema.index({ conversationId: 1 });
facebookAdSchema.index({ adAccountId: 1 });
facebookAdSchema.index({ status: 1 });
adAccountSchema.index({ userId: 1 });

// MongoDB Models
let UserModel: mongoose.Model<any>;
let SessionModel: mongoose.Model<any>;
let AccountModel: mongoose.Model<any>;
let ConversationModel: mongoose.Model<any>;
let MessageModel: mongoose.Model<any>;
let PageSettingsModel: mongoose.Model<any>;
let AdAccountModel: mongoose.Model<any>;
let FacebookAdModel: mongoose.Model<any>;
let AdSyncLogModel: mongoose.Model<any>;

// Initialize models only once
function initModels() {
    if (!UserModel) {
        UserModel = mongoose.models.User || mongoose.model('User', userSchema);
        SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);
        AccountModel = mongoose.models.Account || mongoose.model('Account', accountSchema);
        ConversationModel = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
        MessageModel = mongoose.models.Message || mongoose.model('Message', messageSchema);
        PageSettingsModel = mongoose.models.PageSettings || mongoose.model('PageSettings', pageSettingsSchema);
        AdAccountModel = mongoose.models.AdAccount || mongoose.model('AdAccount', adAccountSchema);
        FacebookAdModel = mongoose.models.FacebookAd || mongoose.model('FacebookAd', facebookAdSchema);
        AdSyncLogModel = mongoose.models.AdSyncLog || mongoose.model('AdSyncLog', adSyncLogSchema);
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
        console.log('✅ [MongoDB] Connected successfully');
        return true;
    } catch (error) {
        console.error('❌ [MongoDB] Connection failed:', error);
        mongoConnected = false;
        return false;
    }
}

async function checkMySQL(): Promise<boolean> {
    // Skip if recently failed
    const now = Date.now();
    if (lastMySQLFailed > 0 && now - lastMySQLFailed < MYSQL_RETRY_DELAY) {
        return false; // Don't retry yet
    }

    try {
        // Use Promise.race with a short timeout
        const result = await Promise.race([
            prisma.$queryRaw`SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error('MySQL timeout')), 2000))
        ]);
        mysqlConnected = true;
        lastMySQLFailed = 0;
        console.log('✅ [MySQL] Connected successfully');
        return true;
    } catch (error) {
        mysqlConnected = false;
        lastMySQLFailed = now;
        console.log('❌ [MySQL] Connection failed');
        return false;
    }
}

// ======================================
// Auto-Switch Database Mode
// ======================================

export async function getActiveDB(): Promise<'mysql' | 'mongodb'> {
    // If already using MongoDB and recently checked, return immediately
    if (dbMode === 'mongodb') {
        const now = Date.now();
        if (now - lastMySQLCheck < MYSQL_CHECK_INTERVAL) {
            // Don't check MySQL yet, just ensure MongoDB is connected
            if (!mongoConnected) {
                await connectMongoDB();
            }
            return 'mongodb';
        }

        // Time to check if MySQL is back
        lastMySQLCheck = now;
        const mysqlOk = await checkMySQL();
        if (mysqlOk) {
            console.log('🔄 [DB] Switching back to MySQL');
            dbMode = 'mysql';
            return 'mysql';
        }
        return 'mongodb';
    }

    // Currently in MySQL mode - check if still working
    const mysqlOk = await checkMySQL();
    if (mysqlOk) {
        dbMode = 'mysql';
        return 'mysql';
    }

    // MySQL failed, try MongoDB
    console.log('⚠️ [DB] MySQL unavailable, switching to MongoDB...');
    const mongoOk = await connectMongoDB();
    if (mongoOk) {
        dbMode = 'mongodb';
        lastMySQLCheck = Date.now();
        return 'mongodb';
    }

    // Both failed!
    throw new Error('All databases are unavailable');
}

export function getCurrentDBMode(): 'mysql' | 'mongodb' {
    return dbMode;
}

// ======================================
// Unified Database Operations
// ======================================

export const db = {
    // ---- Page Settings Operations ----
    pageSettings: {
        async findUnique({ where }: { where: { pageId: string } }) {
            const mode = await getActiveDB();
            if (mode === 'mysql') {
                return prisma.pageSettings.findUnique({ where });
            } else {
                const settings = await PageSettingsModel.findOne({ pageId: where.pageId }).lean();
                return settings ? { ...settings, id: settings._id } : null;
            }
        },

        async upsert({ where, create, update }: { where: { pageId: string }, create: any, update: any }) {
            const mode = await getActiveDB();
            if (mode === 'mysql') {
                return prisma.pageSettings.upsert({ where, create, update });
            } else {
                const existing = await PageSettingsModel.findOne({ pageId: where.pageId }).lean();
                if (existing) {
                    const settings = await PageSettingsModel.findOneAndUpdate({ pageId: where.pageId }, update, { new: true }).lean();
                    return settings ? { ...settings, id: (settings as any)._id } : null;
                } else {
                    const settings = await PageSettingsModel.create({ _id: where.pageId, ...create }) as any;
                    return { ...settings.toObject(), id: settings._id };
                }
            }
        }
    },

    // ---- User Operations ----
    async findUserById(id: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.findUnique({ where: { id } });
        } else {
            const user = await UserModel.findById(id).lean();
            return user ? { ...user, id: user._id } : null;
        }
    },

    async findUserByEmail(email: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.findUnique({ where: { email } });
        } else {
            const user = await UserModel.findOne({ email }).lean();
            return user ? { ...user, id: user._id } : null;
        }
    },

    async updateUser(id: string, data: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.update({ where: { id }, data });
        } else {
            const user = await UserModel.findByIdAndUpdate(id, data, { new: true }).lean();
            return user ? { ...user, id: user._id } : null;
        }
    },

    async findUsersWithFacebookToken() {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.findMany({
                where: { facebookPageToken: { not: null } },
                select: { facebookPageToken: true }
            });
        } else {
            const users = await UserModel.find({ facebookPageToken: { $ne: null } })
                .select('facebookPageToken')
                .lean();
            return users;
        }
    },

    async getAllUsers() {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.findMany();
        } else {
            const users = await UserModel.find().lean();
            return users.map(u => ({ ...u, id: u._id }));
        }
    },

    // ---- Session Operations ----
    async findSessionByToken(sessionToken: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.session.findUnique({ where: { sessionToken } });
        } else {
            const session = await SessionModel.findOne({ sessionToken }).lean();
            return session ? { ...session, id: session._id } : null;
        }
    },

    async createSession(data: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.session.create({ data });
        } else {
            const session = await SessionModel.create({ _id: data.id, ...data }) as any;
            return { ...session.toObject(), id: session._id };
        }
    },

    async deleteSession(sessionToken: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.session.delete({ where: { sessionToken } });
        } else {
            return SessionModel.deleteOne({ sessionToken });
        }
    },

    // ---- Conversation Operations ----
    async findConversationById(id: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.findUnique({ where: { id } });
        } else {
            const conv = await ConversationModel.findById(id).lean();
            return conv ? { ...conv, id: conv._id } : null;
        }
    },

    async findConversationByPageAndParticipant(pageId: string, participantId: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.findFirst({
                where: { pageId, participantId }
            });
        } else {
            const conv = await ConversationModel.findOne({ pageId, participantId }).lean();
            return conv ? { ...conv, id: conv._id } : null;
        }
    },

    async findConversationsByPageIds(pageIds: string[]) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.findMany({
                where: { pageId: { in: pageIds } },
                orderBy: { lastMessageAt: 'desc' }
            });
        } else {
            const convs = await ConversationModel.find({ pageId: { $in: pageIds } })
                .sort({ lastMessageAt: -1 })
                .lean();
            return convs.map(c => ({ ...c, id: c._id }));
        }
    },

    async upsertConversation(id: string, create: any, update: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.upsert({
                where: { id },
                create: { id, ...create },
                update
            });
        } else {
            // For MongoDB: check existence first to avoid $set/$setOnInsert conflicts
            const existing = await ConversationModel.findById(id).lean();
            if (existing) {
                const conv = await ConversationModel.findByIdAndUpdate(id, update, { new: true }).lean();
                return conv ? { ...conv, id: (conv as any)._id } : null;
            } else {
                const conv = await ConversationModel.create({ _id: id, ...create }) as any;
                return { ...conv.toObject(), id: conv._id };
            }
        }
    },

    async updateConversation(id: string, data: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.update({ where: { id }, data });
        } else {
            const conv = await ConversationModel.findByIdAndUpdate(id, data, { new: true }).lean();
            return conv ? { ...conv, id: conv._id } : null;
        }
    },

    async incrementUnreadCount(id: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.update({
                where: { id },
                data: { unreadCount: { increment: 1 } }
            });
        } else {
            return ConversationModel.findByIdAndUpdate(id, { $inc: { unreadCount: 1 } });
        }
    },

    // ---- Message Operations ----
    async findMessagesByConversation(conversationId: string, limit = 50) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            // Optimize: Get latest N messages by sorting DESC, then reverse
            const messages = await prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'desc' },
                take: limit
            });
            return messages.reverse();
        } else {
            // For MongoDB: sort desc, limit, then reverse
            const msgs = await MessageModel.find({ conversationId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            // Reverse to get chronological order
            return msgs.reverse().map(m => ({ ...m, id: m._id }));
        }
    },

    async findNewMessages(conversationIds: string[], since: Date) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.message.findMany({
                where: {
                    conversationId: { in: conversationIds },
                    createdAt: { gt: since },
                    isFromPage: false
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });
        } else {
            const msgs = await MessageModel.find({
                conversationId: { $in: conversationIds },
                createdAt: { $gt: since },
                isFromPage: false
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
            return msgs.map(m => ({ ...m, id: m._id }));
        }
    },

    async createMessage(data: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.message.create({ data });
        } else {
            const msg = await MessageModel.create({ _id: data.id, ...data }) as any;
            return { ...msg.toObject(), id: msg._id };
        }
    },

    async upsertMessage(id: string, create: any, update: any) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.message.upsert({
                where: { id },
                create: { id, ...create },
                update
            });
        } else {
            // For MongoDB: use findOneAndReplace to avoid $set/$setOnInsert conflicts
            const existingMsg = await MessageModel.findById(id).lean();
            if (existingMsg) {
                // Update existing
                const msg = await MessageModel.findByIdAndUpdate(id, update, { new: true }).lean();
                return msg ? { ...msg, id: (msg as any)._id } : null;
            } else {
                // Create new
                const msg = await MessageModel.create({ _id: id, ...create }) as any;
                return { ...msg.toObject(), id: msg._id };
            }
        }
    },

    // ---- Bulk Operations ----
    async bulkUpsertConversations(conversations: any[]) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            const ops = conversations.map(conv =>
                prisma.conversation.upsert({
                    where: { id: conv.id },
                    create: conv,
                    update: conv
                })
            );
            return Promise.all(ops);
        } else {
            // For MongoDB: use replaceOne to avoid $set conflicts
            const ops = conversations.map(conv => ({
                replaceOne: {
                    filter: { _id: conv.id },
                    replacement: { _id: conv.id, ...conv },
                    upsert: true
                }
            }));
            return ConversationModel.bulkWrite(ops);
        }
    },

    async bulkUpsertMessages(messages: any[]) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            const ops = messages.map(msg =>
                prisma.message.upsert({
                    where: { id: msg.id },
                    create: msg,
                    update: msg
                })
            );
            return Promise.all(ops);
        } else {
            // For MongoDB: use replaceOne to avoid $set conflicts
            const ops = messages.map(msg => ({
                replaceOne: {
                    filter: { _id: msg.id },
                    replacement: { _id: msg.id, ...msg },
                    upsert: true
                }
            }));
            return MessageModel.bulkWrite(ops);
        }
    },

    // ---- Conversation with Messages (for fetchConversationsFromDB) ----
    async findConversationsWithMessages(pageIds: string[], limit = 100) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.findMany({
                where: { pageId: { in: pageIds } },
                orderBy: { lastMessageAt: 'desc' },
                take: limit,
                include: {
                    messages: {
                        take: 1,
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
        } else {
            // For MongoDB, we need to aggregate
            const convs = await ConversationModel.find({ pageId: { $in: pageIds } })
                .sort({ lastMessageAt: -1 })
                .limit(limit)
                .lean();

            // Get last message for each conversation
            for (const conv of convs) {
                const messages = await MessageModel.find({ conversationId: conv._id })
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .lean();
                (conv as any).messages = messages.map(m => ({ ...m, id: m._id }));
                (conv as any).id = conv._id;
            }
            return convs;
        }
    },

    // ---- Find User with Facebook Token ----
    async findUserWithToken(userId: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.user.findUnique({
                where: { id: userId },
                select: {
                    facebookPageToken: true,
                    facebookAdToken: true
                }
            });
        } else {
            const user = await UserModel.findById(userId).select('facebookPageToken facebookAdToken').lean();
            return user;
        }
    },

    // ---- Find new messages for sync-new API (by pageIds) ----
    async findNewMessagesForPages(pageIds: string[], sinceDate: Date) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.message.findMany({
                where: {
                    conversation: {
                        pageId: { in: pageIds }
                    },
                    createdAt: { gt: sinceDate },
                    isFromPage: false
                },
                include: {
                    conversation: {
                        select: {
                            pageId: true,
                            participantName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 20
            });
        } else {
            // First get conversations for the pageIds
            const convs = await ConversationModel.find({ pageId: { $in: pageIds } }).select('_id pageId').lean();
            const convIds = convs.map((c: any) => c._id);

            const messages = await MessageModel.find({
                conversationId: { $in: convIds },
                createdAt: { $gt: sinceDate },
                isFromPage: false
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

            // Add conversation info
            return messages.map((m: any) => {
                const conv = convs.find((c: any) => c._id === m.conversationId);
                return {
                    ...m,
                    id: m._id,
                    conversation: conv ? { pageId: conv.pageId } : null
                };
            });
        }
    },

    // ---- Find updated conversations for sync-new API ----
    async findUpdatedConversations(pageIds: string[], sinceDate: Date) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.conversation.findMany({
                where: {
                    pageId: { in: pageIds },
                    lastMessageAt: { gt: sinceDate }
                },
                select: {
                    id: true,
                    pageId: true,
                    snippet: true,
                    unreadCount: true,
                    lastMessageAt: true,
                    participantId: true,
                    participantName: true,
                    adId: true,
                    facebookLink: true
                },
                orderBy: { lastMessageAt: 'desc' },
                take: 10
            });
        } else {
            return ConversationModel.find({
                pageId: { $in: pageIds },
                lastMessageAt: { $gt: sinceDate }
            })
                .select('pageId snippet unreadCount lastMessageAt participantId participantName adId facebookLink')
                .sort({ lastMessageAt: -1 })
                .limit(10)
                .lean()
                .then((convs: any[]) => convs.map(c => ({ ...c, id: c._id })));
        }
    },

    // ---- Raw Prisma for complex queries (MySQL only) ----
    get prisma() {
        return prisma;
    },

    // ---- MongoDB Models for complex queries ----
    get models() {
        initModels();
        return {
            User: UserModel,
            Session: SessionModel,
            Account: AccountModel,
            Conversation: ConversationModel,
            Message: MessageModel,
            PageSettings: PageSettingsModel,
            AdAccount: AdAccountModel,
            FacebookAd: FacebookAdModel,
            AdSyncLog: AdSyncLogModel
        };
    },

    // ---- Get current mode ----
    async getMode() {
        return getActiveDB();
    },

    // ======================================
    // Ad Manager Functions
    // ======================================

    async upsertAdAccount(data: {
        id: string;
        userId: string;
        accountId: string;
        name: string;
        currency?: string;
        accountStatus?: number;
    }) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.adAccount.upsert({
                where: { id: data.id },
                update: {
                    name: data.name,
                    currency: data.currency || 'THB',
                    accountStatus: data.accountStatus || 1,
                    updatedAt: new Date()
                },
                create: data
            });
        } else {
            return AdAccountModel.findByIdAndUpdate(
                data.id,
                { $set: data },
                { upsert: true, new: true }
            );
        }
    },

    async getAdAccountsByUser(userId: string) {
        const mode = await getActiveDB();
        if (mode === 'mysql') {
            return prisma.adAccount.findMany({
                where: { userId },
                include: { ads: true }
            });
        } else {
            const accounts = await AdAccountModel.find({ userId }).lean();
            // Get ads for each account
            for (const acc of accounts) {
                (acc as any).ads = await FacebookAdModel.find({ adAccountId: acc._id }).lean();
            }
            return accounts.map((a: any) => ({ ...a, id: a._id }));
        }
    },

    async upsertFacebookAd(data: any) {
        const mode = await getActiveDB();
        const now = new Date();
        
        if (mode === 'mysql') {
            return prisma.facebookAd.upsert({
                where: { id: data.id },
                update: {
                    ...data,
                    updatedAt: now,
                    lastSyncAt: now
                },
                create: {
                    ...data,
                    createdAt: now,
                    updatedAt: now,
                    lastSyncAt: now
                }
            });
        } else {
            return FacebookAdModel.findByIdAndUpdate(
                data.id,
                { $set: { ...data, lastSyncAt: now } },
                { upsert: true, new: true }
            );
        }
    },

    async upsertManyFacebookAds(ads: any[]) {
        const mode = await getActiveDB();
        const now = new Date();
        
        if (mode === 'mysql') {
            // Use transaction for batch upsert
            const operations = ads.map(ad => 
                prisma.facebookAd.upsert({
                    where: { id: ad.id },
                    update: { ...ad, updatedAt: now, lastSyncAt: now },
                    create: { ...ad, createdAt: now, updatedAt: now, lastSyncAt: now }
                })
            );
            return prisma.$transaction(operations);
        } else {
            const bulkOps = ads.map(ad => ({
                updateOne: {
                    filter: { _id: ad.id },
                    update: { $set: { ...ad, lastSyncAt: now } },
                    upsert: true
                }
            }));
            return FacebookAdModel.bulkWrite(bulkOps);
        }
    },

    async getAdsByUser(userId: string) {
        const mode = await getActiveDB();
        
        if (mode === 'mysql') {
            const accounts = await prisma.adAccount.findMany({
                where: { userId },
                select: { id: true, name: true, currency: true }
            });
            
            if (accounts.length === 0) return [];
            
            const accountIds = accounts.map(a => a.id);
            const ads = await prisma.facebookAd.findMany({
                where: { adAccountId: { in: accountIds } },
                orderBy: { updatedAt: 'desc' }
            });
            
            // Map account info to ads
            const accountMap = new Map(accounts.map(a => [a.id, a]));
            return ads.map(ad => ({
                ...ad,
                accountName: accountMap.get(ad.adAccountId)?.name,
                currency: accountMap.get(ad.adAccountId)?.currency
            }));
        } else {
            const accounts = await AdAccountModel.find({ userId }).lean();
            if (accounts.length === 0) return [];
            
            const accountIds = accounts.map((a: any) => a._id);
            const ads = await FacebookAdModel.find({ adAccountId: { $in: accountIds } })
                .sort({ updatedAt: -1 })
                .lean();
            
            const accountMap = new Map(accounts.map((a: any) => [a._id, a]));
            return ads.map((ad: any) => ({
                ...ad,
                id: ad._id,
                accountName: (accountMap.get(ad.adAccountId) as any)?.name,
                currency: (accountMap.get(ad.adAccountId) as any)?.currency
            }));
        }
    },

    async getLastSyncTime(userId: string): Promise<Date | null> {
        const mode = await getActiveDB();
        
        if (mode === 'mysql') {
            const log = await prisma.adSyncLog.findFirst({
                where: { userId, status: 'SUCCESS' },
                orderBy: { completedAt: 'desc' }
            });
            return log?.completedAt || null;
        } else {
            const log = await AdSyncLogModel.findOne({ userId, status: 'SUCCESS' })
                .sort({ completedAt: -1 })
                .lean();
            return (log as any)?.completedAt || null;
        }
    },

    async createSyncLog(data: { userId: string; adAccountId?: string; syncType: string }) {
        const mode = await getActiveDB();
        const now = new Date();
        
        if (mode === 'mysql') {
            return prisma.adSyncLog.create({
                data: {
                    ...data,
                    status: 'IN_PROGRESS',
                    startedAt: now
                }
            });
        } else {
            return AdSyncLogModel.create({
                ...data,
                status: 'IN_PROGRESS',
                startedAt: now
            });
        }
    },

    async updateSyncLog(id: string, data: { status: string; adsCount?: number; error?: string }) {
        const mode = await getActiveDB();
        const now = new Date();
        
        if (mode === 'mysql') {
            return prisma.adSyncLog.update({
                where: { id },
                data: {
                    ...data,
                    completedAt: now
                }
            });
        } else {
            return AdSyncLogModel.findByIdAndUpdate(id, {
                $set: { ...data, completedAt: now }
            });
        }
    },

    async updateAdStatus(adId: string, status: string) {
        const mode = await getActiveDB();
        
        if (mode === 'mysql') {
            return prisma.facebookAd.update({
                where: { id: adId },
                data: { status, effectiveStatus: status, updatedAt: new Date() }
            });
        } else {
            return FacebookAdModel.findByIdAndUpdate(adId, {
                $set: { status, effectiveStatus: status }
            });
        }
    },

    async deleteAdsNotInList(adAccountId: string, activeAdIds: string[]) {
        const mode = await getActiveDB();
        
        if (mode === 'mysql') {
            return prisma.facebookAd.deleteMany({
                where: {
                    adAccountId,
                    id: { notIn: activeAdIds }
                }
            });
        } else {
            return FacebookAdModel.deleteMany({
                adAccountId,
                _id: { $nin: activeAdIds }
            });
        }
    },

    // Get ads by ad account ID (for polling comparison)
    async getAdsByAdAccount(adAccountId: string) {
        const mode = await getActiveDB();
        
        if (mode === 'mysql') {
            return prisma.facebookAd.findMany({
                where: { adAccountId }
            });
        } else {
            return FacebookAdModel.find({ adAccountId }).lean();
        }
    }
};

// ======================================
// Export for NextAuth Adapter
// ======================================
export { mongoose, UserModel, SessionModel, AccountModel };
