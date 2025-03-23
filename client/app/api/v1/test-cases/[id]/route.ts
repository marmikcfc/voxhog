import { NextRequest, NextResponse } from 'next/server';
// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        const id: any = (await params).id;
        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-cases/${id}`, {
            headers: {
                'Authorization': authHeader
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.detail || 'Failed to get test case' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Test case API error:', error);
        return NextResponse.json(
            { error: 'Failed to get test case' },
            { status: 500 }
        );
    }
}

export async function PUT(
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

        const data = await request.json();
        const id: any = (await params).id;
        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-cases/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: responseData.detail || 'Failed to update test case' },
                { status: response.status }
            );
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Test case update API error:', error);
        return NextResponse.json(
            { error: 'Failed to update test case' },
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

        const id: any = (await params).id;
        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/test-cases/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: data.detail || 'Failed to delete test case' },
                { status: response.status }
            );
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Test case deletion API error:', error);
        return NextResponse.json(
            { error: 'Failed to delete test case' },
            { status: 500 }
        );
    }
} 