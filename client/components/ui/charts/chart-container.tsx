import * as React from "react"
import { cn } from "@/lib/utils"
import { ResponsiveContainer } from "recharts"

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactElement
}

export function ChartContainer({
    className,
    children,
    ...props
}: ChartContainerProps) {
    return (
        <div
            className={cn("h-80 w-full", className)}
            {...props}
        >
            <ResponsiveContainer width="100%" height="100%">
                {children}
            </ResponsiveContainer>
        </div>
    )
} 