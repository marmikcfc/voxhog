"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TestRun, getTestRun, cancelTestRun, getTestRunReport } from '@/lib/api/test-runs';
import { getVoiceAgent } from '@/lib/api/voice-agents';
import { getTestCase } from '@/lib/api/test-cases';
import Link from 'next/link';
import { use } from 'react';

export default function TestRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { user, isLoading, logout, isAuthenticated } = useAuth();
    const router = useRouter();
    const [testRun, setTestRun] = useState<TestRun | null>(null);
    const [isLoadingTestRun, setIsLoadingTestRun] = useState(true);
    const [agentName, setAgentName] = useState<string>('');
    const [testCaseNames, setTestCaseNames] = useState<Record<string, string>>({});
    const [report, setReport] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [activeTab, setActiveTab] = useState('details');

    // Access the ID directly from params
    const testRunId = use(params).id;

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && testRunId) {
            fetchTestRun();

            // Poll for updates every 5 seconds if the test run is active
            const interval = setInterval(() => {
                if (testRun && (testRun.status === 'pending' || testRun.status === 'running')) {
                    fetchTestRun();
                }
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [isAuthenticated, testRunId, testRun?.status]);

    const fetchTestRun = async () => {
        setIsLoadingTestRun(true);
        try {
            const data = await getTestRun(testRunId);
            setTestRun(data);

            // Fetch agent name
            try {
                const agent = await getVoiceAgent(data.agent_id);
                setAgentName(agent.agent_id);
            } catch (error) {
                console.error('Failed to fetch agent details:', error);
            }

            // Fetch test case names
            const names: Record<string, string> = {};
            if (data.test_case_ids && Array.isArray(data.test_case_ids)) {
                for (const testCaseId of data.test_case_ids) {
                    if (testCaseId) {  // Check if testCaseId is defined and not null/empty
                        try {
                            const testCase = await getTestCase(testCaseId);
                            names[testCaseId] = testCase.name;
                        } catch (error) {
                            console.error(`Failed to fetch test case ${testCaseId}:`, error);
                            names[testCaseId] = 'Unknown Test Case';
                        }
                    } else {
                        console.warn('Encountered undefined or empty test case ID in test run');
                    }
                }
            } else {
                console.warn('No test case IDs found in test run or test_case_ids is not an array');
            }
            setTestCaseNames(names);

        } catch (error) {
            console.error('Failed to fetch test run:', error);
            toast.error('Failed to fetch test run');
        } finally {
            setIsLoadingTestRun(false);
        }
    };

    const fetchReport = async () => {
        if (!testRun || testRun.status !== 'completed') {
            toast.error('Report is only available for completed test runs');
            return;
        }

        setIsLoadingReport(true);
        try {
            const data = await getTestRunReport(testRunId);
            console.log('Report data:', data);
            setReport(data);
        } catch (error) {
            console.error('Failed to fetch report:', error);
            toast.error('Failed to fetch report');
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleCancel = async () => {
        if (!testRun) return;

        if (window.confirm('Are you sure you want to cancel this test run?')) {
            try {
                await cancelTestRun(testRun.id);
                toast.success('Test run cancelled successfully');
                fetchTestRun();
            } catch (error) {
                console.error('Failed to cancel test run:', error);
                toast.error('Failed to cancel test run');
            }
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400';
            case 'running':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
        }
    };

    if (isLoading || isLoadingTestRun) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-lg">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated || !testRun) {
        return null; // Will redirect to home page or show error
    }

    return (
        <DashboardLayout
            username={user?.username || 'User'}
            onLogout={logout}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Test Run Details</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(testRun.status)}`}>
                                {testRun.status}
                            </span>
                            <span className="text-sm text-gray-500">
                                ID: {testRun.id}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {(testRun.status === 'pending' || testRun.status === 'running') && (
                            <Button
                                variant="destructive"
                                onClick={handleCancel}
                            >
                                Cancel Test Run
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <Link href="/test-runs">Back to Test Runs</Link>
                        </Button>
                    </div>
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
                        className={`px-4 py-2 ${activeTab === 'report'
                            ? 'border-b-2 border-primary font-medium text-primary'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => {
                            setActiveTab('report');
                            if (testRun.status === 'completed' && !report) {
                                fetchReport();
                            }
                        }}
                    >
                        Report
                    </button>
                </div>

                <div className="rounded-lg border p-6">
                    {activeTab === 'details' ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h3 className="text-lg font-medium">Test Run Information</h3>
                                    <div className="mt-2 space-y-2">
                                        <p><span className="font-medium">Status:</span> {testRun.status}</p>
                                        <p><span className="font-medium">Started:</span> {new Date(testRun.started_at).toLocaleString()}</p>
                                        {testRun.completed_at && (
                                            <p><span className="font-medium">Completed:</span> {new Date(testRun.completed_at).toLocaleString()}</p>
                                        )}
                                        <p><span className="font-medium">Time Limit:</span> {testRun.time_limit || 60} seconds</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-medium">Voice Agent</h3>
                                    <div className="mt-2 space-y-2">
                                        <p><span className="font-medium">Agent ID:</span> {testRun.agent_id}</p>
                                        <p><span className="font-medium">Agent Name:</span> {agentName || 'Unknown'}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-medium">Test Cases</h3>
                                <div className="mt-2 space-y-2">
                                    {testRun.test_case_ids && Array.isArray(testRun.test_case_ids) && testRun.test_case_ids.length > 0 ? (
                                        testRun.test_case_ids.map((testCaseId) => (
                                            testCaseId ? (
                                                <div key={testCaseId} className="rounded-lg border p-3">
                                                    <p className="font-medium">{testCaseNames[testCaseId] || 'Unknown Test Case'}</p>
                                                    <p className="text-sm text-gray-500">ID: {testCaseId}</p>
                                                </div>
                                            ) : (
                                                <div key="undefined-test-case" className="rounded-lg border p-3 bg-yellow-50">
                                                    <p className="font-medium text-yellow-700">Invalid Test Case Reference</p>
                                                    <p className="text-sm text-yellow-600">This test run contains an undefined test case ID</p>
                                                </div>
                                            )
                                        ))
                                    ) : (
                                        <div className="rounded-lg border p-3 bg-gray-50">
                                            <p className="text-gray-500">No test cases associated with this test run</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-medium">Test Run Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium">Status</p>
                                        <p className="text-sm">{testRun.status}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Time Limit</p>
                                        <p className="text-sm">{testRun.time_limit} seconds</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Started At</p>
                                        <p className="text-sm">{new Date(testRun.started_at).toLocaleString()}</p>
                                    </div>
                                    {testRun.completed_at && (
                                        <div>
                                            <p className="text-sm font-medium">Completed At</p>
                                            <p className="text-sm">{new Date(testRun.completed_at).toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>

                                {testRun.outbound_call_params && (
                                    <div className="mt-4">
                                        <p className="text-sm font-medium">Outbound Call Parameters</p>
                                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                                            {JSON.stringify(testRun.outbound_call_params, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium">Test Report</h3>

                            {testRun.status !== 'completed' ? (
                                <div className="rounded-lg border border-dashed p-8 text-center">
                                    <p className="text-gray-500">
                                        Report will be available once the test run is completed.
                                    </p>
                                    <p className="mt-2 text-gray-500">
                                        Current status: <span className="font-medium">{testRun.status}</span>
                                    </p>
                                </div>
                            ) : isLoadingReport ? (
                                <div className="flex h-40 items-center justify-center">
                                    <p>Loading report...</p>
                                </div>
                            ) : report ? (
                                <div className="space-y-6">
                                    {/* Extract the first item from the array if report is an array */}
                                    {(() => {
                                        const reportData = Array.isArray(report) && report.length > 0 ? report[0] : report;
                                        return (
                                            <>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div>
                                                        <h4 className="font-medium">Test Information</h4>
                                                        <div className="mt-2 space-y-2">
                                                            <p><span className="font-medium">Test Name:</span> {reportData.test_name}</p>
                                                            <p><span className="font-medium">Description:</span> {reportData.test_description}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium">Evaluation Summary</h4>
                                                        <div className="mt-2 space-y-2">
                                                            <p><span className="font-medium">Pass Rate:</span> {reportData.pass_rate}</p>
                                                            <p><span className="font-medium">Passed:</span> {reportData.pass_count} of {reportData.total_evaluations}</p>
                                                            <p><span className="font-medium">Failed:</span> {reportData.fail_count} of {reportData.total_evaluations}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {reportData.recording_url && (
                                                    <div>
                                                        <h4 className="font-medium">Recording</h4>
                                                        <div className="mt-2">
                                                            <audio controls className="w-full">
                                                                <source src={reportData.recording_url} type="audio/mpeg" />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <h4 className="font-medium">Evaluation Details</h4>
                                                    <div className="mt-2 rounded-lg border p-4">
                                                        {(reportData.evaluations != null && reportData.evaluations.length > 0) ? (
                                                            <div className="divide-y">
                                                                {reportData.evaluations.map((evaluation: any, index: number) => (
                                                                    <div key={index} className="py-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="font-medium">{evaluation.metric_name}</p>
                                                                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${evaluation.result === 'pass'
                                                                                ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400'
                                                                                : 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
                                                                                }`}>
                                                                                {evaluation.result === 'pass' ? 'Pass' : 'Fail'}
                                                                            </span>
                                                                        </div>
                                                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{evaluation.reason}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-gray-500">No evaluation data available.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-medium">Transcript</h4>
                                                    <div className="mt-2 rounded-lg border p-4 max-h-[300px] overflow-y-auto">
                                                        {Array.isArray(reportData.transcript) ? (
                                                            // Handle array format (with speaker, text, timestamp objects)
                                                            reportData.transcript.map((item: any, index: number) => (
                                                                <div key={index} className="mb-4">
                                                                    <p className="font-medium">{item.speaker}:</p>
                                                                    <p className="ml-4">{item.text}</p>
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        {new Date(item.timestamp).toLocaleTimeString()}
                                                                    </p>
                                                                </div>
                                                            ))
                                                        ) : typeof reportData.transcript === 'string' ? (
                                                            // Check if the string contains "assistant:" or "user:" patterns
                                                            reportData.transcript.toLowerCase().includes('assistant:') ||
                                                                reportData.transcript.toLowerCase().includes('user:') ? (
                                                                // Handle string transcript with specific format
                                                                <div>
                                                                    {reportData.transcript.split('\n').map((line: string, index: number) => {
                                                                        // Check if line starts with "assistant:" or "user:"
                                                                        const isAssistant = line.toLowerCase().startsWith('assistant:');
                                                                        const isUser = line.toLowerCase().startsWith('user:');

                                                                        if (isAssistant || isUser) {
                                                                            const [speaker, ...textParts] = line.split(':');
                                                                            const text = textParts.join(':').trim();

                                                                            return (
                                                                                <div key={index} className="mb-4">
                                                                                    <p className={`font-medium ${isAssistant ? 'text-blue-600' : 'text-green-600'}`}>
                                                                                        {speaker}:
                                                                                    </p>
                                                                                    <p className="ml-4">{text}</p>
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            // For lines that don't start with speaker indicators
                                                                            return line.trim() ? (
                                                                                <p key={index} className="mb-2 ml-4">{line}</p>
                                                                            ) : (
                                                                                <div key={index} className="h-2"></div> // Empty space for blank lines
                                                                            );
                                                                        }
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                // Fallback for string without expected format - just split by newlines
                                                                <div>
                                                                    {reportData.transcript.split('\n').map((line: string, index: number) => (
                                                                        <p key={index} className="mb-2">
                                                                            {line}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <p>Transcript data is not in the expected format.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed p-8 text-center">
                                    <p className="text-gray-500">
                                        No report available for this test run.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={fetchReport}
                                    >
                                        Generate Report
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
} 