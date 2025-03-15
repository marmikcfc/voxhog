from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import HTMLResponse
from twilio.twiml.voice_response import VoiceResponse, Connect
from fastapi.responses import PlainTextResponse
import json
import uvicorn
from typing import Optional, Dict
import logging
import os
from pyngrok import ngrok, conf

from twilio.rest import Client
from dotenv import load_dotenv
import asyncio
from collections import defaultdict

from ..voice_agent import Direction, VoiceAgent

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TestingServer:
    """Server implementation for testing voice agents"""
    
    def __init__(self, voice_agent: VoiceAgent, callback_queue: asyncio.Queue, call_sid_queue: asyncio.Queue):
        """
        Initialize the testing server
        
        Args:
            voice_agent (VoiceAgent): The voice agent instance to test
        """
        self.voice_agent = voice_agent
        self.app: Optional[FastAPI] = None
        self.ngrok_tunnel = None
        self.base_url = None
        self.callback_queue = callback_queue
        self.call_sid_queue = call_sid_queue  # Queue for storing call SIDs from twilio_callback
        
        # Load environment variables
        load_dotenv()
        
        # Initialize Twilio client
        self.twilio_client = Client(
            os.getenv('TWILIO_ACCOUNT_SID'),
            os.getenv('TWILIO_AUTH_TOKEN')
        )
        
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
                
        self.transcripts: Dict[str, list] = defaultdict(list)

    def update_twilio_phone_number_webhook_url(self):
        """Update the Twilio phone number"""
        try:
            logger.info(f"Updating Twilio phone number webhook URL to {self.base_url}/twilio_connect")
            self.twilio_client.incoming_phone_numbers.get(sid = os.getenv('TWILIO_PHONE_NUMBER_SID')).update(voice_url=f"{self.base_url}/twilio_connect")
        except Exception as e:
            logger.error(f"Error updating Twilio phone number webhook URL: {e}")

    def setup_ngrok(self):
        """Setup and start ngrok tunnel"""
        logger.info("Setting up ngrok tunnel")
        try:
            # Configure ngrok
            ngrok_auth_token = os.getenv('NGROK_AUTH_TOKEN')
            if ngrok_auth_token:
                conf.get_default().auth_token = ngrok_auth_token
            
            # Start ngrok tunnel
            self.ngrok_tunnel = ngrok.connect(8765)
            self.base_url = self.ngrok_tunnel.public_url.replace('http://', 'https://')
            logger.info(f"Ngrok tunnel established: {self.base_url}")
            return self.base_url
        except Exception as e:
            logger.error(f"Error setting up ngrok: {e}")
            return None
    

    async def start_twilio_call(self, phone_number: str, time_limit: int = 60):
        """Initiate an outbound test call to the specified phone number for inbound agent testing"""
        try:
            logger.info(f"Creating call to {phone_number} from {self.twilio_phone_number} with time limit {time_limit}")
            call = self.twilio_client.calls.create(
                to=phone_number,
                from_=self.twilio_phone_number,
                url=f"{self.base_url}/twilio_connect",
                method="POST",
                record=False,
                time_limit=time_limit,
                status_callback=f"{self.base_url}/callback",
                status_callback_method="POST"
            )
            return {"status": "initiated", "call_sid": call.sid}
        except Exception as e:
            logger.error(f"Error making call: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    def _create_router(self) -> FastAPI:
        """
        Create FastAPI router for voice agent testing endpoints
        
        Returns:
            FastAPI: Router with testing endpoints
        """
        router = FastAPI()
        
        router.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        
        @router.post('/twilio_connect')
        async def twilio_connect(request: Request):
            """Handle Twilio webhook for establishing test WebSocket connection"""
            try:
                form_data = await request.form()
                data = dict(form_data)
                call_sid = data.get('CallSid')

                if call_sid:
                            
                    await self.call_sid_queue.put(call_sid)
                    await asyncio.sleep(0.1)
                    logger.info(f"Received outbound call callback with CallSid: {call_sid}")
                    # Instruct Twilio to connect to our WebSocket
                    response = VoiceResponse()
                    connect = Connect()
                    websocket_url = f'{self.base_url.replace("https://", "wss://")}/ws'
                    connect.stream(url=websocket_url)
                    response.append(connect)
                    return PlainTextResponse(str(response), media_type='text/xml')
                else:
                    logger.error("No CallSid found in Twilio callback data")
                    raise HTTPException(status_code=400, detail="No CallSid provided")
            except Exception as e:
                logger.error(f"Error in twilio_connect: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))

        @router.post('/callback')
        async def callback(request: Request):
            """Endpoint to receive call completion callback and queue for processing"""
            try:
                form_data = await request.form()
                data = dict(form_data)
                logger.info(f"Received callback with data: {data}")
                self.callback_queue.put_nowait(data)
                logger.info(f"Enqueued data: {data}")
                return {"status": "queued"}
            except Exception as e:
                import traceback
                traceback.print_exc()
                logger.error(f"Error in callback: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))

        @router.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            """Handle WebSocket connection for voice streaming"""
            await websocket.accept()
            
            # Get initial connection data
            start_data = websocket.iter_text()
            await start_data.__anext__()
            call_data = json.loads(await start_data.__anext__())
            stream_sid = call_data["start"]["streamSid"]
            call_sid = call_data["start"]["callSid"]
            
            logger.info(f"WebSocket connection accepted for call_sid {call_sid}")
            
            # Store transcript for this call
            transcript = []
            
            
            # Handle the connection with the voice agent
            await self.voice_agent.handle_websocket_connection(
                websocket=websocket,
                stream_sid=stream_sid,
                call_sid=call_sid,
                twilio_client=self.twilio_client
            )
            logger.info(f"Done with the call")
        
        return router

    def create_app(self) -> FastAPI:
        """
        Create the FastAPI application for testing
        
        Returns:
            FastAPI: Application instance with testing endpoints
        """
        self.app = FastAPI(title="RagaAI Voice Agent Testing Server")
        voice_router = self._create_router()
        self.app.mount("/", voice_router)
        return self.app

    def run(self, host: str = "0.0.0.0", port: int = 8765):
        """
        Run the testing server
        
        Args:
            host (str): Host to bind the server to
            port (int): Port to run the server on
        """
        if not self.base_url:
            self.setup_ngrok()
            if not self.base_url:
                logger.error("Failed to establish ngrok tunnel. Cannot start server.")
                return
                
        if not self.app:
            self.create_app()
            
        logger.info(f"Starting server on {host}:{port}")
        
        uvicorn.run(self.app, host=host, port=port)