// Types for latency data
export interface LatencyDataPoint {
    timestamp: string;
    p50: number;
    p90: number;
    p95: number;
}

export interface PeriodData {
    average: {
        p50: string;
        p90: string;
        p95: string;
    };
    dataPoints: LatencyDataPoint[];
    maxValue: number;
    highlight?: {
        timestamp: string;
        p50: string;
        p90: string;
        p95: string;
    };
}

export interface LatencyData {
    overallStats: {
        last2days: {
            p50: string;
            p90: string;
            p95: string;
        };
    };
    periodData: {
        "5min": PeriodData;
        "30min": PeriodData;
        "1hour": PeriodData;
        "6hours": PeriodData;
        "12hours": PeriodData;
        "24hours": PeriodData;
    };
}

// Function to fetch latency data
export async function fetchLatencyData(): Promise<LatencyData> {
    try {
        // Add a small delay to simulate network latency
        await new Promise(resolve => setTimeout(resolve, 300));

        // Determine the base URL
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

        // Fetch the JSON file from the public directory with absolute path
        const response = await fetch(`${baseUrl}/data/latency-data.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data: LatencyData = await response.json();
        console.log('Successfully fetched latency data');
        return data;
    } catch (error) {
        console.error('Error fetching latency data:', error);
        throw error;
    }
}

// Helper function to get the correct period key for the API
export function getPeriodKey(period: string): string {
    // Map the dropdown values to the keys in the JSON data
    const periodMap: Record<string, string> = {
        "5 min": "5min",
        "30 min": "30min",
        "1 hour": "1hour",
        "6 hours": "6hours",
        "12 hours": "12hours",
        "24 hours": "24hours"
    };

    return periodMap[period] || "1hour"; // Default to 1hour if no match
} 