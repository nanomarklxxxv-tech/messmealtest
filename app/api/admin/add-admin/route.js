import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../../src/lib/firebaseAdmin';
import { sendAdminNotificationEmail } from '../../../../src/lib/mailer';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Verify Firebase auth token
async function verifyAuth(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return null;
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        return null;
    }
}

// Check if user is super_admin
async function isSuperAdmin(uid, appId) {
    try {
        const userDoc = await adminDb
            .collection('artifacts')
            .doc(appId)
            .collection('users')
            .doc(uid)
            .get();
        
        return userDoc.data()?.role === 'super_admin';
    } catch {
        return false;
    }
}

export async function POST(request) {
    try {
        // 1. AUTHENTICATION - Verify user is authenticated
        const authUser = await verifyAuth(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or missing authentication token' },
                { status: 401 }
            );
        }

        // 2. Parse and validate request body
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { email } = body;

        // 3. INPUT VALIDATION - Validate email format
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required and must be a string' },
                { status: 400 }
            );
        }

        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const appId = 'messmeal-default';

        // 4. AUTHORIZATION - Verify caller is super_admin
        const isSuperAdminUser = await isSuperAdmin(authUser.uid, appId);
        if (!isSuperAdminUser) {
            return NextResponse.json(
                { error: 'Forbidden: Only super admins can add admins' },
                { status: 403 }
            );
        }

        // 5. Find the user by email in Firestore
        const usersRef = adminDb
            .collection('artifacts')
            .doc(appId)
            .collection('users');
        
        const snap = await usersRef.where('email', '==', trimmedEmail).get();

        if (snap.empty) {
            return NextResponse.json(
                { error: 'User not found. They must sign up first.' },
                { status: 404 }
            );
        }

        const userDoc = snap.docs[0];
        const userId = userDoc.id;

        // 6. Update user role to admin
        await userDoc.ref.update({
            role: 'admin',
            approved: true,
            adminAddedBy: authUser.uid,
            adminAddedAt: new Date()
        });

        // 7. Send notification email (non-blocking)
        try {
            await sendAdminNotificationEmail(trimmedEmail, 'Admin', 'ADD_ADMIN');
        } catch (mailError) {
            // Log errors securely (avoid exposing internal details)
            console.error('Email notification failed');
        }

        return NextResponse.json({
            success: true,
            message: `${trimmedEmail} has been granted admin access`
        });

    } catch (error) {
        // Don't expose internal error details to client
        console.error('Add Admin API Error');
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Prevent other HTTP methods
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}
