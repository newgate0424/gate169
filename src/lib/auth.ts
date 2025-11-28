import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                // @ts-ignore
                session.user.id = user.id;
                // Fetch the user from DB to get the facebookAccessToken
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                });
                // @ts-ignore
                session.user.facebookAccessToken = dbUser?.facebookAccessToken;
            }
            return session;
        },
    },
    pages: {
        signIn: '/', // Redirect to landing page for sign in
    },
};
