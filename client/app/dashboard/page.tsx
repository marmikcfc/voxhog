"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function Dashboard() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-lg">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect to home page
    }

    return (
        <DashboardLayout
            username={user?.username || 'User'}
            onLogout={logout}
        >
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">Logged In</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        Welcome back, {user?.username || 'User'}!
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
} 