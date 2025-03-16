import { NextRequest, NextResponse } from 'next/server';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
        const response = await fetch(`${API_URL}/api/v1/keys/${params.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            let errorMessage = 'Failed to delete API key';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                // If response is not JSON, use default error message
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('API key deletion error:', error);
        return NextResponse.json(
            { error: 'Failed to delete API key' },
            { status: 500 }
        );
    }
} 