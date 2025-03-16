"use client";

import { useEffect, useState, useRef } from 'react';
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
import { createTestRun } from '@/lib/api/test-runs';
import { getVoiceAgents, VoiceAgent } from '@/lib/api/voice-agents';
import { getTestCases, TestCase } from '@/lib/api/test-cases';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

export default function NewTestRunPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [agents, setAgents] = useState<VoiceAgent[]>([]);
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(true);
    const [isLoadingTestCases, setIsLoadingTestCases] = useState(true);
    const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);
    const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const form = useForm({
        defaultValues: {
            agent_id: '',
            time_limit: 60,
            customer_number: '',
            assistant_id: '',
            phone_number_id: '',
            outbound_call_params: ''
        },
    });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAgents();
            fetchTestCases();
        }
    }, [isAuthenticated]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsAgentDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchAgents = async () => {
        setIsLoadingAgents(true);
        try {
            const data = await getVoiceAgents();
            setAgents(data);
        } catch (error) {
            console.error('Failed to fetch voice agents:', error);
            toast.error('Failed to fetch voice agents');
        } finally {
            setIsLoadingAgents(false);
        }
    };

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

    const toggleTestCase = (testCaseId: string) => {
        setSelectedTestCases(prev =>
            prev.includes(testCaseId)
                ? prev.filter(id => id !== testCaseId)
                : [...prev, testCaseId]
        );
    };

    const handleAgentChange = (agentId: string) => {
        form.setValue('agent_id', agentId);
        const agent = agents.find(a => a.id === agentId) || null;
        setSelectedAgent(agent);
    };

    const onSubmit = async (values: any) => {
        if (selectedTestCases.length === 0) {
            toast.error('Please select at least one test case');
            return;
        }

        setIsSubmitting(true);
        try {
            // Format the data according to the API requirements
            const testRunData: any = {
                agent_id: values.agent_id,
                test_case_ids: selectedTestCases,
                time_limit: values.time_limit,
            };

            // Add outbound call parameters if this is an outbound agent
            if (selectedAgent && selectedAgent.direction === 'OUTBOUND') {
                // If using the JSON textarea
                if (values.outbound_call_params) {
                    try {
                        testRunData.outbound_call_params = JSON.parse(values.outbound_call_params);
                    } catch (e) {
                        toast.error('Invalid JSON in outbound call parameters');
                        setIsSubmitting(false);
                        return;
                    }
                } else {
                    // If using the individual fields
                    testRunData.outbound_call_params = {
                        assistantId: values.assistant_id,
                        phoneNumberId: values.phone_number_id,
                        customer: {
                            number: values.customer_number
                        }
                    };
                }
            }

            await createTestRun(testRunData);
            toast.success('Test run created successfully');
            router.push('/test-runs');
        } catch (error) {
            console.error('Failed to create test run:', error);
            toast.error('Failed to create test run');
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
                    <h1 className="text-3xl font-bold">Create Test Run</h1>
                    <Button variant="outline" asChild>
                        <Link href="/test-runs">Cancel</Link>
                    </Button>
                </div>

                <div className="rounded-lg border p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="agent_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Voice Agent</FormLabel>
                                        <FormControl>
                                            <div className="relative" ref={dropdownRef}>
                                                <button
                                                    type="button"
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                                                >
                                                    <span>
                                                        {field.value
                                                            ? agents.find(a => a.id === field.value)?.agent_id +
                                                            ` (${agents.find(a => a.id === field.value)?.agent_type}, ${agents.find(a => a.id === field.value)?.direction})`
                                                            : "Select a voice agent"}
                                                    </span>
                                                    <svg
                                                        className="h-4 w-4 opacity-50"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </button>

                                                {isAgentDropdownOpen && (
                                                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background py-1 shadow-md">
                                                        <div
                                                            className="px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                            onClick={() => {
                                                                handleAgentChange("");
                                                                setIsAgentDropdownOpen(false);
                                                            }}
                                                        >
                                                            Select a voice agent
                                                        </div>

                                                        {isLoadingAgents ? (
                                                            <div className="px-2 py-1.5 text-sm">Loading agents...</div>
                                                        ) : agents.length === 0 ? (
                                                            <div className="px-2 py-1.5 text-sm">No agents available</div>
                                                        ) : (
                                                            agents.map((agent) => (
                                                                <div
                                                                    key={agent.id}
                                                                    className={`px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer ${field.value === agent.id ? 'bg-accent text-accent-foreground' : ''
                                                                        }`}
                                                                    onClick={() => {
                                                                        handleAgentChange(agent.id);
                                                                        setIsAgentDropdownOpen(false);
                                                                    }}
                                                                >
                                                                    {agent.agent_id} ({agent.agent_type}, {agent.direction})
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="time_limit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Time Limit (seconds)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="10"
                                                max="300"
                                                placeholder="Enter time limit in seconds"
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {selectedAgent && selectedAgent.direction === 'OUTBOUND' && (
                                <div className="space-y-4 border p-4 rounded-md">
                                    <h3 className="text-lg font-medium">Outbound Call Parameters</h3>
                                    <p className="text-sm text-gray-500">
                                        These parameters are required for outbound calls. You can either fill in the individual fields or provide a JSON object.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="customer_number"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Customer Phone Number</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter customer phone number"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="assistant_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Assistant ID</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter assistant ID"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="phone_number_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Phone Number ID</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter phone number ID"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="border-t pt-4 mt-4">
                                        <FormField
                                            control={form.control}
                                            name="outbound_call_params"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Advanced: JSON Parameters (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder='{"assistantId": "your-assistant-id", "phoneNumberId": "your-phone-number-id", "customer": {"number": "+1234567890"}}'
                                                            className="font-mono"
                                                            rows={5}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        If provided, this JSON will override the individual fields above.
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Select Test Cases</h3>

                                {isLoadingTestCases ? (
                                    <p>Loading test cases...</p>
                                ) : testCases.length === 0 ? (
                                    <div className="text-center py-4">
                                        <p className="text-gray-500">No test cases available</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            asChild
                                        >
                                            <Link href="/test-cases/new">Create Test Case</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {testCases.map((testCase) => (
                                            <div
                                                key={testCase.id}
                                                className={`flex items-center p-3 rounded-md border ${selectedTestCases.includes(testCase.id)
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                onClick={() => toggleTestCase(testCase.id)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTestCases.includes(testCase.id)}
                                                    onChange={() => toggleTestCase(testCase.id)}
                                                    className="mr-3 h-4 w-4"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium">{testCase.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        Persona: {testCase.user_persona.name}, Scenario: {testCase.scenario.name}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" disabled={isSubmitting || selectedTestCases.length === 0}>
                                {isSubmitting ? 'Creating...' : 'Create Test Run'}
                            </Button>
                        </form>
                    </Form>
                </div>
            </div>
        </DashboardLayout>
    );
} 