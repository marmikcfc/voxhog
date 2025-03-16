import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path

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
    
    # Add this method to the Settings class
    def ensure_credentials_dir(self):
        """Ensure the credentials directory exists"""
        self.credentials_dir.mkdir(exist_ok=True)
        return self.credentials_dir

settings = Settings()

# Ensure credentials directory exists
settings.ensure_credentials_dir() 