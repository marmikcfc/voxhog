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
import { createVoiceAgent } from '@/lib/api/voice-agents';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

export default function NewVoiceAgentPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm({
        defaultValues: {
            agent_id: '',
            agent_type: 'phone',
            direction: 'INBOUND',
            phone_number: '',
            endpoint: '',
        },
    });

    // Watch the agent_type field to conditionally show/hide fields
    const agentType = form.watch('agent_type');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    const onSubmit = async (values: any) => {
        setIsSubmitting(true);
        try {
            // Format the data according to the API requirements
            const connectionDetails: Record<string, any> = {};

            if (values.phone_number) {
                connectionDetails.phone_number = values.phone_number;
            }

            // Only include endpoint if agent type is webrtc
            if (values.agent_type === 'webrtc' && values.endpoint) {
                connectionDetails.endpoint = values.endpoint;
            }

            const agentData = {
                agent_id: values.agent_id,
                agent_type: values.agent_type,
                direction: values.direction,
                connection_details: connectionDetails,
            };

            await createVoiceAgent(agentData);
            toast.success('Voice agent created successfully');
            router.push('/agents');
        } catch (error) {
            console.error('Failed to create voice agent:', error);
            toast.error('Failed to create voice agent');
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
                    <h1 className="text-3xl font-bold">Create Voice Agent</h1>
                    <Button variant="outline" asChild>
                        <Link href="/agents">Cancel</Link>
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
                                        <FormLabel>Agent ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter agent ID" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="agent_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Agent Type</FormLabel>
                                        <FormControl>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                {...field}
                                            >
                                                <option value="phone">Phone</option>
                                                <option value="webrtc" disabled>WebRTC (Coming Soon)</option>
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="direction"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Direction</FormLabel>
                                        <FormControl>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                {...field}
                                            >
                                                <option value="INBOUND">Inbound</option>
                                                <option value="OUTBOUND">Outbound</option>
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phone_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter phone number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {agentType === 'webrtc' && (
                                <FormField
                                    control={form.control}
                                    name="endpoint"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Endpoint</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter endpoint URL" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Voice Agent'}
                            </Button>
                        </form>
                    </Form>
                </div>
            </div>
        </DashboardLayout>
    );
} 