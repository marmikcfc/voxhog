from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import os
import logging
from datetime import datetime, timedelta
from config import settings
import json
from pathlib import Path as PathLib

# Suppress the bcrypt warning
import warnings
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

from sqlalchemy.orm import Session
from database import AgentDB, TestCaseDB, TestRunDB, get_db, ApiKey, User as DBUser
from passlib.context import CryptContext
from jose import JWTError, jwt

# Import VoxHog components
from voxhog import VoiceTestRunner, TestCase, UserPersona, Scenario, VoiceAgent
from voxhog.voice_agent import Direction
from voxhog.voice_agent_evaluation import VoiceAgentEvaluator, VoiceAgentMetric

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VoxHog API",
    description="API for managing and running voice agent tests",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 setup (simplified - use a proper auth system in production)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# In-memory storage (replace with database in production)
agents = {}
test_cases = {}
test_runs = {}
metrics = {}
users = {"admin": {"username": "admin", "password": "password"}}  # Replace with proper auth
api_keys = {}

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    email: str
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None

class User(UserBase):
    id: str

class VoiceAgentBase(BaseModel):
    agent_id: str
    agent_type: str
    connection_details: Dict[str, Any]
    direction: str

class VoiceAgentCreate(VoiceAgentBase):
    pass

class VoiceAgentResponse(VoiceAgentBase):
    id: str
    created_at: datetime

class PersonaUpdate(BaseModel):
    persona: str
    scenario: str

class UserPersonaBase(BaseModel):
    name: str
    prompt: str

class ScenarioBase(BaseModel):
    name: str
    prompt: str

class MetricBase(BaseModel):
    name: str
    prompt: str

class TestCaseBase(BaseModel):
    name: str
    user_persona: UserPersonaBase
    scenario: ScenarioBase
    evaluator_metrics: Optional[List[str]] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: str
    created_at: datetime

class TestRunBase(BaseModel):
    agent_id: str
    test_case_ids: List[str]
    time_limit: Optional[int] = 60

class TestRunCreate(TestRunBase):
    pass

class TestRunResponse(TestRunBase):
    id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    results: Optional[Dict[str, Any]] = None

class ApiKeyBase(BaseModel):
    service: str
    key: str
    description: Optional[str] = None

class ApiKeyCreate(ApiKeyBase):
    pass

class ApiKeyResponse(ApiKeyBase):
    id: str
    created_at: datetime
    key: str = "********"

class ApiKeyFullResponse(ApiKeyBase):
    id: str
    created_at: datetime

# Authentication endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Find user in database
    user = db.query(DBUser).filter(DBUser.username == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Add these functions for JWT token handling
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user is None:
        raise credentials_exception
    return user.to_dict()

# Agent endpoints
@app.post("/api/v1/agents", response_model=VoiceAgentResponse)
async def create_agent(agent: VoiceAgentCreate, current_user: User = Depends(get_current_user)):
    agent_id = str(uuid.uuid4())
    agent_data = agent.dict()
    agent_data["id"] = agent_id
    agent_data["created_at"] = datetime.now()
    agents[agent_id] = agent_data
    return agent_data

@app.get("/api/v1/agents", response_model=List[VoiceAgentResponse])
async def list_agents(current_user: User = Depends(get_current_user)):
    return list(agents.values())

@app.get("/api/v1/agents/{agent_id}", response_model=VoiceAgentResponse)
async def get_agent(agent_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agents[agent_id]

@app.put("/api/v1/agents/{agent_id}", response_model=VoiceAgentResponse)
async def update_agent(
    agent: VoiceAgentCreate, 
    agent_id: str = Path(...), 
    current_user: User = Depends(get_current_user)
):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent_data = agent.dict()
    agent_data["id"] = agent_id
    agent_data["created_at"] = agents[agent_id]["created_at"]
    agents[agent_id] = agent_data
    return agent_data

@app.delete("/api/v1/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    del agents[agent_id]
    return None

@app.post("/api/v1/agents/{agent_id}/persona", response_model=VoiceAgentResponse)
async def set_agent_persona(
    persona_data: PersonaUpdate,
    agent_id: str = Path(...),
    current_user: User = Depends(get_current_user)
):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agents[agent_id]["persona"] = persona_data.persona
    agents[agent_id]["scenario"] = persona_data.scenario
    return agents[agent_id]

# Test case endpoints
@app.post("/api/v1/test-cases", response_model=TestCaseResponse)
async def create_test_case(test_case: TestCaseCreate, current_user: User = Depends(get_current_user)):
    test_id = str(uuid.uuid4())
    test_data = test_case.dict()
    test_data["id"] = test_id
    test_data["created_at"] = datetime.now()
    test_cases[test_id] = test_data
    return test_data

@app.get("/api/v1/test-cases", response_model=List[TestCaseResponse])
async def list_test_cases(current_user: User = Depends(get_current_user)):
    return list(test_cases.values())

@app.get("/api/v1/test-cases/{test_id}", response_model=TestCaseResponse)
async def get_test_case(test_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if test_id not in test_cases:
        raise HTTPException(status_code=404, detail="Test case not found")
    return test_cases[test_id]

@app.put("/api/v1/test-cases/{test_id}", response_model=TestCaseResponse)
async def update_test_case(
    test_case: TestCaseCreate, 
    test_id: str = Path(...), 
    current_user: User = Depends(get_current_user)
):
    if test_id not in test_cases:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    test_data = test_case.dict()
    test_data["id"] = test_id
    test_data["created_at"] = test_cases[test_id]["created_at"]
    test_cases[test_id] = test_data
    return test_data

@app.delete("/api/v1/test-cases/{test_id}", status_code=204)
async def delete_test_case(test_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if test_id not in test_cases:
        raise HTTPException(status_code=404, detail="Test case not found")
    del test_cases[test_id]
    return None

# Metrics endpoints
@app.post("/api/v1/metrics", response_model=MetricBase)
async def create_metric(metric: MetricBase, current_user: User = Depends(get_current_user)):
    metric_id = str(uuid.uuid4())
    metric_data = metric.dict()
    metric_data["id"] = metric_id
    metrics[metric_id] = metric_data
    return metric_data

@app.get("/api/v1/metrics", response_model=List[MetricBase])
async def list_metrics(current_user: User = Depends(get_current_user)):
    return list(metrics.values())

# Test run endpoints
async def run_test(run_id: str, agent_id: str, test_case_ids: List[str], time_limit: int):
    try:
        # Update status to running
        test_runs[run_id]["status"] = "running"
        
        # Get agent configuration
        agent_config = agents.get(agent_id)
        if not agent_config:
            test_runs[run_id]["status"] = "failed"
            test_runs[run_id]["error"] = "Agent not found"
            return
        
        # Create VoiceAgent instance
        agent = VoiceAgent(
            agent_id=agent_config["agent_id"],
            agent_type=agent_config["agent_type"],
            connection_details=agent_config["connection_details"],
            direction=Direction.INBOUND if agent_config["direction"] == "INBOUND" else Direction.OUTBOUND
        )
        
        # Set persona if available
        if "persona" in agent_config and "scenario" in agent_config:
            agent.set_persona_and_scenario(
                persona=agent_config["persona"],
                scenario=agent_config["scenario"]
            )
        
        # Create test cases
        test_runner = VoiceTestRunner(agent=agent)
        for test_id in test_case_ids:
            test_config = test_cases.get(test_id)
            if not test_config:
                continue
                
            # Create user persona
            user_persona = UserPersona(
                name=test_config["user_persona"]["name"],
                prompt=test_config["user_persona"]["prompt"]
            )
            
            # Create scenario
            scenario = Scenario(
                name=test_config["scenario"]["name"],
                prompt=test_config["scenario"]["prompt"]
            )
            
            # Create evaluator if metrics specified
            evaluator = None
            if test_config.get("evaluator_metrics"):
                evaluator = VoiceAgentEvaluator(model="gpt-4o-mini")
                for metric_id in test_config["evaluator_metrics"]:
                    if metric_id in metrics:
                        evaluator.add_metric(VoiceAgentMetric(
                            name=metrics[metric_id]["name"],
                            prompt=metrics[metric_id]["prompt"]
                        ))
            
            # Create test case
            test_case = TestCase(
                name=test_config["name"],
                scenario=scenario,
                user_persona=user_persona,
                evaluator=evaluator
            )
            
            # Add test case to runner
            test_runner.add_test_case(test_case)
        
        # Run tests
        import asyncio
        await test_runner.run_all_tests(time_limit=time_limit)
        
        # Update test run with results
        test_runs[run_id]["status"] = "completed"
        test_runs[run_id]["completed_at"] = datetime.now()
        test_runs[run_id]["results"] = {
            "transcript": agent.get_transcript(),
            "metrics": test_runner.get_metrics() if hasattr(test_runner, "get_metrics") else {}
        }
        
    except Exception as e:
        logger.error(f"Error running test: {str(e)}")
        test_runs[run_id]["status"] = "failed"
        test_runs[run_id]["error"] = str(e)
        test_runs[run_id]["completed_at"] = datetime.now()

@app.post("/api/v1/test-runs", response_model=TestRunResponse)
async def create_test_run(
    test_run: TestRunCreate, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Validate agent exists
    if test_run.agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Validate test cases exist
    for test_id in test_run.test_case_ids:
        if test_id not in test_cases:
            raise HTTPException(status_code=404, detail=f"Test case {test_id} not found")
    
    run_id = str(uuid.uuid4())
    run_data = test_run.dict()
    run_data["id"] = run_id
    run_data["status"] = "pending"
    run_data["started_at"] = datetime.now()
    test_runs[run_id] = run_data
    
    # Start test in background
    background_tasks.add_task(
        run_test, 
        run_id=run_id, 
        agent_id=test_run.agent_id, 
        test_case_ids=test_run.test_case_ids,
        time_limit=test_run.time_limit or 60
    )
    
    return run_data

@app.get("/api/v1/test-runs", response_model=List[TestRunResponse])
async def list_test_runs(current_user: User = Depends(get_current_user)):
    return list(test_runs.values())

@app.get("/api/v1/test-runs/{run_id}", response_model=TestRunResponse)
async def get_test_run(run_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_runs[run_id]

@app.delete("/api/v1/test-runs/{run_id}", status_code=204)
async def cancel_test_run(run_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    # Only cancel if not completed
    if test_runs[run_id]["status"] in ["pending", "running"]:
        test_runs[run_id]["status"] = "cancelled"
        test_runs[run_id]["completed_at"] = datetime.now()
    
    return None

@app.get("/api/v1/test-runs/{run_id}/transcript")
async def get_test_transcript(run_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    if test_runs[run_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Test run not completed")
    
    if "results" not in test_runs[run_id] or "transcript" not in test_runs[run_id]["results"]:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    return test_runs[run_id]["results"]["transcript"]

# API Keys endpoints
@app.post("/api/v1/keys", response_model=ApiKeyResponse)
async def create_api_key(
    api_key: ApiKeyCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    key_id = str(uuid.uuid4())
    
    # Create database record
    db_key = ApiKey(
        id=key_id,
        service=api_key.service,
        key=api_key.key,
        description=api_key.description
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)
    
    # Update environment variables in memory
    if api_key.service.upper() == "OPENAI":
        os.environ["OPENAI_API_KEY"] = api_key.key
    elif api_key.service.upper() == "TWILIO":
        if ":" in api_key.key:  # Format: SID:AUTH_TOKEN
            sid, token = api_key.key.split(":", 1)
            os.environ["TWILIO_ACCOUNT_SID"] = sid
            os.environ["TWILIO_AUTH_TOKEN"] = token
    elif api_key.service.upper() == "VAPI":
        os.environ["VAPI_API_KEY"] = api_key.key
    
    return db_key.to_dict()

@app.get("/api/v1/keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    keys = db.query(ApiKey).all()
    return [key.to_dict() for key in keys]

@app.get("/api/v1/keys/{key_id}", response_model=ApiKeyFullResponse)
async def get_api_key(
    key_id: str = Path(...), 
    show_key: bool = Query(False, description="Whether to show the actual key"),
    current_user: User = Depends(get_current_user)
):
    if key_id not in api_keys:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Only return the full key if explicitly requested
    if show_key:
        return api_keys[key_id]
    else:
        # Return masked key
        response = dict(api_keys[key_id])
        response["key"] = "********"
        return response

@app.delete("/api/v1/keys/{key_id}", status_code=204)
async def delete_api_key(key_id: str = Path(...), current_user: User = Depends(get_current_user)):
    if key_id not in api_keys:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Remove from memory
    service = api_keys[key_id]["service"].upper()
    del api_keys[key_id]
    
    # Update credentials file
    try:
        creds_file = PathLib("./credentials/api_keys.json")
        if creds_file.exists():
            with open(creds_file, "r") as f:
                existing_keys = json.load(f)
            
            if key_id in existing_keys:
                del existing_keys[key_id]
                
                with open(creds_file, "w") as f:
                    json.dump(existing_keys, f, indent=2)
    except Exception as e:
        logger.error(f"Error deleting API key from file: {str(e)}")
    
    return None

# Add this function to load API keys at startup
@app.on_event("startup")
async def load_api_keys():
    try:
        creds_file = PathLib("./credentials/api_keys.json")
        if creds_file.exists():
            with open(creds_file, "r") as f:
                stored_keys = json.load(f)
            
            for key_id, key_data in stored_keys.items():
                # Convert string date back to datetime
                if "created_at" in key_data and isinstance(key_data["created_at"], str):
                    key_data["created_at"] = datetime.fromisoformat(key_data["created_at"])
                else:
                    key_data["created_at"] = datetime.now()
                
                # Add to in-memory store
                api_keys[key_id] = key_data
                
                # Set environment variables
                service = key_data["service"].upper()
                if service == "OPENAI":
                    os.environ["OPENAI_API_KEY"] = key_data["key"]
                elif service == "TWILIO":
                    if ":" in key_data["key"]:  # Format: SID:AUTH_TOKEN
                        sid, token = key_data["key"].split(":", 1)
                        os.environ["TWILIO_ACCOUNT_SID"] = sid
                        os.environ["TWILIO_AUTH_TOKEN"] = token
                elif service == "VAPI":
                    os.environ["VAPI_API_KEY"] = key_data["key"]
                
            logger.info(f"Loaded {len(stored_keys)} API keys from storage")
    except Exception as e:
        logger.error(f"Error loading API keys: {str(e)}")

# Add a health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": app.version,
        "api_keys_configured": {
            "openai": "OPENAI_API_KEY" in os.environ and bool(os.environ["OPENAI_API_KEY"]),
            "twilio": "TWILIO_ACCOUNT_SID" in os.environ and bool(os.environ["TWILIO_ACCOUNT_SID"]),
            "vapi": "VAPI_API_KEY" in os.environ and bool(os.environ["VAPI_API_KEY"])
        }
    }

# Add a configuration endpoint to check and update configuration
@app.get("/api/v1/config")
async def get_config(current_user: User = Depends(get_current_user)):
    return {
        "app_name": settings.app_name,
        "debug_mode": settings.debug,
        "api_keys_configured": {
            "openai": "OPENAI_API_KEY" in os.environ and bool(os.environ["OPENAI_API_KEY"]),
            "twilio": "TWILIO_ACCOUNT_SID" in os.environ and bool(os.environ["TWILIO_ACCOUNT_SID"]),
            "vapi": "VAPI_API_KEY" in os.environ and bool(os.environ["VAPI_API_KEY"])
        }
    }

# Add these to the startup event
@app.on_event("startup")
async def startup_event():
    # Initialize database
    from database import init_db, User as DBUser  # Import the SQLAlchemy User model with an alias
    init_db()
    
    # Create default admin if no users exist
    db = next(get_db())
    if db.query(DBUser).count() == 0:  # Use the SQLAlchemy User model here
        admin_password = os.getenv("ADMIN_PASSWORD", "admin")
        hashed_password = pwd_context.hash(admin_password)
        
        admin_user = DBUser(  # Use the SQLAlchemy User model here
            id=str(uuid.uuid4()),
            username="admin",
            email="admin@example.com",
            hashed_password=hashed_password,
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        logger.info("Created default admin user")
    
    # Load existing API keys
    await load_api_keys()

# Update User models
class UserInDB(UserBase):
    id: str
    hashed_password: str
    email: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime

# Add User database model in database.py
"""
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "created_at": self.created_at
        }
"""

# User management endpoints
@app.post("/api/v1/users", response_model=User)
async def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    # Check if username already exists
    db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = pwd_context.hash(user.password)
    
    # First user gets admin privileges, others are regular users
    is_admin = db.query(DBUser).count() == 0
    
    db_user = DBUser(
        id=user_id,
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_admin=is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user.to_dict()

@app.get("/api/v1/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/api/v1/users/me", response_model=User)
async def update_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get user from database
    db_user = db.query(DBUser).filter(DBUser.id == current_user["id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if user_update.email is not None:
        db_user.email = user_update.email
    
    if user_update.password is not None:
        db_user.hashed_password = pwd_context.hash(user_update.password)
    
    db.commit()
    db.refresh(db_user)
    
    return db_user.to_dict()

# Test case management with user association
@app.post("/api/v1/test-cases", response_model=TestCaseResponse)
async def create_test_case(
    test_case: TestCaseCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    test_id = str(uuid.uuid4())
    
    # Create database record
    db_test_case = TestCaseDB(
        id=test_id,
        name=test_case.name,
        user_id=current_user["id"],
        user_persona=test_case.user_persona.dict(),
        scenario=test_case.scenario.dict(),
        evaluator_metrics=test_case.evaluator_metrics
    )
    db.add(db_test_case)
    db.commit()
    db.refresh(db_test_case)
    
    return db_test_case.to_dict()

@app.get("/api/v1/test-cases", response_model=List[TestCaseResponse])
async def list_test_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    shared: bool = Query(False, description="Include test cases shared with all users")
):
    # Get user's test cases
    query = db.query(TestCaseDB).filter(TestCaseDB.user_id == current_user["id"])
    
    # Include shared test cases if requested
    if shared:
        query = query.union(db.query(TestCaseDB).filter(TestCaseDB.is_shared == True))
    
    test_cases = query.all()
    return [tc.to_dict() for tc in test_cases]

# Test run with user association
@app.post("/api/v1/test-runs", response_model=TestRunResponse)
async def create_test_run(
    test_run: TestRunCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate agent exists
    agent = db.query(AgentDB).filter(AgentDB.id == test_run.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Validate test cases exist and user has access
    for test_id in test_run.test_case_ids:
        test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
        if not test_case:
            raise HTTPException(status_code=404, detail=f"Test case {test_id} not found")
        
        # Check if user has access to this test case
        if test_case.user_id != current_user["id"] and not test_case.is_shared:
            raise HTTPException(
                status_code=403, 
                detail=f"Not authorized to use test case {test_id}"
            )
    
    # Create test run
    run_id = str(uuid.uuid4())
    db_test_run = TestRunDB(
        id=run_id,
        user_id=current_user["id"],
        agent_id=test_run.agent_id,
        test_case_ids=test_run.test_case_ids,
        time_limit=test_run.time_limit or 60,
        status="pending",
        started_at=datetime.now()
    )
    db.add(db_test_run)
    db.commit()
    
    # Start test in background
    background_tasks.add_task(
        run_test, 
        run_id=run_id,
        db=db
    )
    
    return db_test_run.to_dict()

@app.get("/api/v1/test-runs", response_model=List[TestRunResponse])
async def list_test_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    # Get user's test runs
    test_runs = db.query(TestRunDB).filter(
        TestRunDB.user_id == current_user["id"]
    ).order_by(
        TestRunDB.started_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [tr.to_dict() for tr in test_runs]

# Add sharing functionality for test cases
@app.post("/api/v1/test-cases/{test_id}/share", response_model=TestCaseResponse)
async def share_test_case(
    test_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get test case
    test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Check if user owns this test case
    if test_case.user_id != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to share this test case"
        )
    
    # Update sharing status
    test_case.is_shared = True
    db.commit()
    db.refresh(test_case)
    
    return test_case.to_dict()

@app.post("/api/v1/test-cases/{test_id}/unshare", response_model=TestCaseResponse)
async def unshare_test_case(
    test_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get test case
    test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Check if user owns this test case
    if test_case.user_id != current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to unshare this test case"
        )
    
    # Update sharing status
    test_case.is_shared = False
    db.commit()
    db.refresh(test_case)
    
    return test_case.to_dict()

# Add this new endpoint for self-registration
@app.post("/api/v1/register", response_model=Token)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = pwd_context.hash(user.password)
    
    # First user gets admin privileges, others are regular users
    is_admin = db.query(DBUser).count() == 0
    
    db_user = DBUser(
        id=user_id,
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_admin=is_admin
    )
    db.add(db_user)
    db.commit()
    
    # Generate token for immediate login
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Add this with your other initializations (before using it)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 