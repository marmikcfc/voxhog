export interface CallData {
    id: string;
    ttfw: string;
    p50: string;
    p90: string;
    p95: string;
    agentRushingIncident: number;
    evalResults: string;
    createdAt: string;
    llm: string;
    voiceProvider: string;
    voiceName: string;
}

/**
 * Fetches call data from the server
 * @param timeRange - Time range filter
 * @param agentFilter - Agent filter
 * @returns Promise with call data
 */
export async function fetchCallsData(
    timeRange: string = '2 days',
    agentFilter: string = 'all agents'
): Promise<CallData[]> {
    // In a real app with a backend, we would use:
    // return fetch(`/api/calls?timeRange=${timeRange}&agentFilter=${agentFilter}`).then(res => res.json())

    // For this demo, we'll fetch from our static JSON file
    try {
        // Add a small delay to simulate network latency
        await new Promise(resolve => setTimeout(resolve, 800));

        // Determine the base URL
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

        // Fetch the JSON file from the public directory with absolute path
        const response = await fetch(`${baseUrl}/data/calls-data.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: CallData[] = await response.json();
        console.log('Successfully fetched calls data:', data);

        // Apply filters (in a real app, this would be done on the server)
        let filteredData = [...data];

        // Filter by agent if not 'all agents'
        if (agentFilter !== 'all agents') {
            filteredData = filteredData.filter(call => call.voiceName.toLowerCase() === agentFilter.toLowerCase());
        }

        // Here you could add time range filtering logic as well

        return filteredData;
    } catch (error) {
        console.error('Error fetching calls data:', error);
        return [];
    }
} 