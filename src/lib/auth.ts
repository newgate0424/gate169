import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { DualDatabaseAdapter, prisma } from "./auth-adapter";
import { db } from "./db";

// Test database connection on startup
prisma.$connect()
    .then(() => {
        console.log('✅ [Database] Connected successfully to MySQL');
    })
    .catch((error: Error) => {
        console.error('❌ [Database] MySQL unavailable, will use MongoDB fallback');
    });

export const authOptions: NextAuthOptions = {
    adapter: DualDatabaseAdapter(),
    debug: process.env.NODE_ENV === 'development', // Enable NextAuth debug logs
    session: {
        strategy: "jwt", // Use JWT for credentials provider
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Please enter email and password');
                }

                // Find user by email
                const user = await db.findUserByEmail(credentials.email);

                if (!user || !user.password) {
                    throw new Error('Invalid email or password');
                }

                // Verify password
                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    throw new Error('Invalid email or password');
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            }
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            console.log('🔐 [Auth] Sign-in attempt:', {
                email: user.email,
                provider: account?.provider
            });
            return true;
        },
        async jwt({ token, user, account }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.picture = user.image;
            }
            return token;
        },
        async session({ session, token }) {
            // Add user id to session
            if (session.user && token) {
                // @ts-ignore
                session.user.id = token.id || token.sub;

                // Fetch the user from DB to get the facebookPageToken and facebookAdToken
                try {
                    // @ts-ignore
                    const dbUser = await db.findUserWithToken(token.id || token.sub);
                    // @ts-ignore
                    session.user.facebookPageToken = dbUser?.facebookPageToken;
                    // @ts-ignore
                    session.user.facebookAdToken = dbUser?.facebookAdToken;
                    console.log('✅ [Auth] Session loaded successfully');
                } catch (error) {
                    console.error('❌ [Auth] Failed to load user from DB:', error);
                }
            }
            return session;
        },
    },
    events: {
        async signIn({ user }) {
            console.log('✅ [Auth] User signed in:', user.email);
        },
        async signOut({ session }) {
            console.log('👋 [Auth] User signed out');
        },
        async createUser({ user }) {
            console.log('🆕 [Auth] New user created:', user.email);
        },
        async linkAccount({ user, account, profile }) {
            console.log('🔗 [Auth] Account linked:', { userId: user.id, provider: account.provider });

            if (account.provider === 'google' && profile) {
                try {
                    const mode = await db.getMode();
                    // @ts-ignore
                    const image = profile.picture || profile.image || profile.avatar_url;
                    // @ts-ignore
                    const email = profile.email;

                    if (mode === 'mysql') {
                        // Use raw query to bypass Prisma Client validation
                        await db.prisma.$executeRaw`
                            UPDATE Account 
                            SET providerEmail = ${email}, providerImage = ${image}
                            WHERE provider = ${account.provider} AND providerAccountId = ${account.providerAccountId}
                        `;
                    } else {
                        const { Account } = db.models;
                        await Account.updateOne(
                            { provider: account.provider, providerAccountId: account.providerAccountId },
                            { $set: { providerEmail: email, providerImage: image } }
                        );
                    }
                } catch (error) {
                    console.error('❌ [Auth] Failed to update account profile:', error);
                }
            }
        },
    },
    pages: {
        signIn: '/login', // Redirect to login page
        error: '/login', // Redirect errors to login page to avoid redirect loop
    },
};
