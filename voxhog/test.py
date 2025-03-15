from voxhog import VoiceTestRunner, TestCase, UserPersona, Scenario, VoiceAgent
from .voice_agent import Direction
from .voice_agent_evaluation import VoiceAgentEvaluator, VoiceAgentMetric
from openai import AsyncOpenAI
import asyncio
import os
from dotenv import load_dotenv
import logging
import json

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

async def main():   
    
    phone_number = os.getenv("TWILIO_PHONE_NUMBER")
    logger.info(f"Phone number: {phone_number}")
    phone_number_id = os.getenv("VAPI_PHONE_NUMBER_ID")

    agent = VoiceAgent(
        agent_id="dental-office-assistant",
        agent_type="phone",
        connection_details={
            "phone_number": os.getenv("AGENT_PHONE_NUMBER")
        },
        direction=Direction.INBOUND,

        voice_agent_api_args = {
                'assistantId': os.getenv("TESTING_ASSISTANT_ID"),
                'phoneNumberId': phone_number_id,
                "customer": {
                    "number": phone_number
                }
            }
    )

    # Set the dental assistant as the agent's persona
    agent.set_persona_and_scenario(
        persona="""You are a voice assistant for Mary's Dental, a dental office located at 123 North Face Place, Anaheim, California. 
        The hours are 8 AM to 5PM daily, but they are closed on Sundays.

        Mary's dental provides dental services to the local Anaheim community. The practicing dentist is Dr. Mary Smith.

        You are tasked with answering questions about the business, and booking appointments. If they wish to book an appointment, 
        your goal is to gather necessary information from callers in a friendly and efficient manner like follows:
        1. Ask for their full name.
        2. Ask for the purpose of their appointment.
        3. Request their preferred date and time for the appointment.
        4. Confirm all details with the caller, including the date and time of the appointment.

        Be sure to be kind of funny and witty! Keep all your responses short and simple. 
        Use casual language, phrases like "Umm...", "Well...", and "I mean" are preferred.
        This is a voice conversation, so keep your responses short, like in a real conversation. Don't ramble for too long.""",
        scenario="You are ready to assist callers with their dental office inquiries and appointment bookings."
    )

    # Test Case 1: User booking an appointment
    booking_persona = UserPersona(
        name="Michael Chen",
        prompt="""You are Michael, a busy professional who needs a teeth cleaning. You:
        1. Have a specific time in mind for the appointment
        2. Are direct and to-the-point
        3. Want to get a routine cleaning done
        4. Have been to a dentist before but are new to this office"""
    )

    booking_scenario = Scenario(
        name="Initial Appointment Booking",
        prompt="""You're calling to schedule a routine cleaning appointment.
        
        Your conversation flow:
        1. Greet and state you want to schedule a cleaning
        2. When asked, provide your name (Michael Chen)
        3. Specify you want a routine cleaning
        4. Request this Friday at 10:30 AM
        5. Confirm the appointment details"""
    )

    booking_evaluator = VoiceAgentEvaluator( model="gpt-4o-mini")
    booking_evaluator.add_metric(VoiceAgentMetric(
        name="Conversation Flow",
        prompt="Evaluate if the conversation flows naturally and the agent maintains appropriate turn-taking"
    ))
    booking_evaluator.add_metric(VoiceAgentMetric(
        name="Task Completion",
        prompt="Assess if the agent successfully completes the primary task booking with all necessary information"
    ))
    booking_evaluator.add_metric(VoiceAgentMetric(
        name="Personality Consistency",
        prompt="Evaluate if the agent maintains its friendly and witty personality throughout the conversation"
    ))


    booking_test_case = TestCase(
        name="Initial Appointment Booking",
        scenario=booking_scenario,
        user_persona=booking_persona,
        evaluator=booking_evaluator
    )

    # Test Case 2: User rescheduling appointment
    reschedule_persona = UserPersona(
        name="Michael Chen",
        prompt="""You are Michael, calling to reschedule your appointment. You:
        1. Already have an appointment for Friday at 10:30 AM
        2. Need to change it to a different time
        3. Are apologetic but direct about needing to change"""
    )

    reschedule_scenario = Scenario(
        name="Appointment Rescheduling",
        prompt="""You're calling to reschedule your existing appointment.
        
        Your conversation flow:
        1. Greet and explain you need to reschedule your Friday 10:30 AM appointment
        2. When asked, confirm your name (Michael Chen)
        3. Request to change to Tuesday at 12:30 PM instead
        4. Confirm the new appointment details
        5. Thank them for their help with the change"""
    )

    reschedule_test_case = TestCase(
        name="Appointment Rescheduling",
        scenario=reschedule_scenario,
        user_persona=reschedule_persona,
        evaluator=None
    )

    # Initialize test runner with both agent and evaluator
    test_runner = VoiceTestRunner(agent=agent)

    # Add test cases
    test_runner.add_test_case(booking_test_case)
    #test_runner.add_test_case(reschedule_test_case)

    # Run tests
    await test_runner.run_all_tests(time_limit=30)

    # Save test results to CSV
    test_runner.save_report("voice_test_results.csv")

    # Print conversation transcripts
    print("\nConversation Transcripts:")
    for message in agent.get_transcript():
        print(f"{message.role}: {message.content}")

if __name__ == "__main__":
    asyncio.run(main())
