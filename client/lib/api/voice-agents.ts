// Types for voice agents
export interface VoiceAgent {
    id: string;
    agent_id: string;
    agent_type: string;
    connection_details: Record<string, any>;
    direction: string;
    created_at: string;
    persona?: string;
    scenario?: string;
}

export interface CreateVoiceAgentData {
    agent_id: string;
    agent_type: string;
    connection_details: Record<string, any>;
    direction: string;
}

export interface UpdatePersonaData {
    persona: string;
    scenario: string;
}

// API functions for voice agents
export async function getVoiceAgents(): Promise<VoiceAgent[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/agents', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch voice agents');
    }

    return response.json();
}

export async function getVoiceAgent(id: string): Promise<VoiceAgent> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/agents/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch voice agent');
    }

    return response.json();
}

export async function createVoiceAgent(data: CreateVoiceAgentData): Promise<VoiceAgent> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create voice agent');
    }

    return response.json();
}

export async function updateVoiceAgent(id: string, data: CreateVoiceAgentData): Promise<VoiceAgent> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/agents/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update voice agent');
    }

    return response.json();
}

export async function deleteVoiceAgent(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/agents/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete voice agent');
    }
}

export async function updateVoiceAgentPersona(id: string, data: UpdatePersonaData): Promise<VoiceAgent> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/agents/${id}/persona`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update voice agent persona');
    }

    return response.json();
} 