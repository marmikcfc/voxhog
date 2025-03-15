import logging
from typing import List, Optional, Dict
import pandas as pd
from ..voice_agent import Direction, VoiceAgent
from .test_components import TestCase
from .testing_server import TestingServer
from ..voice_agent_evaluation import VoiceAgentEvaluator
import threading
import uvicorn
import time
import asyncio
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VoiceTestRunner:
    def __init__(self, agent: VoiceAgent):
        """
        Initialize the test runner.
        
        Args:
            agent (VoiceAgent): The voice agent to test
            evaluator (VoiceAgentEvaluator): The evaluator to assess conversation quality
        """
        self.agent = agent
        self.test_cases: List[TestCase] = []
        self.current_test: Optional[TestCase] = None
        self.results = []
        self.test_evaluations: Dict[str, dict] = {}
        self.callback_queue = asyncio.Queue()
        self.call_sid_queue = asyncio.Queue()
        self.server_loop = asyncio.new_event_loop()
        self.call_completion_futures: Dict[str, asyncio.Future] = {}
        
        self.server = TestingServer(self.agent, self.callback_queue, self.call_sid_queue)
        base_url = self.server.setup_ngrok()
        if not base_url:
            error_msg = "Failed to establish ngrok tunnel during initialization. Cannot proceed."
            logger.error(error_msg)
            raise RuntimeError(error_msg)
            
        # Create and start the FastAPI application
        app = self.server.create_app()
        
        # Start server in a background thread
        logger.info("Starting server in background thread")
        self.server_thread = threading.Thread(target=self._run_server_with_consumer, args=(app,))
        self.server_thread.daemon = True  # Make thread daemon so it exits when main thread exits
        self.server_thread.start()
        
        # Give server time to start up
        time.sleep(4)
        logger.info(f"Server started at {base_url}")
        # Update agent connection details with server URL
        if hasattr(self.server, 'base_url'):
            self.agent.connection_details['endpoint'] = f"{self.server.base_url}/voice/ws"

    def add_test_case(self, test_case: TestCase):
        """Add a test case to the runner"""
        if test_case.validate():
            self.test_cases.append(test_case)
        else:
            error_msg = "Invalid test case configuration"
            logger.error(error_msg)
            raise ValueError(error_msg)

    async def evaluate_test_case(self, test_case: TestCase, evaluation_data: dict) -> dict:
        """Evaluate a test case using the callback data and transcript"""
        logger.info(f"Evaluating test case: {test_case.name}")
        
        results = {
            "test_case": test_case.name,
            "scenario": test_case.scenario.name,
            "metrics_results": {},
            "transcript": evaluation_data["transcript"],
            "evaluator_results": []
        }
        
        logger.info(f"Evaluating test case: {test_case.name} with evaluator: {test_case.evaluator}")
        
        # Run voice agent evaluator
        try:
            if hasattr(test_case, 'evaluator') and test_case.evaluator:
                evaluator_response = await test_case.evaluator.evaluate_voice_conversation({"transcript": evaluation_data["transcript"]})
                logger.info(f"Received evaluator response: {evaluator_response}")
                
                # Store the evaluations in the results
                if hasattr(evaluator_response, 'evaluations'):
                    results["evaluator_results"] = evaluator_response.evaluations
                else:
                    logger.warning(f"Evaluator response does not have 'evaluations' attribute: {evaluator_response}")
                    results["evaluator_results"] = []
            else:
                logger.info(f"No evaluator configured for test case: {test_case.name}")
                results["evaluator_results"] = []
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error during voice agent evaluation: {str(e)}")
            results["evaluator_results"] = []
        
        return results

    async def _initiate_agent_outbound_call(self) -> dict:
        """
        Make an outbound call using the voice agent provider's API.
        
        Args:
            phone_number (str): The phone number to call
            
        Returns:
            dict: Response from the voice agent provider's API
        """
        # Update the Twilio phone number webhook URL
        self.server.update_twilio_phone_number_webhook_url()
        logger.info("Twilio phone number webhook URL updated")
        try:
            auth_token = os.getenv("VOICE_AGENT_API_AUTH_TOKEN")
            if not auth_token:
                raise ValueError("VOICE_AGENT_API_AUTH_TOKEN environment variable not set")

            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json',
            }

            data = self.agent.get_outbound_call_data()

            api_url = os.getenv("VOICE_AGENT_API")
            if not api_url:
                raise ValueError("VOICE_AGENT_API environment variable not set")

            logger.info(f"Making API request to {api_url}")
            response = requests.post(f"{api_url}", headers=headers, json=data)

            if response.status_code == 201:
                logger.info("Outbound call created successfully")
                return response.json()
            else:
                error_msg = f"Failed to create outbound call. Status: {response.status_code}, Response: {response.text}"
                logger.error(error_msg)
                raise RuntimeError(error_msg)

        except Exception as e:
            logger.error(f"Error making outbound call: {str(e)}", exc_info=True)
            raise

    async def run_test_case(self, test_case: TestCase, time_limit: int = 60) -> dict:
        """Run a single test case"""
        self.current_test = test_case
        self.current_test_time_limit = time_limit
        
        try:
            # Initialize agent connection for this test case
            self.agent.initialize_connection()
            
            # Set the agent's persona and scenario for this test
            self.agent.set_persona_and_scenario(
                persona=test_case.user_persona.prompt,
                scenario=test_case.scenario.prompt
            )
            
            #Always reset the transcript handler for each test case
            self.agent.reset_transcript_handler()

            # Handle call based on direction
            if self.agent.direction == Direction.INBOUND:
                phone_number = self.agent.get_phone_number()
                if not phone_number:
                    error_msg = "Agent is configured for inbound calls but no phone number is provided"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)
                    
                logger.info(f"Initiating inbound test call to {phone_number}")
                # Create future before making the call
                call_result = await self.server.start_twilio_call(phone_number, time_limit=time_limit)
                call_sid = call_result.get('call_sid', )
                if not call_sid:
                    error_msg = "No call SID returned from Twilio"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)
            else:
                # For outbound calls:
                # 1. Initiate the outbound call through the agent's API
                # 2. Wait to receive the call SID through the twilio_callback endpoint
                logger.info("Initiating outbound test call through agent API")
                await self._initiate_agent_outbound_call()
                
                # Wait for the call SID to be received via the twilio_callback endpoint
                logger.info("Waiting for call SID from Twilio callback")
                call_sid = await asyncio.wait_for(self.call_sid_queue.get(), timeout=60)
                
                if not call_sid:
                    error_msg = "No call SID received from Twilio callback within timeout period"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)
                
                logger.info(f"Received call SID for outbound call: {call_sid}")

            # Create future for this call
            self.call_completion_futures[call_sid] = asyncio.Future()
            
            # Wait for call completion and evaluation data
            try:

                #Keep on polling the future until it is done
                while not self.call_completion_futures[call_sid].done():
                    await asyncio.sleep(1)
                evaluation_data = self.call_completion_futures[call_sid].result()

                #evaluation_data = await asyncio.wait_for(self.call_completion_futures[call_sid], timeout= 150)
                logger.info(f"Received transcript for call {call_sid}")
                
                # Evaluate the test case with the complete data
                results = await self.evaluate_test_case(test_case, evaluation_data)
                # Add recording URL to results
                results["recording_url"] = evaluation_data.get("recording_url", "No recording URL available")
                self.test_evaluations[call_sid] = results
                # Cleanup
                del self.call_completion_futures[call_sid]
                return results
                
            except asyncio.TimeoutError:
                error_msg = "Timeout waiting for call completion and evaluation"
                logger.error(error_msg)
                if call_sid in self.call_completion_futures:
                    del self.call_completion_futures[call_sid]
                raise RuntimeError(error_msg)
                        
            
        except Exception as e:
            logger.error(f"Error in test case '{test_case.name}': {str(e)}")
            raise
        finally:
            logger.debug("Disconnecting agent")
            self.agent.disconnect()
            self.current_test = None

    def _run_server_with_consumer(self, app, host: str = "0.0.0.0", port: int = 8765):
        """Run the FastAPI server in a separate thread"""
        asyncio.set_event_loop(self.server_loop)
        
        # Schedule the consumer in this event loop
        self.server_loop.create_task(self._post_callback_consumer())
        
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)
        self.server_loop.run_until_complete(server.serve())

    async def run_all_tests(self, time_limit: int = 20):
        """Run all test cases"""
        logger.info(f"Starting execution of {len(self.test_cases)} test cases")
        
        try:
            # Run tests
            for test_case in self.test_cases:
                logger.info(f"Running test case: {test_case.name}")
                result = await self.run_test_case(test_case, time_limit=time_limit)
                self.results.append(result)
        finally:
            pass
        
        logger.info("All test cases completed")

    async def _evaluate_metric(self, metric: dict, transcript: list) -> float:
        """Evaluate a single metric using the complete transcript"""
        try:
            # Implement metric evaluation logic here
            # This is a placeholder - you should implement your own evaluation logic
            return 0.0
        except Exception as e:
            logger.error(f"Error evaluating metric {metric['name']}: {str(e)}")
            return 0.0

    def generate_test_report(self):
        """Generate a comprehensive test report"""
        logger.info("Generating test report")
        report = {
            "total_tests": len(self.test_cases),
            "completed_tests": len(self.results),
            "results": self.results
        }
        logger.debug(f"Test report generated. Total tests: {report['total_tests']}, Completed: {report['completed_tests']}")
        return report

    def save_report(self, report_path: str):
        """
        Save the test report to a CSV file in the following format:
        - Test name
        - Test description (scenario prompt)
        - Transcript
        - Evaluators and their evaluation
        - Total pass vs fail in evaluator
        - Recording URL
        """
        logger.debug(f"Saving comprehensive test report to: {report_path}")
        try:
            # Create detailed report rows
            rows = []
            logger.info(f"Saving report for {len(self.results)} test results")
            
            for result in self.results:
                # Count pass/fail results
                pass_count = 0
                fail_count = 0
                evaluations_text = []
                
                for eval_result in result.get("evaluator_results", []):
                    eval_text = f"{eval_result.name}: {eval_result.result} - {eval_result.reason}"
                    evaluations_text.append(eval_text)
                    
                    if eval_result.result == "pass":
                        pass_count += 1
                    elif eval_result.result == "fail":
                        fail_count += 1
                
                # Format transcript for readability
                transcript_text = "\n".join([f"{msg.role}: {msg.content}" for msg in result["transcript"]])
                
                # Get test description from scenario
                test_description = "No description available"
                for test_case in self.test_cases:
                    if test_case.name == result["test_case"]:
                        test_description = test_case.scenario.prompt
                        break
                
                # Create the row
                row = {
                    "test_name": result["test_case"],
                    "test_description": test_description,
                    "transcript": transcript_text,
                    "evaluations": "\n".join(evaluations_text),
                    "pass_count": pass_count,
                    "fail_count": fail_count,
                    "total_evaluations": pass_count + fail_count,
                    "pass_rate": f"{(pass_count / (pass_count + fail_count) * 100) if (pass_count + fail_count) > 0 else 0:.2f}%",
                    "recording_url": result.get("recording_url", "No recording URL available")
                }
                
                rows.append(row)
            
            # Create DataFrame and save to CSV
            df = pd.DataFrame(rows)
            df.to_csv(report_path, index=False)
            logger.info(f"Saved comprehensive test report to {report_path}")
            
        except Exception as e:
            logger.error(f"Error saving test report: {str(e)}", exc_info=True)
            raise

    async def _post_callback_consumer(self):
        """Continuously process callback data from the callback queue and set the results for associated call SID."""
        while True:
            logger.debug("Waiting for callback data from the callback queue")
            callback_data = await self.callback_queue.get()
            logger.debug(f"Received enqueued data: {callback_data}")
            call_sid = callback_data.get('CallSid')  # Twilio uses CallSid
            if call_sid in self.call_completion_futures:
                if not self.call_completion_futures[call_sid].done():
                    # Get the transcript for this call from server
                    transcript = self.agent.get_transcript()
                    evaluation_data = {
                        "transcript": transcript,
                        "recording_url": callback_data.get('RecordingUrl', 'No recording URL available')
                    }
                    self.call_completion_futures[call_sid].set_result(evaluation_data)
                    await asyncio.sleep(0.1)  # Just a short sleep to let event loop process
                    
                else:
                    logger.warning(f"Future already completed for call SID: {call_sid}")
            else:
                logger.warning(f"Received callback for unknown call SID: {call_sid}") 