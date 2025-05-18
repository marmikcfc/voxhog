// Types for test runs
export interface TestRun {
    id: string;
    agent_id: string;
    test_case_ids: string[];
    time_limit?: number;
    outbound_call_params?: Record<string, any>;
    status: string;
    started_at: string;
    completed_at?: string;
    results?: Record<string, any>;
}

export interface CreateTestRunData {
    agent_id: string;
    test_case_ids: string[];
    time_limit?: number;
    outbound_call_params?: Record<string, any>;
    language?: string;
    accent?: string;
}

// API functions for test runs
export async function getTestRuns(): Promise<TestRun[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/test-runs', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test runs');
    }

    return response.json();
}

export async function getTestRun(id: string): Promise<TestRun> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-runs/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test run');
    }

    return response.json();
}

export async function createTestRun(data: CreateTestRunData): Promise<TestRun> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/test-runs', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create test run');
    }

    return response.json();
}

export async function cancelTestRun(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-runs/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to cancel test run');
    }
}

export async function getTestRunTranscript(id: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-runs/${id}/transcript`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test run transcript');
    }

    return response.json();
}

// New function to generate a test run report
export async function generateTestRunReport(id: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-runs/${id}/report`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate test run report');
    }

    return response.json();
}

// New function to fetch a test run report
export async function getTestRunReport(id: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-runs/${id}/report`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test run report');
    }

    return response.json();
} 