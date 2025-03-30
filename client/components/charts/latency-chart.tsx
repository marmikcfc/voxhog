import * as React from "react"
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/charts"
import { fetchLatencyData, getPeriodKey, LatencyDataPoint } from "@/lib/api/latency-data"
import { Loader } from "@/components/ui/loader"

interface LatencyChartProps {
    period?: string;
}

export function LatencyChart({ period = "1 hour" }: LatencyChartProps) {
    const [chartData, setChartData] = React.useState<LatencyDataPoint[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [maxValue, setMaxValue] = React.useState<number>(3000);

    // Fetch latency data on component mount and when period changes
    React.useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const data = await fetchLatencyData();
                const periodKey = getPeriodKey(period);
                const periodData = data.periodData[periodKey as keyof typeof data.periodData];

                if (periodData) {
                    setChartData(periodData.dataPoints);
                    setMaxValue(periodData.maxValue);
                }
            } catch (error) {
                console.error("Failed to load latency data:", error);
                // Fallback to empty data
                setChartData([]);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [period]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="h-48 w-full flex items-center justify-center bg-blue-50 bg-opacity-50">
                <Loader />
            </div>
        );
    }

    // Show empty state if no data
    if (chartData.length === 0) {
        return (
            <div className="h-48 w-full flex items-center justify-center bg-blue-50 bg-opacity-50">
                <div className="text-gray-500">No data available for this period</div>
            </div>
        );
    }

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                        dataKey="timestamp"
                        className="text-xs text-gray-500"
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: 'currentColor' }}
                    />
                    <YAxis
                        className="text-xs text-gray-500"
                        tickLine={false}
                        tickFormatter={(value) => `${value}ms`}
                        tickMargin={10}
                        tick={{ fill: 'currentColor' }}
                        domain={[0, maxValue]}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-3 gap-2">
                                            {payload.map((entry: any) => (
                                                <div key={entry.name} className="flex flex-col">
                                                    <span
                                                        className="text-[0.70rem] uppercase"
                                                        style={{ color: entry.color }}
                                                    >
                                                        {entry.name}
                                                    </span>
                                                    <span className="font-bold">{entry.value}ms</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-1 border-t pt-1 text-xs text-muted-foreground">
                                            {label}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="p50"
                        stroke="#2563eb"
                        fillOpacity={1}
                        fill="url(#colorP50)"
                        name="p50"
                        stackId="1"
                    />
                    <Area
                        type="monotone"
                        dataKey="p90"
                        stroke="#60a5fa"
                        fillOpacity={1}
                        fill="url(#colorP90)"
                        name="p90"
                        stackId="1"
                    />
                    <Area
                        type="monotone"
                        dataKey="p95"
                        stroke="#93c5fd"
                        fillOpacity={1}
                        fill="url(#colorP95)"
                        name="p95"
                        stackId="1"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
} 