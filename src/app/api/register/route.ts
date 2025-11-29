import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { username, email, password, name } = await request.json();

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user using dual database
        const mode = await db.getMode();
        let newUser;

        if (mode === 'mysql') {
            newUser = await db.prisma.user.create({
                data: {
                    email,
                    username: username || null,
                    name: name || username || email.split('@')[0],
                    password: hashedPassword,
                },
            });
        } else {
            // MongoDB
            const UserModel = db.models.User;
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            newUser = await UserModel.create({
                _id: userId,
                email,
                username: username || null,
                name: name || username || email.split('@')[0],
                password: hashedPassword,
            });
            newUser = { ...newUser.toObject(), id: newUser._id };
        }

        return NextResponse.json(
            {
                message: 'User created successfully',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        );
    }
}
