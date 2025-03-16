import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Replace with your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        const id = params.id;

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // First, try to get the test run details to find the agent_id
        const testRunResponse = await fetch(`${API_URL}/api/v1/test-runs/${id}`, {
            headers: {
                'Authorization': authHeader
            }
        });

        if (!testRunResponse.ok) {
            const error = await testRunResponse.json();
            return NextResponse.json(
                { error: error.detail || 'Failed to fetch test run details' },
                { status: testRunResponse.status }
            );
        }

        const testRun = await testRunResponse.json();
        const agentId = testRun.agent_id;

        // Check if a local report exists
        const reportPath = path.join(process.cwd(), 'reports', agentId, id, 'report.json');

        if (fs.existsSync(reportPath)) {
            try {
                const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                return NextResponse.json(reportData);
            } catch (error) {
                console.error('Error reading local report:', error);
                // Continue to try fetching from backend if local report can't be read
            }
        }

        // If no local report, try to fetch from the backend
        const response = await fetch(`${API_URL}/api/v1/test-runs/${id}/report`, {
            headers: {
                'Authorization': authHeader
            }
        });

        // If the backend doesn't have a report endpoint or returns an error,
        // we'll generate a report on the fly
        if (!response.ok) {
            // This will trigger the POST endpoint to generate a new report
            return NextResponse.json(
                { error: 'No existing report found' },
                { status: 404 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Test run report API error:', error);
        return NextResponse.json(
            { error: 'Failed to get test run report' },
            { status: 500 }
        );
    }
}

// POST endpoint to generate a report
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        const id = params.id;

        if (!authHeader) {
            return NextResponse.json(
                { error: 'Missing authorization header' },
                { status: 401 }
            );
        }

        // Get test run details
        const testRunResponse = await fetch(`${API_URL}/api/v1/test-runs/${id}`, {
            headers: {
                'Authorization': authHeader
            }
        });

        if (!testRunResponse.ok) {
            const error = await testRunResponse.json();
            return NextResponse.json(
                { error: error.detail || 'Failed to fetch test run details' },
                { status: testRunResponse.status }
            );
        }

        const testRun = await testRunResponse.json();

        // Get transcript
        const transcriptResponse = await fetch(`${API_URL}/api/v1/test-runs/${id}/transcript`, {
            headers: {
                'Authorization': authHeader
            }
        });

        let transcript = [];
        if (transcriptResponse.ok) {
            transcript = await transcriptResponse.json();
        }

        // Get test case details for name and description
        let testName = 'Unknown Test';
        let testDescription = 'No description available';

        if (testRun.test_case_ids && testRun.test_case_ids.length > 0) {
            const testCaseResponse = await fetch(`${API_URL}/api/v1/test-cases/${testRun.test_case_ids[0]}`, {
                headers: {
                    'Authorization': authHeader
                }
            });

            if (testCaseResponse.ok) {
                const testCase = await testCaseResponse.json();
                testName = testCase.name;
                testDescription = testCase.description;
            }
        }

        // Calculate evaluation metrics if available
        let evaluations = [];
        let passCount = 0;
        let failCount = 0;
        let totalEvaluations = 0;
        let passRate = 0;

        if (testRun.results && testRun.results.evaluations) {
            evaluations = testRun.results.evaluations;
            totalEvaluations = evaluations.length;

            passCount = evaluations.filter((evaluation: any) => evaluation.passed).length;
            failCount = totalEvaluations - passCount;
            passRate = totalEvaluations > 0 ? (passCount / totalEvaluations) * 100 : 0;
        }

        // Create report object
        const report = {
            test_name: testName,
            test_description: testDescription,
            transcript: transcript,
            evaluations: evaluations,
            pass_count: passCount,
            fail_count: failCount,
            total_evaluations: totalEvaluations,
            pass_rate: passRate,
            recording_url: testRun.recording_url || null,
            agent_id: testRun.agent_id,
            run_id: id,
            created_at: new Date().toISOString()
        };

        // Store the report locally
        const reportsDir = path.join(process.cwd(), 'reports');
        const agentDir = path.join(reportsDir, testRun.agent_id);
        const runDir = path.join(agentDir, id);

        try {
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true });
            }

            if (!fs.existsSync(runDir)) {
                fs.mkdirSync(runDir, { recursive: true });
            }

            // Write the report data to a JSON file
            const reportFilePath = path.join(runDir, 'report.json');
            fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2));

            // Create a CSV file with the specified format
            const csvData = [
                'test_name,test_description,transcript,evaluations,pass_count,fail_count,total_evaluations,pass_rate,recording_url',
                `"${report.test_name}","${report.test_description}","${JSON.stringify(report.transcript).replace(/"/g, '""')}","${JSON.stringify(report.evaluations).replace(/"/g, '""')}",${report.pass_count},${report.fail_count},${report.total_evaluations},${report.pass_rate},"${report.recording_url || ''}"`
            ].join('\n');

            const csvFilePath = path.join(runDir, 'report.csv');
            fs.writeFileSync(csvFilePath, csvData);

            console.log(`Report stored at: ${runDir}`);
        } catch (error) {
            console.error('Error storing report locally:', error);
            // Continue even if local storage fails
        }

        return NextResponse.json(report);
    } catch (error) {
        console.error('Generate report API error:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
} 