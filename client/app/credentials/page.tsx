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
import { ApiKey, CreateApiKeyData, getApiKeys, createApiKey, deleteApiKey, getConfig } from '@/lib/api/credentials';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

export default function CredentialsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isLoadingKeys, setIsLoadingKeys] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('twilio');

    const form = useForm({
        defaultValues: {
            service: '',
            key: '',
            description: '',
        },
    });

    const twilioForm = useForm({
        defaultValues: {
            account_sid: '',
            auth_token: '',
            phone_number: '',
        },
    });

    const cartesiaForm = useForm({
        defaultValues: {
            api_key: '',
        },
    });

    const deepgramForm = useForm({
        defaultValues: {
            api_key: '',
        },
    });

    const openaiForm = useForm({
        defaultValues: {
            api_key: '',
        },
    });

    const agentProviderForm = useForm({
        defaultValues: {
            api_url: '',
            auth_token: '',
        },
    });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchApiKeys();
            fetchConfig();
        }
    }, [isAuthenticated]);

    const fetchApiKeys = async () => {
        setIsLoadingKeys(true);
        try {
            const data = await getApiKeys();
            setApiKeys(data);
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
            toast.error('Failed to fetch API keys');
        } finally {
            setIsLoadingKeys(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const data = await getConfig();
            setConfig(data);
        } catch (error) {
            console.error('Failed to fetch configuration:', error);
            toast.error('Failed to fetch configuration');
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this API key?')) {
            try {
                await deleteApiKey(id);
                toast.success('API key deleted successfully');
                fetchApiKeys();
                fetchConfig();
            } catch (error) {
                console.error('Failed to delete API key:', error);
                toast.error('Failed to delete API key');
            }
        }
    };

    const onSubmitTwilio = async (values: any) => {
        setIsSubmitting(true);
        try {
            // Create SID:TOKEN key
            if (values.account_sid && values.auth_token) {
                await createApiKey({
                    service: 'TWILIO_SID_TOKEN',
                    key: `${values.account_sid}:${values.auth_token}`,
                    description: 'Twilio Account SID and Auth Token'
                });
            }

            // Create phone number key
            if (values.phone_number) {
                await createApiKey({
                    service: 'TWILIO_PHONE_NUMBER',
                    key: values.phone_number,
                    description: 'Twilio Phone Number'
                });
            }

            toast.success('Twilio credentials saved successfully');
            twilioForm.reset();
            fetchApiKeys();
            fetchConfig();
        } catch (error) {
            console.error('Failed to save Twilio credentials:', error);
            toast.error('Failed to save Twilio credentials');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitCartesia = async (values: any) => {
        setIsSubmitting(true);
        try {
            await createApiKey({
                service: 'CARTESIA',
                key: values.api_key,
                description: 'Cartesia API Key'
            });

            toast.success('Cartesia API key saved successfully');
            cartesiaForm.reset();
            fetchApiKeys();
            fetchConfig();
        } catch (error) {
            console.error('Failed to save Cartesia API key:', error);
            toast.error('Failed to save Cartesia API key');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitDeepgram = async (values: any) => {
        setIsSubmitting(true);
        try {
            await createApiKey({
                service: 'DEEPGRAM',
                key: values.api_key,
                description: 'Deepgram API Key'
            });

            toast.success('Deepgram API key saved successfully');
            deepgramForm.reset();
            fetchApiKeys();
            fetchConfig();
        } catch (error) {
            console.error('Failed to save Deepgram API key:', error);
            toast.error('Failed to save Deepgram API key');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitOpenAI = async (values: any) => {
        setIsSubmitting(true);
        try {
            await createApiKey({
                service: 'OPENAI',
                key: values.api_key,
                description: 'OpenAI API Key'
            });

            toast.success('OpenAI API key saved successfully');
            openaiForm.reset();
            fetchApiKeys();
            fetchConfig();
        } catch (error) {
            console.error('Failed to save OpenAI API key:', error);
            toast.error('Failed to save OpenAI API key');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitAgentProvider = async (values: any) => {
        setIsSubmitting(true);
        try {
            // Create API URL
            if (values.api_url) {
                await createApiKey({
                    service: 'VOICE_AGENT_API',
                    key: values.api_url,
                    description: 'Voice Agent Provider API URL'
                });
            }

            // Create Auth Token
            if (values.auth_token) {
                await createApiKey({
                    service: 'VOICE_AGENT_API_AUTH_TOKEN',
                    key: values.auth_token,
                    description: 'Voice Agent Provider API Auth Token'
                });
            }

            toast.success('Agent Provider credentials saved successfully');
            agentProviderForm.reset();
            fetchApiKeys();
            fetchConfig();
        } catch (error) {
            console.error('Failed to save Agent Provider credentials:', error);
            toast.error('Failed to save Agent Provider credentials');
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
                    <h1 className="text-3xl font-bold">API Credentials</h1>
                </div>

                <div className="flex border-b">
                    <button
                        className={`px-4 py-2 ${activeTab === 'twilio' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('twilio')}
                    >
                        Twilio
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'cartesia' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('cartesia')}
                    >
                        Cartesia
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'deepgram' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('deepgram')}
                    >
                        Deepgram
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'openai' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('openai')}
                    >
                        OpenAI
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'agent-provider' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('agent-provider')}
                    >
                        Agent Provider
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'all' ? 'border-b-2 border-primary font-medium text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Keys
                    </button>
                </div>

                <div className="rounded-lg border p-6">
                    {activeTab === 'twilio' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Twilio Credentials</h2>
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.twilio_sid_token ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Twilio Account SID & Auth Token: {config?.api_keys_configured?.twilio_sid_token ? 'Configured' : 'Not Configured'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.twilio_phone_number ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Twilio Phone Number: {config?.api_keys_configured?.twilio_phone_number ? 'Configured' : 'Not Configured'}</span>
                                </div>
                            </div>
                            <Form {...twilioForm}>
                                <form onSubmit={twilioForm.handleSubmit(onSubmitTwilio)} className="space-y-4">
                                    <FormField
                                        control={twilioForm.control}
                                        name="account_sid"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Twilio Account SID</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter Twilio Account SID" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={twilioForm.control}
                                        name="auth_token"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Twilio Auth Token</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Enter Twilio Auth Token" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={twilioForm.control}
                                        name="phone_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Twilio Phone Number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter Twilio Phone Number (e.g., +1234567890)" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Twilio Credentials'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    )}

                    {activeTab === 'cartesia' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Cartesia API Key</h2>
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.cartesia ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Cartesia API Key: {config?.api_keys_configured?.cartesia ? 'Configured' : 'Not Configured'}</span>
                                </div>
                            </div>
                            <Form {...cartesiaForm}>
                                <form onSubmit={cartesiaForm.handleSubmit(onSubmitCartesia)} className="space-y-4">
                                    <FormField
                                        control={cartesiaForm.control}
                                        name="api_key"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cartesia API Key</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Enter Cartesia API Key" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Cartesia API Key'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    )}

                    {activeTab === 'deepgram' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Deepgram API Key</h2>
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.deepgram ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Deepgram API Key: {config?.api_keys_configured?.deepgram ? 'Configured' : 'Not Configured'}</span>
                                </div>
                            </div>
                            <Form {...deepgramForm}>
                                <form onSubmit={deepgramForm.handleSubmit(onSubmitDeepgram)} className="space-y-4">
                                    <FormField
                                        control={deepgramForm.control}
                                        name="api_key"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Deepgram API Key</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Enter Deepgram API Key" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Deepgram API Key'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    )}

                    {activeTab === 'openai' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">OpenAI API Key</h2>
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.openai ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">OpenAI API Key: {config?.api_keys_configured?.openai ? 'Configured' : 'Not Configured'}</span>
                                </div>
                            </div>
                            <Form {...openaiForm}>
                                <form onSubmit={openaiForm.handleSubmit(onSubmitOpenAI)} className="space-y-4">
                                    <FormField
                                        control={openaiForm.control}
                                        name="api_key"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>OpenAI API Key</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Enter OpenAI API Key" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save OpenAI API Key'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    )}

                    {activeTab === 'agent-provider' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Agent Provider API Credentials</h2>
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.voice_agent_api ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Agent Provider API URL: {config?.api_keys_configured?.voice_agent_api ? 'Configured' : 'Not Configured'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${config?.api_keys_configured?.voice_agent_api_auth_token ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-sm">Agent Provider API Auth Token: {config?.api_keys_configured?.voice_agent_api_auth_token ? 'Configured' : 'Not Configured'}</span>
                                </div>
                            </div>
                            <Form {...agentProviderForm}>
                                <form onSubmit={agentProviderForm.handleSubmit(onSubmitAgentProvider)} className="space-y-4">
                                    <FormField
                                        control={agentProviderForm.control}
                                        name="api_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Agent Provider API URL</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter Agent Provider API URL" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={agentProviderForm.control}
                                        name="auth_token"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Agent Provider API Auth Token</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Enter Agent Provider API Auth Token" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Agent Provider Credentials'}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    )}

                    {activeTab === 'all' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">All API Keys</h2>
                            {isLoadingKeys ? (
                                <div className="flex h-40 items-center justify-center">
                                    <p>Loading API keys...</p>
                                </div>
                            ) : apiKeys.length === 0 ? (
                                <div className="flex h-40 items-center justify-center">
                                    <p className="text-gray-500">No API keys found. Add keys using the tabs above.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {apiKeys.map((key) => (
                                        <div
                                            key={key.id}
                                            className="rounded-lg border p-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">{key.service}</h3>
                                                    <p className="mt-1 text-sm text-gray-500">{key.description || 'No description'}</p>
                                                    <p className="mt-1 text-xs text-gray-400">Created: {new Date(key.created_at).toLocaleString()}</p>
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeleteKey(key.id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
} 