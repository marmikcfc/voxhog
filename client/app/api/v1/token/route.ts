import { NextRequest, NextResponse } from 'next/server';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // OAuth2PasswordRequestForm expects username and password fields
        const username = formData.get('username');
        const password = formData.get('password');

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Create a URLSearchParams object with the correct field names
        const params = new URLSearchParams();
        params.append('username', username.toString());
        params.append('password', password.toString());

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Authentication failed' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Token API error:', error);
        return NextResponse.json(
            { error: 'Failed to authenticate' },
            { status: 500 }
        );
    }
} 