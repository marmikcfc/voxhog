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
import { use } from 'react'

const SUPPORTED_LANGUAGES_ACCENTS = {
    "Hindi": ["Bihari", "Bhojpuri", "Standard", "Haryanvi"],
    "English": ["Indian", "American", "British"],
    "Filipino": ["Standard", "Ilocano", "Cebuano"]
};

export default function TestCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [testCase, setTestCase] = useState<TestCase | null>(null);
    const [isLoadingTestCase, setIsLoadingTestCase] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [availableAccents, setAvailableAccents] = useState<string[]>([]);

    const { id } = use(params);
    // Store the ID in a state variable to avoid direct access to params.id
    const [testCaseId, setTestCaseId] = useState<string>(id);

    const form = useForm({
        defaultValues: {
            name: '',
            persona_name: '',
            persona_prompt: '',
            persona_language: '',
            persona_accent: '',
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

    useEffect(() => {
        if (testCase && metrics.length > 0) {
            // Initialize selected metrics from test case
            if (testCase.evaluator_metrics) {
                console.log("Setting selected metrics from test case:", testCase.evaluator_metrics);
                setSelectedMetrics(testCase.evaluator_metrics);
            }
        }
    }, [testCase, metrics]);

    useEffect(() => {
        if (selectedLanguage && SUPPORTED_LANGUAGES_ACCENTS[selectedLanguage as keyof typeof SUPPORTED_LANGUAGES_ACCENTS]) {
            setAvailableAccents(SUPPORTED_LANGUAGES_ACCENTS[selectedLanguage as keyof typeof SUPPORTED_LANGUAGES_ACCENTS]);
        } else {
            setAvailableAccents([]);
        }
        // Only reset accent if language actually changed, and not on initial load if accent is already set
        if (form.getValues('persona_language') === selectedLanguage && form.getValues('persona_accent')) {
            // Do not reset if language is the same and accent is already set (e.g. on load)
        } else {
            form.setValue('persona_accent', '');
        }
    }, [selectedLanguage, form]);

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

            // Set language and accent for persona
            if (data.user_persona.language) {
                form.setValue('persona_language', data.user_persona.language);
                setSelectedLanguage(data.user_persona.language); // Trigger accent update
            }
            if (data.user_persona.accent) {
                form.setValue('persona_accent', data.user_persona.accent);
            }

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
            console.log("Fetched metrics:", data);
            setMetrics(data);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
            toast.error('Failed to fetch metrics');
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    const toggleMetric = (metricId: string) => {
        console.log("Toggling metric:", metricId);
        console.log("Current selected metrics:", selectedMetrics);
        setSelectedMetrics(prev =>
            prev.includes(metricId)
                ? prev.filter(m => m !== metricId)
                : [...prev, metricId]
        );
    };

    const onSubmit = async (values: any) => {
        setIsSubmitting(true);
        try {
            console.log("Submitting with selected metrics:", selectedMetrics);

            // Format the data according to the API requirements
            const testCaseData = {
                name: values.name,
                user_persona: {
                    name: values.persona_name,
                    prompt: values.persona_prompt,
                    language: values.persona_language,
                    accent: values.persona_accent,
                },
                scenario: {
                    name: values.scenario_name,
                    prompt: values.scenario_prompt,
                },
                evaluator_metrics: selectedMetrics.length > 0 ? selectedMetrics : undefined,
            };

            console.log("Submitting test case data:", testCaseData);
            const updatedTestCase = await updateTestCase(testCaseId, testCaseData);
            console.log("Updated test case:", updatedTestCase);
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

                                <FormField
                                    control={form.control}
                                    name="persona_language"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona Language</FormLabel>
                                            <FormControl>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        setSelectedLanguage(e.target.value);
                                                    }}
                                                >
                                                    <option value="" disabled>Select Language</option>
                                                    {Object.keys(SUPPORTED_LANGUAGES_ACCENTS).map((lang) => (
                                                        <option key={lang} value={lang}>
                                                            {lang}
                                                        </option>
                                                    ))}
                                                </select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="persona_accent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona Accent</FormLabel>
                                            <FormControl>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    {...field}
                                                    disabled={!selectedLanguage || availableAccents.length === 0}
                                                >
                                                    <option value="" disabled>Select Accent</option>
                                                    {availableAccents.map((accent) => (
                                                        <option key={accent} value={accent}>
                                                            {accent}
                                                        </option>
                                                    ))}
                                                </select>
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
                                        {/* Debug information */}
                                        {(() => {
                                            console.log("Rendering metrics:", metrics);
                                            console.log("Selected metrics:", selectedMetrics);
                                            return null;
                                        })()}
                                        {metrics.map((metric) => {
                                            // Skip metrics without IDs
                                            if (!metric.id) return null;

                                            const isSelected = selectedMetrics.includes(metric.id);

                                            return (
                                                <div
                                                    key={metric.id}
                                                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${isSelected ? 'bg-primary/10 border-primary' : ''
                                                        }`}
                                                    onClick={() => toggleMetric(metric.id!)}
                                                >
                                                    <div className={`mt-1 h-4 w-4 flex-shrink-0 rounded-sm border ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                                                        }`}>
                                                        {isSelected && (
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
                                            );
                                        })}
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