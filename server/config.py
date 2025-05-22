import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Tuple

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    app_name: str = "VoxHog API"
    admin_email: str = "admin@example.com"
    debug: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Database settings (for future implementation)
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./voxhog.db")
    
    # Authentication settings
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # API settings
    api_prefix: str = "/api/v1"
    
    # Voice service settings
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_phone_number: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    vapi_phone_number_id: str = os.getenv("VAPI_PHONE_NUMBER_ID", "")
    
    # Credentials storage
    credentials_dir: Path = Path("./credentials")
    
    # API Keys - consider moving to a more secure storage or env variables
    deepgram_api_key: str = "your-deepgram-api-key"
    elevenlabs_api_key: str = "your-elevenlabs-api-key"
    cartesia_api_key: str = "your-cartesia-api-key"
    
    # Twilio settings (if using Twilio for phone capabilities)
    base_url: str = "http://localhost:8000" # Base URL of your FastAPI app for webhooks
    
    # Add this method to the Settings class
    def ensure_credentials_dir(self):
        """Ensure the credentials directory exists"""
        self.credentials_dir.mkdir(exist_ok=True)
        return self.credentials_dir

settings = Settings()

# Ensure credentials directory exists
settings.ensure_credentials_dir()

# Supported languages and accents configuration
SUPPORTED_LANGUAGES_ACCENTS: Dict[str, List[str]] = {
    "Hindi": ["Bihari", "Bhojpuri", "Standard", "Haryanvi"],
    "English": ["Indian", "American", "British"],
    "Filipino": ["Standard", "Ilocano", "Cebuano"] # Assuming 'Filipino' as language, others as accents
}

# Mapping for ElevenLabs voice IDs
# IMPORTANT: Replace these with actual valid ElevenLabs voice IDs for your account and desired voices.
# ELEVENLABS_VOICE_MAPPING: Dict[Tuple[str, str], str] = {
#     # English
#     ("English", "American"): "uYXf8XasLslADfZ2MB4u", # e.g., a typical American voice
#     ("English", "British"): "G17SuINrv2H9FC6nvetn", # Existing "Female" - verify accent, maybe Rachel from EL
#     ("English", "Indian"): "pzxut4zZz4GImZNlqQ3H",   # e.g., a voice with an Indian English accent

#     # Hindi - Note: ElevenLabs has multilingual models. You might need to use a specific model that supports Hindi
#     # and then select a voice ID that speaks Hindi with the desired accent.
#     # The voice IDs below are placeholders.
#     ("Hindi", "Standard"): "m5qndnI7u4OAdXhH0Mr5",
#     ("Hindi", "Bihari"): "3Th96YoTP1kEKxJroYo1",
#     ("Hindi", "Bhojpuri"): "7NsaqHdLuKNFvEfjpUno",
#     ("Hindi", "Haryanvi"): "v984ziaDjt5EKuv3UFRU",

#     # Filipino Languages - Similar to Hindi, check ElevenLabs model and voice capabilities.
#     # These might require specific voice IDs from a multilingual model that supports these languages/accents.
#     ("Filipino", "Standard"): "7tWz9X5zl45gE6bg2uiN", # (e.g. Tagalog)
#     ("Filipino", "Ilocano"): "210zNy7juwIO3DylDyJk",
#     ("Filipino", "Cebuano"): "RKj1DIXprh8zdvjllfhJ",
# }


ELEVENLABS_VOICE_MAPPING: Dict[Tuple[str, str], str] = {
    # English
    ("English", "American"): "zrHiDhphv9ZnVXBqCLjz", # e.g., a typical American voice
    ("English", "British"): "zrHiDhphv9ZnVXBqCLjz", # Existing "Female" - verify accent, maybe Rachel from EL
    ("English", "Indian"): "zrHiDhphv9ZnVXBqCLjz",   # e.g., a voice with an Indian English accent

    # Hindi - Note: ElevenLabs has multilingual models. You might need to use a specific model that supports Hindi
    # and then select a voice ID that speaks Hindi with the desired accent.
    # The voice IDs below are placeholders.
    ("Hindi", "Standard"): "zrHiDhphv9ZnVXBqCLjz",
    ("Hindi", "Bihari"): "zrHiDhphv9ZnVXBqCLjz",
    ("Hindi", "Bhojpuri"): "zrHiDhphv9ZnVXBqCLjz",
    ("Hindi", "Haryanvi"): "zrHiDhphv9ZnVXBqCLjz",

    # Filipino Languages - Similar to Hindi, check ElevenLabs model and voice capabilities.
    # These might require specific voice IDs from a multilingual model that supports these languages/accents.
    ("Filipino", "Standard"): "zrHiDhphv9ZnVXBqCLjz", # (e.g. Tagalog)
    ("Filipino", "Ilocano"): "zrHiDhphv9ZnVXBqCLjz",
    ("Filipino", "Cebuano"): "zrHiDhphv9ZnVXBqCLjz",
}


CARTESIA_VOICE_MAPPING: Dict[Tuple[str, str], str] = {
    # English
    ("English", "American"): "79a125e8-cd45-4c13-8a67-188112f4dd22", # e.g., a typical American voice
    ("English", "British"): "4f7f1324-1853-48a6-b294-4e78e8036a83", # Existing "Female" - verify accent, maybe Rachel from EL
    ("English", "Indian"): "f6141af3-5f94-418c-80ed-a45d450e7e2e",   # e.g., a voice with an Indian English accent

}


DEFAULT_CARTESIA_VOICE_ID: str = "4f7f1324-1853-48a6-b294-4e78e8036a83" # Default to the existing Female voice 

# Default voice if a specific mapping is not found
DEFAULT_ELEVENLABS_VOICE_ID: str = "zrHiDhphv9ZnVXBqCLjz" # Default to the existing Female voice 