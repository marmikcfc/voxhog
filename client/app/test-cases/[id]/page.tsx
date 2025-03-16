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
import {
    TestCase,
    Metric,
    getTestCase,
    updateTestCase,
    getMetrics
} from '@/lib/api/test-cases';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

export default function TestCaseDetailPage({ params }: { params: { id: string } }) {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [testCase, setTestCase] = useState<TestCase | null>(null);
    const [isLoadingTestCase, setIsLoadingTestCase] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

    // Store the ID in a state variable to avoid direct access to params.id
    const [testCaseId, setTestCaseId] = useState<string>('');

    // Set the ID once when the component mounts
    useEffect(() => {
        if (params && params.id) {
            setTestCaseId(params.id);
        }
    }, [params]);

    const form = useForm({
        defaultValues: {
            name: '',
            persona_name: '',
            persona_prompt: '',
            scenario_name: '',
            scenario_prompt: '',
        },
    });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && testCaseId) {
            fetchTestCase();
            fetchMetrics();
        }
    }, [isAuthenticated, testCaseId]);

    const fetchTestCase = async () => {
        setIsLoadingTestCase(true);
        try {
            const data = await getTestCase(testCaseId);
            setTestCase(data);

            // Set form values
            form.setValue('name', data.name);
            form.setValue('persona_name', data.user_persona.name);
            form.setValue('persona_prompt', data.user_persona.prompt);
            form.setValue('scenario_name', data.scenario.name);
            form.setValue('scenario_prompt', data.scenario.prompt);

            // Set selected metrics
            if (data.evaluator_metrics && data.evaluator_metrics.length > 0) {
                setSelectedMetrics(data.evaluator_metrics);
            }
        } catch (error) {
            console.error('Failed to fetch test case:', error);
            toast.error('Failed to fetch test case');
        } finally {
            setIsLoadingTestCase(false);
        }
    };

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

    const toggleMetric = (metricName: string) => {
        setSelectedMetrics(prev =>
            prev.includes(metricName)
                ? prev.filter(m => m !== metricName)
                : [...prev, metricName]
        );
    };

    const onSubmit = async (values: any) => {
        setIsSubmitting(true);
        try {
            // Format the data according to the API requirements
            const testCaseData = {
                name: values.name,
                user_persona: {
                    name: values.persona_name,
                    prompt: values.persona_prompt,
                },
                scenario: {
                    name: values.scenario_name,
                    prompt: values.scenario_prompt,
                },
                evaluator_metrics: selectedMetrics.length > 0 ? selectedMetrics : undefined,
            };

            const updatedTestCase = await updateTestCase(testCaseId, testCaseData);
            setTestCase(updatedTestCase);
            toast.success('Test case updated successfully');
        } catch (error) {
            console.error('Failed to update test case:', error);
            toast.error('Failed to update test case');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || isLoadingTestCase) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-lg">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated || !testCase) {
        return null; // Will redirect to home page or show error
    }

    return (
        <DashboardLayout
            username={user?.username || 'User'}
            onLogout={logout}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Edit Test Case</h1>
                    <Button variant="outline" asChild>
                        <Link href="/test-cases">Back to Test Cases</Link>
                    </Button>
                </div>

                <div className="rounded-lg border p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Test Case Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter test case name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="text-lg font-medium">User Persona</h3>

                                <FormField
                                    control={form.control}
                                    name="persona_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter persona name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="persona_prompt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona Prompt</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Enter persona prompt"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="text-lg font-medium">Scenario</h3>

                                <FormField
                                    control={form.control}
                                    name="scenario_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Scenario Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter scenario name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="scenario_prompt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Scenario Prompt</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Enter scenario prompt"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="text-lg font-medium">Evaluation Metrics</h3>

                                {isLoadingMetrics ? (
                                    <p>Loading metrics...</p>
                                ) : metrics.length === 0 ? (
                                    <div className="text-center py-4">
                                        <p className="text-gray-500">No metrics available</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            asChild
                                        >
                                            <Link href="/test-cases/metrics">Create Metrics</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        {metrics.map((metric) => (
                                            <div
                                                key={metric.id || metric.name}
                                                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${selectedMetrics.includes(metric.name)
                                                    ? 'bg-primary/10 border-primary'
                                                    : ''
                                                    }`}
                                                onClick={() => toggleMetric(metric.name)}
                                            >
                                                <div className={`mt-1 h-4 w-4 flex-shrink-0 rounded-sm border ${selectedMetrics.includes(metric.name)
                                                    ? 'bg-primary border-primary'
                                                    : 'border-gray-300'
                                                    }`}>
                                                    {selectedMetrics.includes(metric.name) && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{metric.name}</p>
                                                    <p className="text-xs text-gray-500 mt-1 break-words">{metric.prompt}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Updating...' : 'Update Test Case'}
                            </Button>
                        </form>
                    </Form>
                </div>
            </div>
        </DashboardLayout>
    );
} 