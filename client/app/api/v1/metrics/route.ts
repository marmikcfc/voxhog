import { NextRequest, NextResponse } from 'next/server';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/metrics`, {
            headers: {
                'Authorization': authHeader
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to get metrics' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Metrics API error:', error);
        return NextResponse.json(
            { error: 'Failed to get metrics' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        const data = await request.json();

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/metrics`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: responseData.detail || 'Failed to create metric' },
                { status: response.status }
            );
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Metric creation API error:', error);
        return NextResponse.json(
            { error: 'Failed to create metric' },
            { status: 500 }
        );
    }
} 