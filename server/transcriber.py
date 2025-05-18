import io
import os
import logging
from typing import Optional
import traceback
import numpy as np

logger = logging.getLogger(__name__)

class Transcriber:
    def __init__(self, service_config: Optional[dict] = None):
        """
        Initializes the Transcriber.
        'service_config' can be used to pass API keys or other service-specific settings.
        """
        self.service_config = service_config
        logger.info("Transcriber initialized.")
        # Example: if self.service_config and self.service_config.get("api_key"):
        #     logger.info("Transcription service API key found.")

    
    def transcribe_audio(self, audio_data, sample_rate=16000, channels=1):
        """
        Transcribe audio using Deepgram or another transcription service.
        
        Args:
            audio_data: Audio data as file-like object or bytes
            sample_rate (int): Sample rate of the audio
            channels (int): Number of audio channels
            
        Returns:
            The transcription result object
        """
        try:
            # Import here to avoid dependency issues if not using this function
            from deepgram import DeepgramClient, PrerecordedOptions
            
            # Initialize the Deepgram client with API key from environment
            deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
            if not deepgram_api_key:
                # Check service_config as a fallback
                if self.service_config and self.service_config.get("DEEPGRAM_API_KEY"):
                    deepgram_api_key = self.service_config.get("DEEPGRAM_API_KEY")
                else:
                    logger.error("DEEPGRAM_API_KEY not found in environment variables or service_config.")
                    raise ValueError("DEEPGRAM_API_KEY not configured.")
                
            deepgram = DeepgramClient(deepgram_api_key)
            
            # Configure options for transcription
            options = PrerecordedOptions(
                model="nova-2",
                smart_format=True,
                diarize=True,
                utterances=True,
                punctuate=True,
                language="hi" # Consider making language configurable
            )
            
            # If audio_data is a path (string), read it. Otherwise, assume it's bytes or BytesIO.
            if isinstance(audio_data, str): # Assuming audio_data can be a path for this method
                 with open(audio_data, 'rb') as f:
                    payload = f.read()
            elif isinstance(audio_data, io.BytesIO):
                payload = {'buffer': audio_data, 'mimetype': 'application/octet-stream'} # Deepgram SDK expects buffer and mimetype
            else: # Assuming audio_data is already bytes
                payload = {'buffer': io.BytesIO(audio_data), 'mimetype': 'application/octet-stream'}

            source = {'buffer': payload, 'mimetype': 'application/octet-stream'}
            if isinstance(audio_data, io.BytesIO):
                source = {'buffer': audio_data, 'mimetype': 'application/octet-stream'}
            elif isinstance(audio_data, bytes):
                source = {'buffer': io.BytesIO(audio_data), 'mimetype': 'application/octet-stream'}
            else: # Should not happen if called from transcribe method, but good for robustness
                logger.error("Invalid audio_data type for transcribe_audio")
                return None

            logger.info("Sending audio to Deepgram for transcription...")
            # The Deepgram Python SDK's transcribe_file method actually takes a file path
            # or a dictionary payload {'buffer': data, 'mimetype': 'audio/wav'}
            # Let's ensure we're using it correctly. For prerecorded from buffer:
            response = deepgram.listen.prerecorded.v("1").transcribe_file_path(audio_data, options) if isinstance(audio_data, str) else deepgram.listen.prerecorded.v("1").transcribe_file(source, options)

            logger.info("Transcription response received from Deepgram.")
            return response
            
        except Exception as e:
            logger.error(f"Error in transcription: {e}")
            traceback.print_exc()
            return None

    def format_transcript(self, transcription_result, diarization=None):
        """
        Format the transcription result into a readable transcript.
        
        Args:
            transcription_result: The result from the transcription service (Deepgram response object)
            diarization (list, optional): Speaker diarization results (currently not used directly from param, but from result)
            
        Returns:
            str: Formatted transcript or error message string
        """
        try:
            if not transcription_result or not hasattr(transcription_result, 'results') or not hasattr(transcription_result.results, 'utterances'):
                logger.warning("Transcription result is missing expected structure (results or utterances).")
                return "Transcription result incomplete or malformed."

            utterances = transcription_result.results.utterances
            if not utterances:
                logger.info("No utterances found in transcription result.")
                # Try to get a basic transcript if utterances are empty but a transcript exists
                if hasattr(transcription_result.results, 'channels') and transcription_result.results.channels:
                    alt_transcript = transcription_result.results.channels[0].alternatives[0].transcript
                    if alt_transcript:
                        logger.info("Using alternative transcript as utterances were empty.")
                        return alt_transcript
                return "No utterances found to format."
            
            formatted_lines = []
            for utterance in utterances:
                start_time = utterance.start
                speaker_label = f"Speaker {utterance.speaker}" # Deepgram provides speaker directly in utterance when diarize=True
                
                line = f"{speaker_label} ({start_time:.2f}s): {utterance.transcript}"
                formatted_lines.append(line)
            
            return "\n".join(formatted_lines)
            
        except Exception as e:
            logger.error(f"Error formatting transcript: {e}")
            traceback.print_exc()
            return f"Error formatting transcript: {str(e)}"

    async def transcribe(self, audio_file_path: str) -> str:
        """
        Transcribes the audio file at the given path using Deepgram and formats the result.
        
        Args:
            audio_file_path: The path to the audio file.
            
        Returns:
            The formatted transcript text or an error message.
            
        Raises:
            FileNotFoundError: If the audio file does not exist.
        """
        logger.info(f"Attempting to transcribe audio file: {audio_file_path} using integrated methods.")

        if not os.path.exists(audio_file_path):
            logger.error(f"Audio file not found at {audio_file_path}")
            raise FileNotFoundError(f"Audio file not found at {audio_file_path}")

        try:
            # Read audio data as bytes
            with open(audio_file_path, 'rb') as audio_file:
                audio_bytes = audio_file.read()
            
            # Use io.BytesIO for Deepgram SDK if it expects a file-like object for buffer
            audio_buffer = io.BytesIO(audio_bytes)
            
            # Call transcribe_audio with the audio buffer
            # The transcribe_audio method in the prompt expects a file path or bytes for `audio_data`
            # Passing audio_file_path directly to transcribe_audio is an option if it handles reading
            # For consistency, we'll pass the path and let transcribe_audio handle opening or use the buffer.
            # Let's stick to passing the path, as transcribe_audio already has logic for it.
            raw_transcription_result = self.transcribe_audio(audio_data=audio_file_path) # Pass path

            if raw_transcription_result is None:
                logger.error(f"Transcription failed for {audio_file_path}, no result from transcribe_audio.")
                return "Transcription failed or returned no result."

            # Format the transcript
            formatted_transcript = self.format_transcript(raw_transcription_result)
            
            logger.info(f"Transcription and formatting successful for: {audio_file_path}")
            return formatted_transcript

        except FileNotFoundError as fnf_error:
            logger.error(f"File not found during transcription process: {str(fnf_error)}")
            raise fnf_error # Re-raise to be handled by caller
        except Exception as e:
            logger.error(f"Error during integrated transcription process for {audio_file_path}: {str(e)}", exc_info=True)
            return f"Transcription process failed: {str(e)}"

