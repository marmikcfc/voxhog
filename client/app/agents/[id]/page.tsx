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
    VoiceAgent,
    getVoiceAgent,
    updateVoiceAgent,
    updateVoiceAgentPersona
} from '@/lib/api/voice-agents';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

export default async function VoiceAgentDetailPage({ params }: { params: { id: string } }) {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [agent, setAgent] = useState<VoiceAgent | null>(null);
    const [isLoadingAgent, setIsLoadingAgent] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('details');

    const { id } = await params;

    // Store the ID in a state variable to avoid direct access to params.id
    const [agentId, setAgentId] = useState<string>('');

    // Set the ID once when the component mounts
    useEffect(() => {
        if (params && id) {
            setAgentId(id);
        }
    }, [params]);

    const detailsForm = useForm({
        defaultValues: {
            agent_id: '',
            agent_type: 'phone',
            direction: 'INBOUND',
            phone_number: '',
            endpoint: '',
        },
    });

    // Watch the agent_type field to conditionally show/hide fields
    const agentType = detailsForm.watch('agent_type');

    const personaForm = useForm({
        defaultValues: {
            persona: '',
            scenario: '',
        },
    });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && agentId) {
            fetchAgent();
        }
    }, [isAuthenticated, agentId]);

    const fetchAgent = async () => {
        setIsLoadingAgent(true);
        try {
            const data = await getVoiceAgent(agentId);
            setAgent(data);

            // Set form values for details
            detailsForm.reset({
                agent_id: data.agent_id,
                agent_type: data.agent_type,
                direction: data.direction,
                phone_number: data.connection_details.phone_number || '',
                endpoint: data.connection_details.endpoint || '',
            });

            // Set form values for persona
            personaForm.reset({
                persona: data.persona || '',
                scenario: data.scenario || '',
            });
        } catch (error) {
            console.error('Failed to fetch voice agent:', error);
            toast.error('Failed to fetch voice agent');
        } finally {
            setIsLoadingAgent(false);
        }
    };

    const onSubmitDetails = async (values: any) => {
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

            const updatedAgent = await updateVoiceAgent(agentId, agentData);
            setAgent(updatedAgent);
            toast.success('Voice agent updated successfully');
        } catch (error) {
            console.error('Failed to update voice agent:', error);
            toast.error('Failed to update voice agent');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitPersona = async (values: any) => {
        setIsSubmitting(true);
        try {
            // Ensure values are properly formatted
            const personaData = {
                persona: values.persona || '',
                scenario: values.scenario || ''
            };

            console.log('Submitting persona update with values:', personaData);
            const updatedAgent = await updateVoiceAgentPersona(agentId, personaData);
            console.log('Received updated agent:', updatedAgent);
            setAgent(updatedAgent);
            toast.success('Voice agent persona updated successfully');

            // Refresh the agent data to ensure we have the latest values
            fetchAgent();
        } catch (error) {
            console.error('Failed to update voice agent persona:', error);
            toast.error('Failed to update voice agent persona');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || isLoadingAgent) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-lg">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated || !agent) {
        return null; // Will redirect to home page or show error
    }

    return (
        <DashboardLayout
            username={user?.username || 'User'}
            onLogout={logout}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Voice Agent: {agent.agent_id}</h1>
                    <Button variant="outline" asChild>
                        <Link href="/agents">Back to Agents</Link>
                    </Button>
                </div>

                <div className="flex border-b">
                    <button
                        className={`px-4 py-2 ${activeTab === 'details'
                            ? 'border-b-2 border-primary font-medium text-primary'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('details')}
                    >
                        Details
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'persona'
                            ? 'border-b-2 border-primary font-medium text-primary'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('persona')}
                    >
                        Persona
                    </button>
                </div>

                <div className="rounded-lg border p-6">
                    {activeTab === 'details' ? (
                        <Form {...detailsForm}>
                            <form onSubmit={detailsForm.handleSubmit(onSubmitDetails)} className="space-y-6">
                                <FormField
                                    control={detailsForm.control}
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
                                    control={detailsForm.control}
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
                                    control={detailsForm.control}
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
                                    control={detailsForm.control}
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
                                        control={detailsForm.control}
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
                                    {isSubmitting ? 'Updating...' : 'Update Voice Agent'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <Form {...personaForm}>
                            <form onSubmit={personaForm.handleSubmit(onSubmitPersona)} className="space-y-6">
                                <FormField
                                    control={personaForm.control}
                                    name="persona"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Persona</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Enter agent persona"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={personaForm.control}
                                    name="scenario"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Scenario</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Enter agent scenario"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Updating...' : 'Update Persona'}
                                </Button>
                            </form>
                        </Form>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
} 