from sqlalchemy import create_engine, Column, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from voxhog.api.config import settings

# Create database engine
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define API Key model
class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(String, primary_key=True)
    service = Column(String, index=True)
    key = Column(String)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    
    def to_dict(self):
        return {
            "id": self.id,
            "service": self.service,
            "key": self.key,
            "description": self.description,
            "created_at": self.created_at
        }

# Create tables
def init_db():
    Base.metadata.create_all(bind=engine)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 