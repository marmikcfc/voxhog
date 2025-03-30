import { MobileSidebar } from "./sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
    username: string;
    onLogout: () => void;
}

export function Navbar({ username, onLogout }: NavbarProps) {
    return (
        <div className="flex h-14 items-center gap-4 border-b bg-white px-4 dark:bg-gray-950 lg:h-[60px] lg:px-6">
            <MobileSidebar username={username} onLogout={onLogout} />
            <div className="flex-1"></div>
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 px-2 py-1 rounded-md outline-none hover:bg-gray-100 transition-colors">
                            <Avatar className="h-10 w-10">
                                <AvatarImage alt={username} />
                                <AvatarFallback>{username.charAt(0).toLowerCase()}</AvatarFallback>
                            </Avatar>
                            <span className="hidden text-sm font-medium md:inline-block">
                                {username}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500">
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium">{username}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onLogout}
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mr-2 h-4 w-4"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
} 