import * as React from "react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Check, ChevronUp, ChevronDown } from "lucide-react"

interface PeriodDropdownProps {
    value: string
    onValueChange: (value: string) => void
}

const PERIOD_OPTIONS = [
    "5 min",
    "30 min",
    "1 hour",
    "6 hours",
    "12 hours",
    "24 hours"
]

export function PeriodDropdown({
    value,
    onValueChange,
}: PeriodDropdownProps) {
    const [open, setOpen] = React.useState(false)

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="flex items-center gap-1 border rounded-md px-3 py-1 bg-white hover:bg-gray-50 transition-colors text-sm min-w-[100px] justify-between">
                {value}
                {open ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px] rounded-md p-0">
                {PERIOD_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option}
                        className={`px-4 py-2 text-sm flex items-center justify-between ${option === value ? 'bg-blue-50' : ''}`}
                        onSelect={() => {
                            onValueChange(option)
                            setOpen(false)
                        }}
                    >
                        {option}
                        {option === value && (
                            <Check className="h-4 w-4 text-blue-600" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
} 