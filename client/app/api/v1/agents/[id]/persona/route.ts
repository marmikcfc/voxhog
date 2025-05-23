import { NextRequest, NextResponse } from 'next/server';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://voxhog.onrender.com';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        const paramsData = await params;
        const id = paramsData.id;

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        const data = await request.json();
        console.log('Persona update API route received data:', data);
        console.log('Agent ID:', id);

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/api/v1/agents/${id}/persona`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();
        console.log('Persona update API response:', responseData);

        if (!response.ok) {
            console.error('Persona update API error:', responseData);
            return NextResponse.json(
                { error: responseData.detail || 'Failed to update voice agent persona' },
                { status: response.status }
            );
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Voice agent persona update API error:', error);
        return NextResponse.json(
            { error: 'Failed to update voice agent persona' },
            { status: 500 }
        );
    }
} 