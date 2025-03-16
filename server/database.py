from sqlalchemy import create_engine, Column, String, DateTime, Text, Boolean, JSON, ForeignKey, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import settings

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

# Add these models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    agents = relationship("AgentDB", back_populates="user")
    test_cases = relationship("TestCaseDB", back_populates="user")
    test_runs = relationship("TestRunDB", back_populates="user")
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "created_at": self.created_at
        }

class AgentDB(Base):
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True)
    agent_id = Column(String, index=True)
    agent_type = Column(String)
    connection_details = Column(JSON)
    direction = Column(String)
    persona = Column(Text, nullable=True)
    scenario = Column(Text, nullable=True)
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    user = relationship("User", back_populates="agents")
    test_runs = relationship("TestRunDB", back_populates="agent")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "connection_details": self.connection_details,
            "direction": self.direction,
            "persona": self.persona,
            "scenario": self.scenario,
            "user_id": self.user_id,
            "created_at": self.created_at
        }

class TestCaseDB(Base):
    __tablename__ = "test_cases"
    
    id = Column(String, primary_key=True)
    name = Column(String)
    user_id = Column(String, ForeignKey("users.id"))
    user_persona = Column(JSON)
    scenario = Column(JSON)
    evaluator_metrics = Column(JSON, nullable=True)
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    user = relationship("User", back_populates="test_cases")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "user_id": self.user_id,
            "user_persona": self.user_persona,
            "scenario": self.scenario,
            "evaluator_metrics": self.evaluator_metrics,
            "is_shared": self.is_shared,
            "created_at": self.created_at
        }

class TestRunDB(Base):
    __tablename__ = "test_runs"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    agent_id = Column(String, ForeignKey("agents.id"))
    test_case_ids = Column(JSON)  # List of test case IDs
    time_limit = Column(Integer, default=60)
    outbound_call_params = Column(JSON, nullable=True)  # Parameters for outbound calls
    status = Column(String)  # pending, running, completed, failed, cancelled
    started_at = Column(DateTime)
    completed_at = Column(DateTime, nullable=True)
    results = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="test_runs")
    agent = relationship("AgentDB", back_populates="test_runs")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "test_case_ids": self.test_case_ids,
            "time_limit": self.time_limit,
            "outbound_call_params": self.outbound_call_params,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "results": self.results,
            "error": self.error
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