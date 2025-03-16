import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
    children: ReactNode;
    username: string;
    onLogout: () => void;
}

export function DashboardLayout({
    children,
    username,
    onLogout,
}: DashboardLayoutProps) {
    return (
        <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
            <Sidebar username={username} onLogout={onLogout} />
            <div className="flex flex-col">
                <Navbar username={username} onLogout={onLogout} />
                <main className="flex-1 p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
} 