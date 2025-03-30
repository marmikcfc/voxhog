"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { fetchCallsData, CallData } from '@/lib/api/calls';
import { LatencyChart } from '@/components/charts/latency-chart';
import { PeriodDropdown } from '@/components/ui/period-dropdown';
import { TimeRangeDropdown } from '@/components/ui/time-range-dropdown';
import { AgentFilterDropdown } from '@/components/ui/agent-filter-dropdown';
import { fetchLatencyData, getPeriodKey } from '@/lib/api/latency-data';
import React from 'react';

// Define types for our transcript data
interface TranscriptLine {
    time: string;
    speaker: 'agent' | 'caller';
    text: string;
    metadata?: {
        type: string;
        description: string;
    };
}

interface TranscriptData {
    id: string;
    lines: TranscriptLine[];
}

export default function EvaluationsPage() {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [timeRange, setTimeRange] = useState('7 days');
    const [agentFilter, setAgentFilter] = useState('all agents');
    const [activeTab, setActiveTab] = useState('evaluations');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [bookingChecked, setBookingChecked] = useState(false);
    const [questionsChecked, setQuestionsChecked] = useState(false);
    const [selectedTranscript, setSelectedTranscript] = useState<TranscriptData | null>(null);
    const [showTranscript, setShowTranscript] = useState(false);
    const [callsData, setCallsData] = useState<CallData[]>([]);
    const [isTableLoading, setIsTableLoading] = useState(true);
    const [periodValue, setPeriodValue] = useState('1 hour');
    const [latencyData, setLatencyData] = useState({
        average: {
            '50%': '1085ms',
            '90%': '1996ms',
            '95%': '2032ms'
        }
    });
    const [overallStats, setOverallStats] = useState({
        p50: '1085ms',
        p90: '1996ms',
        p95: '2032ms'
    });

    // Sample transcript data
    const transcriptData: Record<string, TranscriptData> = {
        'c3c60707-7a07-4380-a845-a246152d81df': {
            id: 'c3c60707-7a07-4380-a845-a246152d81df',
            lines: [
                { time: '00:00', speaker: 'agent', text: 'Hello. This is Mary from Mary\'s Dental. How can I assist you today?' },
                { time: '00:06', speaker: 'caller', text: 'Hi, Mary. I\'d like to, like, book an appointment for a dental checkup. Can you help me with that?' },
                // ... more lines would be here
            ]
        }
    };

    // The cURL command to display in the modal
    const curlCommand = `curl --request POST \\
  --url https://localhost:3000/v1/upload-call \\
  --header 'Authorization: Bearer <token>' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "callId": "<string>",
  "agentId": "<string>",
  "stereoRecordingUrl": "<string>",
  "saveRecording": true,
  "language": "en",
  "metadata": {
    "regionId": "USA",
    "ttsModel": "eleven-labs-v2"
  },
  "webhookUrl": "<string>"
}'`;

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    // Add this useEffect hook for DOM manipulation right after all the state declarations and before any conditional returns
    useEffect(() => {
        // This will run only on client-side after the component is mounted
        if (typeof window !== 'undefined') {
            const updateToggleVisuals = () => {
                // Update booking toggle visuals
                const bookingTrack = document.getElementById('booking-track');
                const bookingThumb = document.getElementById('booking-thumb');

                if (bookingTrack && bookingThumb) {
                    if (bookingChecked) {
                        bookingTrack.classList.add('bg-blue-600');
                        bookingTrack.classList.remove('bg-gray-200');
                        bookingThumb.classList.add('translate-x-4');
                    } else {
                        bookingTrack.classList.remove('bg-blue-600');
                        bookingTrack.classList.add('bg-gray-200');
                        bookingThumb.classList.remove('translate-x-4');
                    }
                }

                // Update questions toggle visuals
                const questionsTrack = document.getElementById('questions-track');
                const questionsThumb = document.getElementById('questions-thumb');

                if (questionsTrack && questionsThumb) {
                    if (questionsChecked) {
                        questionsTrack.classList.add('bg-blue-600');
                        questionsTrack.classList.remove('bg-gray-200');
                        questionsThumb.classList.add('translate-x-4');
                    } else {
                        questionsTrack.classList.remove('bg-blue-600');
                        questionsTrack.classList.add('bg-gray-200');
                        questionsThumb.classList.remove('translate-x-4');
                    }
                }
            };

            // Run once after component mounts
            updateToggleVisuals();
        }
    }, [bookingChecked, questionsChecked]); // Dependencies for the useEffect

    // Add this useEffect hook to fetch the calls data from external JSON
    useEffect(() => {
        const loadCallsData = async () => {
            try {
                setIsTableLoading(true);
                const data = await fetchCallsData(timeRange, agentFilter);
                setCallsData(data);
                setIsTableLoading(false);
            } catch (error) {
                console.error('Error fetching calls data:', error);
                setIsTableLoading(false);
            }
        };

        if (!isLoading && isAuthenticated) {
            loadCallsData();
        }
    }, [isLoading, isAuthenticated, timeRange, agentFilter]); // Re-fetch when these filters change

    // Function to handle view details button click
    const handleViewDetails = (callId: string) => {
        if (transcriptData[callId]) {
            setSelectedTranscript(transcriptData[callId]);
            setShowTranscript(true);
        } else {
            console.error(`No transcript data found for call ID: ${callId}`);
        }
    };

    // Add a refresh function
    const handleRefresh = async () => {
        try {
            setIsTableLoading(true);
            const data = await fetchCallsData(timeRange, agentFilter);
            setCallsData(data);
            setIsTableLoading(false);
        } catch (error) {
            console.error('Error refreshing calls data:', error);
            setIsTableLoading(false);
        }
    };

    // Function to load latency data based on period
    const loadLatencyData = React.useCallback(async (selectedPeriod: string) => {
        try {
            const data = await fetchLatencyData();
            const periodKey = getPeriodKey(selectedPeriod);
            const periodData = data.periodData[periodKey as keyof typeof data.periodData];

            if (periodData) {
                setLatencyData({
                    average: {
                        '50%': periodData.average.p50,
                        '90%': periodData.average.p90,
                        '95%': periodData.average.p95
                    }
                });
            }
        } catch (error) {
            console.error("Failed to load period latency data:", error);
        }
    }, []);

    // Update latency data when period changes
    useEffect(() => {
        loadLatencyData(periodValue);
    }, [periodValue, loadLatencyData]);

    // Load overall stats (last 2 days)
    useEffect(() => {
        const loadOverallStats = async () => {
            try {
                const data = await fetchLatencyData();
                if (data.overallStats?.last2days) {
                    setOverallStats({
                        p50: data.overallStats.last2days.p50,
                        p90: data.overallStats.last2days.p90,
                        p95: data.overallStats.last2days.p95
                    });
                }
            } catch (error) {
                console.error("Failed to load overall latency stats:", error);
            }
        };

        loadOverallStats();
    }, []);

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
                    <h1 className="text-3xl font-bold">Evaluations</h1>
                    <div className="flex items-center gap-4">
                        <TimeRangeDropdown
                            value={timeRange}
                            onValueChange={setTimeRange}
                        />
                        <AgentFilterDropdown
                            value={agentFilter}
                            onValueChange={setAgentFilter}
                        />
                    </div>
                </div>

                {/* Demo Data Warning Banner */}
                <div className="w-full rounded-md bg-amber-50 border border-amber-200 p-3">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span className="text-amber-800 font-medium">Demo data for understanding</span>
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
                            <div className="text-green-500 text-sm">{overallStats.p50}</div>
                            <div className="text-green-500 text-sm">{overallStats.p90}</div>
                            <div className="text-green-500 text-sm">{overallStats.p95}</div>
                        </div>

                        {/* Latency Chart (Placeholder) */}
                        <div className="rounded-md overflow-hidden">
                            <LatencyChart period={periodValue} />
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm font-medium">period</div>
                            <PeriodDropdown
                                value={periodValue}
                                onValueChange={setPeriodValue}
                            />
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
                                        <button
                                            onClick={() => {
                                                setBookingChecked(!bookingChecked);
                                                console.log('Booking toggled:', !bookingChecked);
                                            }}
                                            className="relative inline-flex items-center cursor-pointer"
                                            aria-checked={bookingChecked}
                                            role="switch"
                                            type="button"
                                        >
                                            <div className="h-5 w-9 rounded-full bg-gray-200" id="booking-track"></div>
                                            <div id="booking-thumb" className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all"></div>
                                        </button>
                                        <span className="text-sm font-medium">correctly booked appointment</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border rounded-md p-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setQuestionsChecked(!questionsChecked);
                                                console.log('Questions toggled:', !questionsChecked);
                                            }}
                                            className="relative inline-flex items-center cursor-pointer"
                                            aria-checked={questionsChecked}
                                            role="switch"
                                            type="button"
                                        >
                                            <div className="h-5 w-9 rounded-full bg-gray-200" id="questions-track"></div>
                                            <div id="questions-thumb" className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-all"></div>
                                        </button>
                                        <span className="text-sm font-medium">correctly answered questions</span>
                                    </div>
                                </div>

                                <Link href="/test-cases/metrics">
                                    <Button variant="outline" className="w-full flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                            <path d="M12 5v14M5 12h14" />
                                        </svg>
                                        add evaluation
                                    </Button>
                                </Link>
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
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="link" className="text-sm text-gray-500">how do i upload a call?</Button>
                            </SheetTrigger>
                            <SheetContent>
                                <SheetHeader>
                                    <SheetTitle>How to Upload a Call</SheetTitle>
                                </SheetHeader>
                                <div className="mt-6">
                                    <p className="mb-4">Use the following cURL command to upload a call:</p>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4 overflow-x-auto">
                                        <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{curlCommand}</pre>
                                    </div>
                                    <Button
                                        onClick={() => {
                                            navigator.clipboard.writeText(curlCommand);
                                        }}
                                        className="mt-4"
                                        variant="outline"
                                        size="sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                        </svg>
                                        Copy to Clipboard
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                    <div className="overflow-x-auto">
                        {isTableLoading ? (
                            <div className="flex justify-center items-center p-8">
                                <div className="flex flex-col items-center">
                                    <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="mt-2 text-sm text-gray-500">Loading data...</span>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-left text-xs">
                                        <th className="px-4 py-3 font-medium">id</th>
                                        <th className="px-4 py-3 font-medium">TTFW</th>
                                        <th className="px-4 py-3 font-medium">50%</th>
                                        <th className="px-4 py-3 font-medium">90%</th>
                                        <th className="px-4 py-3 font-medium">95%</th>
                                        <th className="px-4 py-3 font-medium">agent rushing incident</th>
                                        <th className="px-4 py-3 font-medium">eval results</th>
                                        <th className="px-4 py-3 font-medium">LLM</th>
                                        <th className="px-4 py-3 font-medium">Voice Provider</th>
                                        <th className="px-4 py-3 font-medium">created at</th>
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
                                            <td className="px-4 py-3 text-sm">{call.agentRushingIncident}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-500">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                    {call.evalResults}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{call.llm}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <span>{call.voiceProvider}</span>
                                                    <span className="text-xs text-gray-500">({call.voiceName})</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">{call.createdAt}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(call.id)}
                                                >
                                                    view details
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Transcript Detail Modal */}
                {showTranscript && selectedTranscript && (
                    <Sheet open={showTranscript} onOpenChange={setShowTranscript}>
                        <SheetContent className="w-[90%] sm:w-[80%] md:w-[800px] overflow-y-auto">
                            <SheetHeader>
                                <SheetTitle>Call Transcript</SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 space-y-1">
                                {selectedTranscript.lines.map((line, index) => (
                                    <div key={index} className={`py-2 ${line.metadata ? 'border-l-4 border-green-500 pl-4 bg-green-50' : ''}`}>
                                        <div className="flex">
                                            <span className="w-12 text-gray-500 text-sm">{line.time}</span>
                                            <div className="flex-1">
                                                {line.speaker && (
                                                    <span className={`text-sm font-medium ${line.speaker === 'agent' ? 'text-blue-600' : 'text-gray-700'}`}>
                                                        {line.speaker}
                                                    </span>
                                                )}
                                                {line.text && (
                                                    <p className="text-gray-800 mt-1">{line.text}</p>
                                                )}
                                                {line.metadata?.type === 'time to agent response' && (
                                                    <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md inline-block mt-1 text-sm">
                                                        {line.metadata.description} - time to agent response
                                                    </div>
                                                )}
                                                {line.metadata && line.metadata.type !== 'time to agent response' && (
                                                    <div className="mt-2 bg-green-100 p-2 rounded-md">
                                                        <div className="flex items-center gap-2 text-green-600">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                                <polyline points="22 4 12 14.01 9 11.01" />
                                                            </svg>
                                                            <span className="font-medium">{line.metadata.type}</span>
                                                        </div>
                                                        <p className="text-sm text-green-700 mt-1">{line.metadata.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                )}
            </div>
        </DashboardLayout>
    );
} 