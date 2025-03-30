import { NextRequest, NextResponse } from 'next/server';

// Remove the use import as it's not needed in API routes
// import { use } from 'react';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }  // Change the type to directly access id
) {
    try {
        const authHeader = request.headers.get('Authorization');

        // Access id directly from params
        const paramsData = await params;
        const id = paramsData.id;


        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-runs/${id}/transcript`, {
            headers: {
                'Authorization': authHeader
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to get test run transcript' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Test run transcript API error:', error);
        return NextResponse.json(
            { error: 'Failed to get test run transcript' },
            { status: 500 }
        );
    }
} 