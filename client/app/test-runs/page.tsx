"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TestRun, getTestRuns, cancelTestRun } from '@/lib/api/test-runs';
import Link from 'next/link';

export default function TestRunsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [isLoadingTestRuns, setIsLoadingTestRuns] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchTestRuns();

            // Poll for updates every 5 seconds for active test runs
            const interval = setInterval(() => {
                fetchTestRuns();
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    const fetchTestRuns = async () => {
        try {
            const data = await getTestRuns();
            setTestRuns(data);
        } catch (error) {
            console.error('Failed to fetch test runs:', error);
            toast.error('Failed to fetch test runs');
        } finally {
            setIsLoadingTestRuns(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (window.confirm('Are you sure you want to cancel this test run?')) {
            try {
                await cancelTestRun(id);
                toast.success('Test run cancelled successfully');
                fetchTestRuns();
            } catch (error) {
                console.error('Failed to cancel test run:', error);
                toast.error('Failed to cancel test run');
            }
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400';
            case 'running':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
        }
    };

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
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Test Runs</h1>
                    <Button asChild>
                        <Link href="/test-runs/new">Create New Test Run</Link>
                    </Button>
                </div>

                {isLoadingTestRuns ? (
                    <div className="flex h-40 items-center justify-center">
                        <p>Loading test runs...</p>
                    </div>
                ) : testRuns.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <h3 className="text-lg font-medium">No test runs found</h3>
                        <p className="mt-2 text-gray-500">
                            Create your first test run to get started.
                        </p>
                        <Button className="mt-4" asChild>
                            <Link href="/test-runs/new">Create Test Run</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-lg border shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Test Run ID</th>
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Agent ID</th>
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Started</th>
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Completed</th>
                                    <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider">Test Cases</th>
                                    <th className="text-right py-3 px-4 font-medium text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {testRuns.map((testRun) => (
                                    <tr key={testRun.id} className="border-b hover:bg-muted/50 transition-colors">
                                        <td className="py-3 px-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                Test Run {testRun.id.substring(0, 8)}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(testRun.status)}`}>
                                                {testRun.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            <span className="font-mono text-xs">{testRun.agent_id}</span>
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            {new Date(testRun.started_at).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            {testRun.completed_at ? new Date(testRun.completed_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            {testRun.test_case_ids.length}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/test-runs/${testRun.id}`}>View Details</Link>
                                                </Button>
                                                {(testRun.status === 'pending' || testRun.status === 'running') && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleCancel(testRun.id)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
} 