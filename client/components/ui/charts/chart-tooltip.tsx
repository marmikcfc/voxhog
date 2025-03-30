import * as React from "react"

interface ChartTooltipProps {
    active?: boolean
    payload?: Array<{
        value: number | string
        name: string
        color: string
    }>
    label?: string
}

export function ChartTooltipContent({
    active,
    payload,
    label,
}: ChartTooltipProps) {
    if (!active || !payload?.length) return null

    return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
                {payload.map((entry) => (
                    <div key={entry.name} className="flex flex-col">
                        <span
                            className="text-[0.70rem] uppercase text-muted-foreground"
                            style={{
                                color: entry.color,
                            }}
                        >
                            {entry.name}
                        </span>
                        <span className="font-bold">{entry.value}</span>
                    </div>
                ))}
            </div>
            <div className="mt-1 border-t pt-1 text-xs text-muted-foreground">
                {label}
            </div>
        </div>
    )
} 