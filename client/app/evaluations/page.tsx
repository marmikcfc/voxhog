"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function EvaluationsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [timeRange, setTimeRange] = useState('2 days');
    const [agentFilter, setAgentFilter] = useState('all agents');
    const [activeTab, setActiveTab] = useState('evaluations');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

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

    // Sample data for the latency chart
    const latencyData = {
        average: {
            '50%': '1284ms',
            '90%': '2039ms',
            '95%': '2519ms'
        }
    };

    // Sample data for the calls table
    const callsData = [
        {
            id: 'c3c60707-7a07-4380-a845-a246152d81df',
            ttfw: '825ms',
            p50: '535ms',
            p90: '1415ms',
            p95: '1415ms',
            interruptions: 0,
            evalResults: '1/1',
            createdAt: 'about 4 hours ago'
        },
        {
            id: 'd7a2381f-32dc-43a9-8b67-7138c272c65d',
            ttfw: '625ms',
            p50: '680ms',
            p90: '2395ms',
            p95: '2395ms',
            interruptions: 0,
            evalResults: '1/1',
            createdAt: 'about 4 hours ago'
        },
        {
            id: 'be48dda2-0b9b-4daf-8b14-9fc37e45fba8',
            ttfw: '700ms',
            p50: '700ms',
            p90: '700ms',
            p95: '700ms',
            interruptions: 0,
            evalResults: '1/1',
            createdAt: 'about 4 hours ago'
        }
    ];

    return (
        <DashboardLayout
            username={user?.username || 'User'}
            onLogout={logout}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Evaluations</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 border rounded-md p-2">
                            <span className="text-sm font-medium">{timeRange}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </div>
                        <div className="flex items-center gap-2 border rounded-md p-2">
                            <span className="text-sm font-medium">{agentFilter}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </div>
                        <Button variant="outline" size="sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            add filter
                        </Button>
                        <Button variant="outline" size="sm">
                            refresh
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Latency Card */}
                    <div className="rounded-lg border p-6">
                        <h2 className="text-xl font-bold mb-4">latency</h2>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="text-sm text-gray-500">average</div>
                            <div className="text-sm">
                                <div className="font-medium">50%</div>
                                <div className="text-green-500">{latencyData.average['50%']}</div>
                            </div>
                            <div className="text-sm">
                                <div className="font-medium">90%</div>
                                <div className="text-green-500">{latencyData.average['90%']}</div>
                            </div>
                            <div className="text-sm">
                                <div className="font-medium">95%</div>
                                <div className="text-green-500">{latencyData.average['95%']}</div>
                            </div>
                            <div className="text-sm text-gray-500">last 2 days</div>
                            <div className="text-green-500 text-sm">{latencyData.average['50%']}</div>
                            <div className="text-green-500 text-sm">{latencyData.average['90%']}</div>
                            <div className="text-green-500 text-sm">{latencyData.average['95%']}</div>
                        </div>

                        {/* Latency Chart (Placeholder) */}
                        <div className="h-48 bg-blue-50 rounded-md relative overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center opacity-50">
                                <div className="w-full h-full">
                                    {/* Simplified chart representation */}
                                    <svg viewBox="0 0 400 150" className="w-full h-full">
                                        <path d="M0,100 C50,80 100,120 150,90 C200,60 250,110 300,70 C350,30 400,50 400,100" fill="none" stroke="#3b82f6" strokeWidth="2" />
                                        <path d="M0,120 C50,100 100,140 150,110 C200,80 250,130 300,90 C350,50 400,70 400,120" fill="none" stroke="#93c5fd" strokeWidth="2" />
                                        <path d="M0,130 C50,110 100,150 150,120 C200,90 250,140 300,100 C350,60 400,80 400,130" fill="none" stroke="#dbeafe" strokeWidth="2" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm font-medium">period</div>
                            <div className="border rounded-md px-3 py-1 text-sm">1 hour</div>
                        </div>
                    </div>

                    {/* Evaluations Card */}
                    <div className="rounded-lg border p-6">
                        <div className="flex border-b mb-4">
                            <button
                                className={`px-4 py-2 text-sm font-medium ${activeTab === 'evaluations' ? 'border-b-2 border-primary' : ''}`}
                                onClick={() => setActiveTab('evaluations')}
                            >
                                evaluations
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium ${activeTab === 'alerts' ? 'border-b-2 border-primary' : ''}`}
                                onClick={() => setActiveTab('alerts')}
                            >
                                alerts
                            </button>
                        </div>

                        {activeTab === 'evaluations' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border rounded-md p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative inline-flex items-center">
                                            <input type="checkbox" id="booking" className="sr-only peer" />
                                            <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700"></div>
                                            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-4.5"></span>
                                        </div>
                                        <Label htmlFor="booking" className="text-sm font-medium">correctly booked appointment</Label>
                                    </div>
                                    <Button variant="outline" size="sm">edit</Button>
                                </div>

                                <div className="flex gap-2 ml-12">
                                    <Button variant="ghost" size="sm" className="text-xs">all</Button>
                                    <Button variant="ghost" size="sm" className="text-xs">passed</Button>
                                    <Button variant="ghost" size="sm" className="text-xs">failed</Button>
                                </div>

                                <div className="flex items-center justify-between border rounded-md p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative inline-flex items-center">
                                            <input type="checkbox" id="questions" className="sr-only peer" />
                                            <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700"></div>
                                            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-4.5"></span>
                                        </div>
                                        <Label htmlFor="questions" className="text-sm font-medium">correctly answered questions</Label>
                                    </div>
                                    <Button variant="outline" size="sm">edit</Button>
                                </div>

                                <div className="flex gap-2 ml-12">
                                    <Button variant="ghost" size="sm" className="text-xs">all</Button>
                                    <Button variant="ghost" size="sm" className="text-xs">passed</Button>
                                    <Button variant="ghost" size="sm" className="text-xs">failed</Button>
                                </div>

                                <Button variant="outline" className="w-full flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                    add evaluation
                                </Button>
                            </div>
                        )}

                        {activeTab === 'alerts' && (
                            <div className="h-48 flex items-center justify-center text-gray-500">
                                No alerts configured
                            </div>
                        )}
                    </div>
                </div>

                {/* Calls Table */}
                <div className="rounded-lg border">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="relative max-w-xs">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                            </div>
                            <Input
                                className="pl-10"
                                placeholder="search for call ID"
                            />
                        </div>
                        <div className="text-sm text-gray-500">how do i upload a call?</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-xs">
                                    <th className="px-4 py-3 font-medium">id</th>
                                    <th className="px-4 py-3 font-medium">TTFW</th>
                                    <th className="px-4 py-3 font-medium">50%</th>
                                    <th className="px-4 py-3 font-medium">90%</th>
                                    <th className="px-4 py-3 font-medium">95%</th>
                                    <th className="px-4 py-3 font-medium">interruptions</th>
                                    <th className="px-4 py-3 font-medium">eval results</th>
                                    <th className="px-4 py-3 font-medium">created at</th>
                                    <th className="px-4 py-3 font-medium">notes</th>
                                    <th className="px-4 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {callsData.map((call) => (
                                    <tr key={call.id} className="border-b">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate max-w-[120px]">{call.id}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                    </svg>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                    </svg>
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{call.ttfw}</td>
                                        <td className="px-4 py-3 text-sm">{call.p50}</td>
                                        <td className="px-4 py-3 text-sm">{call.p90}</td>
                                        <td className="px-4 py-3 text-sm">{call.p95}</td>
                                        <td className="px-4 py-3 text-sm">{call.interruptions}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-500">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                    <polyline points="22 4 12 14.01 9 11.01" />
                                                </svg>
                                                {call.evalResults}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{call.createdAt}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                </svg>
                                            </Button>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <Button variant="outline" size="sm">view details</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 