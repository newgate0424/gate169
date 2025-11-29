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
    facebookAccessToken: String,
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

// Create indexes
conversationSchema.index({ pageId: 1 });
conversationSchema.index({ adId: 1 });
conversationSchema.index({ lastMessageAt: -1 });
messageSchema.index({ conversationId: 1 });

// MongoDB Models
let UserModel: mongoose.Model<any>;
let SessionModel: mongoose.Model<any>;
let AccountModel: mongoose.Model<any>;
let ConversationModel: mongoose.Model<any>;
let MessageModel: mongoose.Model<any>;
let PageSettingsModel: mongoose.Model<any>;

// Initialize models only once
function initModels() {
    if (!UserModel) {
        UserModel = mongoose.models.User || mongoose.model('User', userSchema);
        SessionModel = mongoose.models.Session || mongoose.model('Session', sessionSchema);
        AccountModel = mongoose.models.Account || mongoose.model('Account', accountSchema);
        ConversationModel = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
        MessageModel = mongoose.models.Message || mongoose.model('Message', messageSchema);
        PageSettingsModel = mongoose.models.PageSettings || mongoose.model('PageSettings', pageSettingsSchema);
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
                where: { facebookAccessToken: { not: null } },
                select: { facebookAccessToken: true }
            });
        } else {
            const users = await UserModel.find({ facebookAccessToken: { $ne: null } })
                .select('facebookAccessToken')
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
                select: { facebookAccessToken: true }
            });
        } else {
            const user = await UserModel.findById(userId).select('facebookAccessToken').lean();
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
            PageSettings: PageSettingsModel
        };
    },

    // ---- Get current mode ----
    async getMode() {
        return getActiveDB();
    }
};

// ======================================
// Export for NextAuth Adapter
// ======================================
export { mongoose, UserModel, SessionModel, AccountModel };
