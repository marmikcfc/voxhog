"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TestCase, getTestCases, deleteTestCase } from '@/lib/api/test-cases';
import Link from 'next/link';

export default function TestCasesPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [isLoadingTestCases, setIsLoadingTestCases] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchTestCases();
        }
    }, [isAuthenticated]);

    const fetchTestCases = async () => {
        setIsLoadingTestCases(true);
        try {
            const data = await getTestCases();
            setTestCases(data);
        } catch (error) {
            console.error('Failed to fetch test cases:', error);
            toast.error('Failed to fetch test cases');
        } finally {
            setIsLoadingTestCases(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this test case?')) {
            try {
                await deleteTestCase(id);
                toast.success('Test case deleted successfully');
                fetchTestCases();
            } catch (error) {
                console.error('Failed to delete test case:', error);
                toast.error('Failed to delete test case');
            }
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
                    <h1 className="text-3xl font-bold">Test Cases</h1>
                    <div className="flex gap-2">
                        <Button asChild>
                            <Link href="/test-cases/new">Create New Test Case</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/test-cases/metrics">Manage Metrics</Link>
                        </Button>
                    </div>
                </div>

                {isLoadingTestCases ? (
                    <div className="flex h-40 items-center justify-center">
                        <p>Loading test cases...</p>
                    </div>
                ) : testCases.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <h3 className="text-lg font-medium">No test cases found</h3>
                        <p className="mt-2 text-gray-500">
                            Create your first test case to get started.
                        </p>
                        <Button className="mt-4" asChild>
                            <Link href="/test-cases/new">Create Test Case</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {testCases.map((testCase) => (
                            <div
                                key={testCase.id}
                                className="rounded-lg border bg-card p-6 shadow-sm"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">{testCase.name}</h3>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    Persona: {testCase.user_persona.name}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Scenario: {testCase.scenario.name}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Created: {new Date(testCase.created_at).toLocaleDateString()}
                                </p>
                                {testCase.evaluator_metrics && testCase.evaluator_metrics.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-sm font-medium text-gray-700">Metrics:</p>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {testCase.evaluator_metrics.map((metric, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                                                >
                                                    {metric}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4 flex items-center gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/test-cases/${testCase.id}`}>View Details</Link>
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(testCase.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
} 