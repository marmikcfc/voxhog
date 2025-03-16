"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { VoiceAgent, getVoiceAgents, deleteVoiceAgent } from '@/lib/api/voice-agents';
import Link from 'next/link';

export default function VoiceAgentsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [agents, setAgents] = useState<VoiceAgent[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAgents();
        }
    }, [isAuthenticated]);

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

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this voice agent?')) {
            try {
                await deleteVoiceAgent(id);
                toast.success('Voice agent deleted successfully');
                fetchAgents();
            } catch (error) {
                console.error('Failed to delete voice agent:', error);
                toast.error('Failed to delete voice agent');
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
                    <h1 className="text-3xl font-bold">Voice Agents</h1>
                    <Button asChild>
                        <Link href="/agents/new">Create New Agent</Link>
                    </Button>
                </div>

                {isLoadingAgents ? (
                    <div className="flex h-40 items-center justify-center">
                        <p>Loading voice agents...</p>
                    </div>
                ) : agents.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <h3 className="text-lg font-medium">No voice agents found</h3>
                        <p className="mt-2 text-gray-500">
                            Create your first voice agent to get started.
                        </p>
                        <Button className="mt-4" asChild>
                            <Link href="/agents/new">Create Voice Agent</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {agents.map((agent) => (
                            <div
                                key={agent.id}
                                className="rounded-lg border bg-card p-6 shadow-sm"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">{agent.agent_id}</h3>
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                        {agent.agent_type}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    Direction: {agent.direction}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Created: {new Date(agent.created_at).toLocaleDateString()}
                                </p>
                                {agent.persona && (
                                    <p className="mt-2 text-sm">
                                        <span className="font-medium">Persona:</span> {agent.persona}
                                    </p>
                                )}
                                <div className="mt-4 flex items-center gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/agents/${agent.id}`}>View Details</Link>
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(agent.id)}
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