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
                        <button className="flex items-center gap-2 rounded-full outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage alt={username} />
                                <AvatarFallback>{username.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="hidden text-sm font-medium md:inline-block">
                                {username}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
} 