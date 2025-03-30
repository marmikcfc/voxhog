// Types for API keys and credentials
export interface ApiKey {
    id: string;
    service: string;
    key: string;
    description?: string;
    created_at: string;
}

export interface CreateApiKeyData {
    service: string;
    key: string;
    description?: string;
}

// API functions for credentials
export async function getApiKeys(): Promise<ApiKey[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/keys', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch API keys');
    }

    return response.json();
}

export async function createApiKey(data: CreateApiKeyData): Promise<ApiKey> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create API key');
    }

    return response.json();
}

export async function deleteApiKey(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/keys/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete API key' }));
        throw new Error(error.detail || 'Failed to delete API key');
    }
}

export async function getConfig(): Promise<{
    app_name: string;
    debug_mode: boolean;
    api_keys_configured: {
        openai: boolean;
        twilio_sid_token: boolean;
        twilio_phone_number: boolean;
        vapi: boolean;
        cartesia?: boolean;
        deepgram?: boolean;
        voice_agent_api?: boolean;
        voice_agent_api_auth_token?: boolean;
    };
}> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/config', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch configuration');
    }

    return response.json();
} 