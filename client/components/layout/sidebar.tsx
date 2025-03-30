import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface SidebarProps {
    username: string;
    onLogout: () => void;
}

export function Sidebar({ username, onLogout }: SidebarProps) {
    return (
        <div className="hidden border-r bg-gray-100/40 dark:bg-gray-800/40 lg:block">
            <div className="flex flex-col h-screen sticky top-0">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <span className="text-lg font-bold">VoxHog</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        <Link
                            href="/evaluations"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Evaluations
                        </Link>
                        <Link
                            href="/agents"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Voice Agents
                        </Link>
                        <Link
                            href="/test-cases"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Test Cases
                        </Link>
                        <Link
                            href="/test-cases/metrics"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Evaluation Metrics
                        </Link>
                        <Link
                            href="/test-runs"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Test Runs
                        </Link>
                        <Link
                            href="/credentials"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Credentials
                        </Link>
                    </nav>
                </div>
                <div className="border-t w-full bg-white dark:bg-gray-900 py-4 px-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10 border border-gray-200">
                                <AvatarImage alt={username} />
                                <AvatarFallback>{username.charAt(0).toLowerCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0.5">
                                <div className="font-medium text-sm truncate max-w-[120px]">{username}</div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onLogout}
                            className="font-medium border border-gray-300"
                        >
                            Logout
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MobileSidebar({ username, onLogout }: SidebarProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6"
                    >
                        <line x1="4" x2="20" y1="12" y2="12" />
                        <line x1="4" x2="20" y1="6" y2="6" />
                        <line x1="4" x2="20" y1="18" y2="18" />
                    </svg>
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] sm:w-[300px]">
                <div className="flex h-full flex-col">
                    <div className="flex h-14 items-center border-b px-4">
                        <Link href="/" className="flex items-center gap-2 font-semibold">
                            <span className="text-lg font-bold">VoxHog</span>
                        </Link>
                    </div>
                    <div className="flex-1 overflow-auto py-2">
                        <nav className="grid items-start px-2 text-sm font-medium">
                            <Link
                                href="/evaluations"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Evaluations
                            </Link>
                            <Link
                                href="/agents"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Voice Agents
                            </Link>
                            <Link
                                href="/test-cases"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Test Cases
                            </Link>
                            <Link
                                href="/test-cases/metrics"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Evaluation Metrics
                            </Link>
                            <Link
                                href="/test-runs"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Test Runs
                            </Link>
                            <Link
                                href="/credentials"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                                Credentials
                            </Link>
                        </nav>
                    </div>
                    <div className="border-t w-full bg-white dark:bg-gray-900 py-4 px-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-10 w-10 border border-gray-200">
                                    <AvatarImage alt={username} />
                                    <AvatarFallback>{username.charAt(0).toLowerCase()}</AvatarFallback>
                                </Avatar>
                                <div className="grid gap-0.5">
                                    <div className="font-medium text-sm truncate max-w-[120px]">{username}</div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onLogout}
                                className="font-medium border border-gray-300"
                            >
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
} 