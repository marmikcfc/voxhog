export interface LatencyDataPoint {
    timestamp: string;
    p50: number;
    p90: number;
    p95: number;
}

export interface HighlightPoint {
    timestamp: string;
    p50: string;
    p90: string;
    p95: string;
}

export interface PeriodData {
    average: {
        p50: string;
        p90: string;
        p95: string;
    };
    dataPoints: LatencyDataPoint[];
    highlight?: HighlightPoint;
    maxValue: number;
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
        [key: string]: PeriodData;
    };
}

/**
 * Fetches latency data from the server
 * @returns Promise with latency data
 */
export async function fetchLatencyData(): Promise<LatencyData> {
    // In a real app, this would fetch from a dynamic API endpoint
    try {
        // Add a small delay to simulate network latency
        await new Promise(resolve => setTimeout(resolve, 500));

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
        // Return empty data structure in case of error
        return {
            overallStats: {
                last2days: {
                    p50: '0ms',
                    p90: '0ms',
                    p95: '0ms'
                }
            },
            periodData: {}
        };
    }
}

/**
 * Gets data for a specific period
 * @param data - The complete latency data
 * @param period - The period to get data for (e.g., '1hour', '5min')
 * @returns The period-specific data
 */
export function getPeriodData(data: LatencyData, period: string): PeriodData | null {
    if (!data.periodData[period]) {
        return null;
    }

    return data.periodData[period];
} 