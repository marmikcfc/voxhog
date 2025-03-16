"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { getMetrics, createMetric, Metric } from '@/lib/api/test-cases';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

export default function MetricsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm({
        defaultValues: {
            name: '',
            prompt: '',
        },
    });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchMetrics();
        }
    }, [isAuthenticated]);

    const fetchMetrics = async () => {
        setIsLoadingMetrics(true);
        try {
            const data = await getMetrics();
            setMetrics(data);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
            toast.error('Failed to fetch metrics');
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    const onSubmit = async (values: any) => {
        setIsSubmitting(true);
        try {
            await createMetric(values);
            toast.success('Metric created successfully');
            form.reset();
            fetchMetrics();
        } catch (error) {
            console.error('Failed to create metric:', error);
            toast.error('Failed to create metric');
        } finally {
            setIsSubmitting(false);
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
                    <h1 className="text-3xl font-bold">Evaluation Metrics</h1>
                    <Button variant="outline" asChild>
                        <Link href="/test-cases">Back to Test Cases</Link>
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-lg border p-6">
                        <h2 className="text-xl font-bold mb-4">Create New Metric</h2>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Metric Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter metric name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="prompt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Metric Prompt</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Enter metric prompt (e.g., 'Evaluate if the agent was polite and professional throughout the conversation.')"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? 'Creating...' : 'Create Metric'}
                                </Button>
                            </form>
                        </Form>
                    </div>

                    <div className="rounded-lg border p-6">
                        <h2 className="text-xl font-bold mb-4">Existing Metrics</h2>

                        {isLoadingMetrics ? (
                            <div className="flex h-40 items-center justify-center">
                                <p>Loading metrics...</p>
                            </div>
                        ) : metrics.length === 0 ? (
                            <div className="flex h-40 items-center justify-center">
                                <p className="text-gray-500">No metrics found. Create your first metric.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {metrics.map((metric) => (
                                    <div
                                        key={metric.id || metric.name}
                                        className="rounded-lg border p-4"
                                    >
                                        <h3 className="font-medium">{metric.name}</h3>
                                        <p className="mt-1.5 text-sm text-gray-500 break-words">{metric.prompt}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 