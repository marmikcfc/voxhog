import logging
from typing import List, Optional, Dict
import uuid
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
        logger.info(f"VoiceTestRunner __init__ called for agent: {agent.agent_id}")
        self.agent = agent
        self.test_cases: List[TestCase] = []
        self.current_test: Optional[TestCase] = None
        self.results = []
        self.test_evaluations: Dict[str, dict] = {}
        self.callback_queue = asyncio.Queue()
        self.call_sid_queue = asyncio.Queue()
        self.server_loop = asyncio.new_event_loop()
        self.call_completion_futures: Dict[str, asyncio.Future] = {}
        self.uvicorn_server_instance: Optional[uvicorn.Server] = None
        
        logger.info("Initializing TestingServer in VoiceTestRunner.")
        self.server = TestingServer(self.agent, self.callback_queue, self.call_sid_queue)
        logger.info("Setting up ngrok tunnel in VoiceTestRunner.")
        base_url = self.server.setup_ngrok()
        if not base_url:
            error_msg = "Failed to establish ngrok tunnel during initialization. Cannot proceed."
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        logger.info(f"Ngrok tunnel established in VoiceTestRunner: {base_url}")
            
        # Create and start the FastAPI application
        logger.info("Creating FastAPI app in VoiceTestRunner.")
        app = self.server.create_app()
        
        # Start server in a background thread
        logger.info("Starting server in background thread in VoiceTestRunner.")
        self.server_thread = threading.Thread(target=self._run_server_with_consumer, args=(app,))
        self.server_thread.daemon = True  # Make thread daemon so it exits when main thread exits
        self.server_thread.start()
        logger.info("Server thread started in VoiceTestRunner.")
        
        # Give server time to start up
        logger.info("Sleeping for 4 seconds to allow server startup in VoiceTestRunner.")
        time.sleep(4) # Consider using a more robust check for server readiness
        logger.info(f"Server started at {base_url} in VoiceTestRunner.")
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
        logger.info(f"run_test_case started for test: {test_case.name}")
        self.current_test = test_case
        self.current_test_time_limit = time_limit
        
        try:
            self.agent.audio_file_name = f"{uuid.uuid4()}.wav"
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
            
            logger.info(f"Waiting for call completion for call_sid: {call_sid} in test_case: {test_case.name}")
            # Wait for call completion and evaluation data
            try:

                #Keep on polling the future until it is done
                while not self.call_completion_futures[call_sid].done():
                    await asyncio.sleep(1)
                evaluation_data = self.call_completion_futures[call_sid].result()

                #evaluation_data = await asyncio.wait_for(self.call_completion_futures[call_sid], timeout= 150)
                logger.info(f"Received transcript for call {call_sid}")
                
                # Evaluate the test case with the complete data
                logger.info(f"Evaluating test_case: {test_case.name} for call_sid: {call_sid}")
                results = await self.evaluate_test_case(test_case, evaluation_data)
                logger.info(f"Finished evaluating test_case: {test_case.name} for call_sid: {call_sid}")
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
            logger.info(f"run_test_case finished for test: {test_case.name}")

    def _run_server_with_consumer(self, app, host: str = "0.0.0.0", port: int = 8765):
        """Run the FastAPI server in a separate thread"""
        logger.info(f"_run_server_with_consumer started. Attempting to bind to {host}:{port}")
        asyncio.set_event_loop(self.server_loop)
        
        # Schedule the consumer in this event loop
        logger.info("Scheduling _post_callback_consumer in _run_server_with_consumer.")
        self.server_loop.create_task(self._post_callback_consumer())
        
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        self.uvicorn_server_instance = uvicorn.Server(config)
        try:
            logger.info(f"Starting uvicorn server on {host}:{port}")
            self.server_loop.run_until_complete(self.uvicorn_server_instance.serve())
        except Exception as e:
            logger.error(f"Error running uvicorn server: {e}", exc_info=True)
            # Potentially re-raise or handle to signal failure to start
        finally:
            logger.info(f"Uvicorn server on {host}:{port} has shut down.")

    async def run_all_tests(self, time_limit: int = 20):
        """Run all test cases"""
        logger.info(f"Starting execution of {len(self.test_cases)} test cases in run_all_tests")
        
        try:
            # Run tests
            for test_case in self.test_cases:
                logger.info(f"Running test case: {test_case.name}")
                result = await self.run_test_case(test_case, time_limit=time_limit)
                self.results.append(result)
        finally:
            # Consider moving cleanup here if runner is reused or if server should stop after all its tests
            pass # self.cleanup() # Example: if cleanup should happen after all tests for this runner
        
        logger.info("All test cases completed in run_all_tests")

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
        Save the test report to a JSON file in the following format:
        - Test name
        - Test description (scenario prompt)
        - Transcript
        - Evaluations as an object array with metric name, result, and reason
        - Total pass vs fail in evaluator
        - Recording URL
        """
        # Ensure the report path has a .json extension
        if not report_path.endswith('.json'):
            report_path = report_path.rsplit('.', 1)[0] + '.json'
            
        logger.debug(f"Saving comprehensive test report to: {report_path}")
        try:
            # Create detailed report rows
            rows = []
            logger.info(f"Saving report for {len(self.results)} test results")
            
            for result in self.results:
                # Count pass/fail results
                pass_count = 0
                fail_count = 0
                evaluations = []
                
                for eval_result in result.get("evaluator_results", []):
                    # Create evaluation object with the required structure
                    evaluation = {
                        "metric_name": eval_result.name,
                        "result": eval_result.result,  # This should be "pass" or "fail"
                        "reason": eval_result.reason
                    }
                    evaluations.append(evaluation)
                    
                    if eval_result.result == "pass":
                        pass_count += 1
                    elif eval_result.result == "fail":
                        fail_count += 1
                
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
                    "transcript": result["transcript"],
                    "evaluations": evaluations,  # Now an array of objects
                    "pass_count": pass_count,
                    "fail_count": fail_count,
                    "total_evaluations": pass_count + fail_count,
                    "pass_rate": f"{(pass_count / (pass_count + fail_count) * 100) if (pass_count + fail_count) > 0 else 0:.2f}%",
                    "recording_url": result.get("recording_url", "No recording URL available")
                }
                
                rows.append(row)
            
            # Save as JSON
            import json
            with open(report_path, 'w') as f:
                json.dump(rows, f, indent=2)
            logger.info(f"Saved comprehensive test report to {report_path}")
            
        except Exception as e:
            logger.error(f"Error saving test report: {str(e)}", exc_info=True)
            raise

    async def _post_callback_consumer(self):
        """Continuously process callback data from the callback queue and set the results for associated call SID."""
        logger.info("_post_callback_consumer started.")
        while True:
            logger.debug("Waiting for callback data from the callback queue in _post_callback_consumer")
            callback_data = await self.callback_queue.get()
            logger.debug(f"Received enqueued data in _post_callback_consumer: {callback_data}")
            call_sid = callback_data.get('CallSid')  # Twilio uses CallSid
            if call_sid in self.call_completion_futures:
                if not self.call_completion_futures[call_sid].done():
                    # Get the transcript for this call from server
                    transcript = self.agent.get_transcript()
                    evaluation_data = {
                        "transcript": transcript,
                        "recording_url": self.agent.audio_file_name
                    }
                    self.call_completion_futures[call_sid].set_result(evaluation_data)
                    await asyncio.sleep(0.1)  # Just a short sleep to let event loop process
                    
                else:
                    logger.warning(f"Future already completed for call SID: {call_sid}")
            else:
                logger.warning(f"Received callback for unknown call SID: {call_sid}") 

    def cleanup(self):
        logger.info(f"VoiceTestRunner cleanup called for agent: {self.agent.agent_id}")

        # Gracefully shutdown uvicorn server first
        if hasattr(self, 'uvicorn_server_instance') and self.uvicorn_server_instance and \
           hasattr(self, 'server_loop') and self.server_loop.is_running():
            logger.info("Signaling uvicorn server to shut down.")
            # Ensure should_exit is set in the server's own event loop
            if self.server_loop.is_running():
                 self.server_loop.call_soon_threadsafe(setattr, self.uvicorn_server_instance, 'should_exit', True)
            else: # Fallback if loop isn't running, though it should be if server was running
                 self.uvicorn_server_instance.should_exit = True
            
            # Wait for the server thread to terminate
            if hasattr(self, 'server_thread') and self.server_thread.is_alive():
                logger.info("Waiting for server thread to terminate...")
                self.server_thread.join(timeout=15) # Increased timeout for graceful shutdown
                if self.server_thread.is_alive():
                    logger.warning("Server thread did not terminate after signaling exit and join. Port might still be in use.")
                else:
                    logger.info("Server thread terminated successfully.")
            else:
                logger.info("Server thread was not alive or did not exist at uvicorn shutdown point.")
        else:
            logger.info("Uvicorn server instance not found or event loop not running; skipping uvicorn shutdown signaling.")
        
        # Stop the event loop if it's still running (e.g., if server.serve() exited prematurely)
        if hasattr(self, 'server_loop') and self.server_loop.is_running():
            logger.info("Stopping server event loop (if not already stopped by server shutdown).")
            self.server_loop.call_soon_threadsafe(self.server_loop.stop)
            # Give a moment for loop.stop() to be processed if server_thread didn't stop it.
            if hasattr(self, 'server_thread') and self.server_thread.is_alive():
                 self.server_thread.join(timeout=5) # Short additional join attempt
                 if self.server_thread.is_alive():
                      logger.warning("Server thread still alive after loop.stop() and additional join.")
                 else:
                      logger.info("Server thread terminated after loop.stop().")

        if hasattr(self, 'server') and self.server:
            logger.info("Calling TestingServer cleanup (for ngrok).")
            self.server.cleanup() 
            logger.info("TestingServer cleanup (for ngrok) called.")
        
        # Final check on server thread, already handled above but good for logging.
        if hasattr(self, 'server_thread') and self.server_thread.is_alive():
            logger.warning("Server thread still alive at the very end of cleanup.")
        elif hasattr(self, 'server_thread'):
             logger.info("Server thread confirmed terminated at the end of cleanup.")
        else:
            logger.info("Server thread was not alive or did not exist at the end of cleanup.")

        logger.info(f"VoiceTestRunner cleanup finished for agent: {self.agent.agent_id}") 