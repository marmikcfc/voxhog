import { NextRequest, NextResponse } from 'next/server';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-runs/${params.id}`, {
            headers: {
                'Authorization': authHeader
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to get test run' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Test run API error:', error);
        return NextResponse.json(
            { error: 'Failed to get test run' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-runs/${params.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: data.detail || 'Failed to cancel test run' },
                { status: response.status }
            );
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Test run cancellation API error:', error);
        return NextResponse.json(
            { error: 'Failed to cancel test run' },
            { status: 500 }
        );
    }
} 