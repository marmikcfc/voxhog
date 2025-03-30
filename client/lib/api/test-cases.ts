// Types for test cases
export interface UserPersona {
    name: string;
    prompt: string;
}

export interface Scenario {
    name: string;
    prompt: string;
}

export interface Metric {
    id?: string;
    name: string;
    prompt: string;
}

export interface TestCase {
    id: string;
    name: string;
    user_persona: UserPersona;
    scenario: Scenario;
    evaluator_metrics?: string[];
    created_at: string;
}

export interface CreateTestCaseData {
    name: string;
    user_persona: UserPersona;
    scenario: Scenario;
    evaluator_metrics?: string[];
}

// API functions for test cases
export async function getTestCases(): Promise<TestCase[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/test-cases', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test cases');
    }

    return response.json();
}

export async function getTestCase(id: string): Promise<TestCase> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-cases/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch test case');
    }

    return response.json();
}

export async function createTestCase(data: CreateTestCaseData): Promise<TestCase> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/test-cases', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create test case');
    }

    return response.json();
}

export async function updateTestCase(id: string, data: CreateTestCaseData): Promise<TestCase> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-cases/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update test case');
    }

    return response.json();
}

export async function deleteTestCase(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch(`/api/v1/test-cases/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to delete test case');
    }
}

// API functions for metrics
export async function getMetrics(): Promise<Metric[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/metrics', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch metrics');
    }

    return response.json();
}

export async function createMetric(data: Metric): Promise<Metric> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('Authentication required');
    }

    const response = await fetch('/api/v1/metrics', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create metric');
    }

    return response.json();
} 