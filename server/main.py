import random
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query, Path, Body, Request, Security
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
from fastapi.responses import FileResponse

# Suppress the bcrypt warning
import warnings
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

from sqlalchemy.orm import Session
from database import AgentDB, TestCaseDB, TestRunDB, get_db, ApiKey, User as DBUser, MetricDB, EvaluationDB
from passlib.context import CryptContext
from jose import JWTError, jwt

# Import VoxHog components
from voxhog import VoiceTestRunner, TestCase, UserPersona, Scenario, VoiceAgent
from voxhog.voice_agent import Direction
from voxhog.voice_agent_evaluation import VoiceAgentEvaluator, VoiceAgentMetric
from transcriber import Transcriber

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VoxHog API",
    description="API for managing and running voice agent tests",
    version="1.0.0"
)

# Create reports directory if it doesn't exist
reports_dir = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(reports_dir, exist_ok=True)

# Create recordings directory if it doesn't exist
recordings_dir = os.path.join(os.path.dirname(__file__), "recordings")
os.makedirs(recordings_dir, exist_ok=True)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# OAuth2 setup (simplified - use a proper auth system in production)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# In-memory storage (replace with database in production)
agents = {}
test_cases = {}
test_runs = {}
metrics = {}
evaluations: Dict[str, Dict[str, Any]] = {}
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
    language: Optional[str] = None
    accent: Optional[str] = None

class ScenarioBase(BaseModel):
    name: str
    prompt: str

class MetricBase(BaseModel):
    id: Optional[str] = None
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
    outbound_call_params: Optional[Dict[str, Any]] = None

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

# Evaluation Schemas
class EvaluationBase(BaseModel):
    metric_ids: List[str]

class EvaluationCreate(EvaluationBase):
    # For now, no additional fields beyond base for creation via form
    # The file itself will be handled as UploadFile in the endpoint
    pass

class EvaluationUpdate(BaseModel):
    status: Optional[str] = None
    transcript: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None

class EvaluationResponse(EvaluationBase):
    id: str
    user_id: str # Assuming user_id should be part of the response
    recording_filename: str
    status: str
    transcript: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        orm_mode = True

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
async def create_agent(
    agent: VoiceAgentCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent_id_uuid = str(uuid.uuid4())
    # Save to database
    db_agent = AgentDB(
        id=agent_id_uuid,
        agent_id=agent.agent_id,
        agent_type=agent.agent_type,
        connection_details=agent.connection_details,
        direction=agent.direction,
        user_id=current_user["id"],
        created_at=datetime.now() 
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    
    # Save to in-memory dictionary (ensure all fields, including new ones, are present)
    agent_data = db_agent.to_dict() # Use to_dict to ensure consistency
    agents[agent_id_uuid] = agent_data
    
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if agent exists in database
    db_agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found in database")
    
    # Check ownership
    if db_agent.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this agent")

    # Update database record
    db_agent.agent_id = agent.agent_id
    db_agent.agent_type = agent.agent_type
    db_agent.connection_details = agent.connection_details
    db_agent.direction = agent.direction
    # Preserve persona and scenario if they exist and are not in agent model
    if hasattr(agent, 'persona') and agent.persona is not None:
        db_agent.persona = agent.persona
    if hasattr(agent, 'scenario') and agent.scenario is not None:
        db_agent.scenario = agent.scenario

    db.commit()
    db.refresh(db_agent)
    
    # Update in-memory dictionary (ensure all fields are present)
    updated_agent_data = db_agent.to_dict() # Use to_dict for consistency

    # Preserve persona and scenario in memory if not part of VoiceAgentCreate schema directly but were set by set_agent_persona
    # However, db_agent.to_dict() should now include persona and scenario from DB if they were set.
    # If VoiceAgentCreate might not include them, we ensure they are not lost from memory if previously set.
    if "persona" in agents.get(agent_id, {}) and updated_agent_data.get("persona") is None:
        updated_agent_data["persona"] = agents[agent_id]["persona"]
    if "scenario" in agents.get(agent_id, {}) and updated_agent_data.get("scenario") is None:
        updated_agent_data["scenario"] = agents[agent_id]["scenario"]

    agents[agent_id] = updated_agent_data
    
    return updated_agent_data

@app.delete("/api/v1/agents/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if agent exists in memory
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if agent exists in database
    db_agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if db_agent:
        db.delete(db_agent)
        db.commit()
    
    # Delete from in-memory dictionary
    del agents[agent_id]
    return None

@app.post("/api/v1/agents/{agent_id}/persona", response_model=VoiceAgentResponse)
async def set_agent_persona(
    persona_data: PersonaUpdate,
    agent_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if agent exists in memory
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if agent exists in database
    db_agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found in database")
    
    # Update database record
    db_agent.persona = persona_data.persona
    db_agent.scenario = persona_data.scenario
    db.commit()
    
    # Update in-memory dictionary
    agents[agent_id]["persona"] = persona_data.persona
    agents[agent_id]["scenario"] = persona_data.scenario
    
    return agents[agent_id]

# Test case endpoints
@app.post("/api/v1/test-cases", response_model=TestCaseResponse)
async def create_test_case(
    test_case: TestCaseCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    test_id = str(uuid.uuid4())
    
    # Log the evaluator_metrics before creating
    logger.info(f"Creating test case with evaluator_metrics: {test_case.evaluator_metrics}")
    
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
    
    # Save to in-memory dictionary
    test_data = test_case.dict()
    test_data["id"] = test_id
    test_data["created_at"] = datetime.now()
    test_cases[test_id] = test_data
    
    # Log the created test case
    logger.info(f"Created test case: {db_test_case.to_dict()}")
    
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
    
    test_cases_db = query.all()
    return [tc.to_dict() for tc in test_cases_db]

@app.get("/api/v1/test-cases/{test_id}", response_model=TestCaseResponse)
async def get_test_case(
    test_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get test case from database
    test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Check if user has access to this test case
    if test_case.user_id != current_user["id"] and not test_case.is_shared:
        raise HTTPException(status_code=403, detail="Not authorized to view this test case")
    
    return test_case.to_dict()

@app.put("/api/v1/test-cases/{test_id}", response_model=TestCaseResponse)
async def update_test_case(
    test_case: TestCaseCreate, 
    test_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if test case exists in memory
    if test_id not in test_cases:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Check if test case exists in database
    db_test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
    if not db_test_case:
        raise HTTPException(status_code=404, detail="Test case not found in database")
    
    # Check if user owns the test case
    if db_test_case.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this test case")
    
    # Update database record
    db_test_case.name = test_case.name
    db_test_case.user_persona = test_case.user_persona.dict()
    db_test_case.scenario = test_case.scenario.dict()
    
    # Log the evaluator_metrics before updating
    logger.info(f"Updating test case {test_id} with evaluator_metrics: {test_case.evaluator_metrics}")
    
    # Ensure evaluator_metrics is properly set
    db_test_case.evaluator_metrics = test_case.evaluator_metrics
    db.commit()
    db.refresh(db_test_case)
    
    # Update in-memory dictionary
    test_data = test_case.dict()
    test_data["id"] = test_id
    test_data["created_at"] = test_cases[test_id]["created_at"]
    test_cases[test_id] = test_data
    
    # Log the updated test case
    logger.info(f"Updated test case: {db_test_case.to_dict()}")
    
    return db_test_case.to_dict()

@app.delete("/api/v1/test-cases/{test_id}", status_code=204)
async def delete_test_case(
    test_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if test case exists in memory
    if test_id not in test_cases:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Check if test case exists in database
    db_test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
    if not db_test_case:
        raise HTTPException(status_code=404, detail="Test case not found in database")
    
    # Check if user owns the test case
    if db_test_case.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this test case")
    
    # Delete from database
    db.delete(db_test_case)
    db.commit()
    
    # Delete from in-memory dictionary
    del test_cases[test_id]
    return None

# Metrics endpoints
@app.post("/api/v1/metrics", response_model=MetricBase)
async def create_metric(metric: MetricBase, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    metric_id = str(uuid.uuid4())
    
    # Create database record
    db_metric = MetricDB(
        id=metric_id,
        name=metric.name,
        prompt=metric.prompt,
        user_id=current_user["id"]
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    
    # Save to in-memory dictionary
    metric_data = metric.dict()
    metric_data["id"] = metric_id
    metrics[metric_id] = metric_data
    
    return db_metric.to_dict()

@app.get("/api/v1/metrics", response_model=List[MetricBase])
async def list_metrics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get metrics from database
    logger.info(f"Fetching metrics for user: {current_user['username']}")
    db_metrics = db.query(MetricDB).all()
    logger.info(f"Found {len(db_metrics)} metrics in database")
    
    # Log the metrics for debugging
    metrics_list = [metric.to_dict() for metric in db_metrics]
    logger.info(f"Returning metrics: {metrics_list}")
    
    return metrics_list

# Test run endpoints
async def run_test(run_id: str, agent_id_from_run: str, test_case_ids: List[str], time_limit: int):
    logger.info(f"run_test started for run_id: {run_id} with test_case_ids: {test_case_ids}")
    db: Optional[Session] = None
    try:
        # Get database session
        db = next(get_db())
        
        # Get test run from database
        db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
        if not db_test_run:
            logger.error(f"Test run {run_id} not found in database")
            return
        
        db_test_run.status = "running"
        db.commit()
        
        # Get base agent configuration from DB
        db_agent_config_from_db = db.query(AgentDB).filter(AgentDB.id == agent_id_from_run).first()
        if not db_agent_config_from_db:
            db_test_run.status = "failed"
            db_test_run.error = "Agent not found"
            db_test_run.completed_at = datetime.now()
            db.commit()
            return
        
        agent_base_config_dict = db_agent_config_from_db.to_dict()

        all_results_transcripts = []
        all_results_metrics = {}
        final_status = "completed"
        final_error = None

        logger.info(f"Starting loop for test_case_ids in run_id: {run_id}. Number of test cases: {len(test_case_ids)}")
        for test_id in test_case_ids:
            logger.info(f"Processing test_id: {test_id} in run_id: {run_id}")
            try:
                # Fetch TestCaseDB for its user_persona's lang/accent and prompts
                db_test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
                if not db_test_case:
                    logger.warning(f"Test case {test_id} not found for run {run_id}, skipping.")
                    # Potentially log this as a partial failure for the test run
                    continue

                user_persona_data = db_test_case.user_persona # This is JSON from DB
                tc_language = user_persona_data.get("language")
                tc_accent = user_persona_data.get("accent")
                user_persona_name = user_persona_data.get("name", "Default Persona Name")
                user_persona_prompt = user_persona_data.get("prompt", "")

                scenario_data = db_test_case.scenario # This is JSON from DB
                scenario_name = scenario_data.get("name", "Default Scenario Name")
                scenario_prompt = scenario_data.get("prompt", "")

                # Instantiate VoiceAgent for this specific test case's voice
                # Agent's own persona/scenario (if set) are part of agent_base_config_dict
                audio_file_name_for_tc = f"run_{run_id}_test_{test_id}_test_case_{random.randint(1, 1000000)}"
                logger.info(f"Initializing VoiceAgent for test_id: {test_id} in run_id: {run_id}")
                current_agent_for_tc = VoiceAgent(
                    agent_id=agent_base_config_dict["agent_id"],
                    agent_type=agent_base_config_dict["agent_type"],
                    connection_details=agent_base_config_dict["connection_details"],
                    direction=Direction.INBOUND if agent_base_config_dict["direction"] == "INBOUND" else Direction.OUTBOUND,
                    voice_agent_api_args=db_test_run.outbound_call_params if agent_base_config_dict["direction"] == "OUTBOUND" else None,
                    language=tc_language, # From TestCase's UserPersona
                    accent=tc_accent,     # From TestCase's UserPersona
                    audio_file_name=audio_file_name_for_tc
                )
                logger.info(f"VoiceAgent initialized for test_id: {test_id} in run_id: {run_id}")
                
                # Set agent's persona/scenario if defined on the agent itself
                if agent_base_config_dict.get("persona") and agent_base_config_dict.get("scenario"):
                    current_agent_for_tc.set_persona_and_scenario(
                        persona=agent_base_config_dict["persona"],
                        scenario=agent_base_config_dict["scenario"]
                    )
                
                # Create UserPersona and Scenario objects for the TestCase
                user_persona_obj = UserPersona(
                    name=user_persona_name,
                    prompt=user_persona_prompt
                    # language and accent are now properties of UserPersonaBase Pydantic model,
                    # but UserPersona class from voxhog library might not yet use them.
                    # For now, TTS uses lang/accent passed to VoiceAgent constructor.
                )
                scenario_obj = Scenario(
                    name=scenario_name,
                    prompt=scenario_prompt
                )
                
                # Create evaluator if metrics specified for the test case
                evaluator = None
                if db_test_case.evaluator_metrics:
                    evaluator = VoiceAgentEvaluator(model="gpt-4o-mini") # Or from config
                    # Load metrics from in-memory 'metrics' dict (populated at startup)
                    for metric_id_from_tc in db_test_case.evaluator_metrics:
                        metric_config = metrics.get(metric_id_from_tc)
                        if metric_config:
                            evaluator.add_metric(VoiceAgentMetric(
                                name=metric_config["name"],
                                prompt=metric_config["prompt"]
                            ))
                        else:
                            logger.warning(f"Metric with ID {metric_id_from_tc} for test case {test_id} not found in metrics dictionary.")
                
                test_case_obj = TestCase(
                    name=db_test_case.name,
                    scenario=scenario_obj,
                    user_persona=user_persona_obj,
                    evaluator=evaluator
                )
                
                single_test_runner = VoiceTestRunner(agent=current_agent_for_tc)
                single_test_runner.add_test_case(test_case_obj)
                
                logger.info(f"Running test case {test_id} for test run {run_id} with lang=\'{tc_language}\' accent=\'{tc_accent}\'")
                await single_test_runner.run_all_tests(time_limit=time_limit) # Runs one test
                logger.info(f"Finished single_test_runner.run_all_tests for test_id: {test_id} in run_id: {run_id}")
                
                # Aggregate results for this test case
                # The structure of results might need adjustment if VoiceTestRunner.get_metrics() is test-case specific
                # or if get_transcript is now per test case.
                # For now, assume get_transcript() is from the agent used for this test.
                logger.info(f"Getting transcript for test_id: {test_id} in run_id: {run_id}")
                tc_transcript = current_agent_for_tc.get_transcript()
                logger.info(f"Got transcript for test_id: {test_id} in run_id: {run_id}. Length: {len(tc_transcript) if tc_transcript else 'N/A'}")
                logger.info(f"Getting metrics for test_id: {test_id} in run_id: {run_id}")
                tc_metrics_results = single_test_runner.get_metrics() if hasattr(single_test_runner, "get_metrics") else {}
                logger.info(f"Got metrics for test_id: {test_id} in run_id: {run_id}. Metrics: {tc_metrics_results}")
                tc_audio_url = f"run_{run_id}_test_{test_id}.wav" # Assuming this path structure
                
                all_results_transcripts.append({test_id: tc_transcript})
                if tc_metrics_results: # Ensure metrics results are not empty
                     all_results_metrics[test_id] = tc_metrics_results
                # Store audio URL along with other results for this test case
                if test_id not in all_results_metrics:
                    all_results_metrics[test_id] = {}
                logger.info(f"Test case {test_id} audio URL: {tc_audio_url}")
                all_results_metrics[test_id]["audio_url"] = tc_audio_url

                # Save individual report (optional, if VoiceTestRunner still supports it for single runs)
                try:
                    report_dir = os.path.join("reports", agent_base_config_dict["id"], run_id) # Store under agent_id/run_id
                    os.makedirs(report_dir, exist_ok=True)
                    # Modified to include test_id in the report filename for uniqueness
                    report_path = os.path.join(report_dir, f"report_{test_id}.json") 
                    logger.info(f"Attempting to save report for test_id: {test_id} in run_id: {run_id} to {report_path}")
                    single_test_runner.save_report(report_path)
                    logger.info(f"Test case {test_id} report saved to {report_path}")
                except Exception as report_error:
                    logger.error(f"Error saving test case {test_id} report: {str(report_error)}", exc_info=True)
            except Exception as e_tc:
                logger.error(f"Error running test case {test_id} within test run {run_id}: {str(e_tc)}", exc_info=True)
                final_status = "failed" # If any test case fails, mark the whole run as failed
                final_error = final_error + f" TestCase {test_id} Error: {str(e_tc)};" if final_error else f"TestCase {test_id} Error: {str(e_tc)};"
                # Store error for this specific test case if results structure allows
                all_results_metrics[test_id] = {"error": str(e_tc)}
            logger.info(f"Finished processing test_id: {test_id} in run_id: {run_id}")
            # Cleanup VoiceTestRunner after each test case to free up resources like ngrok and server port
            if single_test_runner:
                logger.info(f"Cleaning up VoiceTestRunner for test_id: {test_id} in run_id: {run_id}")
                try:
                    single_test_runner.cleanup()
                    logger.info(f"VoiceTestRunner cleanup successful for test_id: {test_id} in run_id: {run_id}")
                except Exception as cleanup_error:
                    logger.error(f"Error during VoiceTestRunner cleanup for test_id: {test_id}: {cleanup_error}", exc_info=True)


        # Prepare final aggregated results for the TestRunDB
        final_results_payload = {
            "transcripts_per_test_case": all_results_transcripts,
            "metrics_per_test_case": all_results_metrics,
            "summary": f"Processed {len(test_case_ids)} test cases."
        }
        
        db_test_run.status = final_status
        db_test_run.completed_at = datetime.now()
        db_test_run.results = final_results_payload
        if final_error:
            db_test_run.error = final_error
        db.commit()
        logger.info(f"run_test completed for run_id: {run_id}. Final status: {final_status}")
        
    except Exception as e:
        logger.error(f"Critical error in run_test {run_id}: {str(e)}", exc_info=True)
        if db and db_test_run: # Check if db and db_test_run are available
            db_test_run.status = "failed"
            db_test_run.error = str(e)
            db_test_run.completed_at = datetime.now()
            db.commit()
    finally:
        if db:
            db.close()

async def run_evaluation(eval_id: str):
    logger.info(f"Starting evaluation for eval_id: {eval_id}")
    db: Session = next(get_db())
    
    try:
        db_eval = db.query(EvaluationDB).filter(EvaluationDB.id == eval_id).first()
        if not db_eval:
            logger.error(f"Evaluation {eval_id} not found in database.")
            return

        # Update status to running
        db_eval.status = "running"
        db.commit()
        logger.info(f"Evaluation {eval_id} status updated to 'running'.")

        recording_path = os.path.join("recordings", db_eval.recording_filename)
        logger.info(f"Recording path for {eval_id}: {recording_path}")

        # --- Transcription Step ---
        transcript_text: Optional[str] = None
        try:
            transcriber_instance = Transcriber()
            transcript_text = await transcriber_instance.transcribe(recording_path)
            logger.info(f"Transcription completed for {eval_id}. Transcript length: {len(transcript_text)}")
            db_eval.transcript = transcript_text
        except FileNotFoundError:
            logger.error(f"Recording file not found for {eval_id} at {recording_path}. Marking as failed.")
            db_eval.status = "failed"
            db_eval.error_message = f"Recording file not found: {recording_path}"
            db_eval.completed_at = datetime.utcnow()
            db.commit()
            return
        except Exception as transcription_error:
            logger.error(f"Transcription failed for {eval_id}: {str(transcription_error)}")
            db_eval.status = "failed"
            db_eval.error_message = f"Transcription failed: {str(transcription_error)}"
            db_eval.completed_at = datetime.utcnow()
            db.commit()
            return
        # --- End Transcription Step ---

        evaluator = VoiceAgentEvaluator(model="gpt-4o-mini") # As per plan
        
        # Fetch metric definitions and add to evaluator
        if db_eval.metric_ids:
            for metric_id in db_eval.metric_ids:
                # Try fetching from in-memory metrics dictionary first
                metric_config = metrics.get(metric_id)
                if not metric_config:
                    # Fallback to DB if not in memory (should ideally be loaded)
                    db_metric = db.query(MetricDB).filter(MetricDB.id == metric_id).first()
                    if db_metric:
                        metric_config = db_metric.to_dict()
                    else:
                        logger.warning(f"Metric ID {metric_id} not found for evaluation {eval_id}. Skipping.")
                        continue
                
                evaluator.add_metric(VoiceAgentMetric(name=metric_config["name"], prompt=metric_config["prompt"]))
            logger.info(f"Added {len(evaluator.metrics)} metrics to evaluator for {eval_id}.")
        else:
            logger.info(f"No metrics specified for evaluation {eval_id}.")

        evaluation_results_obj = None
        if evaluator.metrics and transcript_text: # Only evaluate if there are metrics and a transcript
            logger.info(f"Starting LLM-based evaluation for {eval_id}...")
            # Current VoiceAgentEvaluator.evaluate_voice_conversation expects a dict.
            # We will pass the transcript as part of this dict.
            conversation_data = {"transcript": transcript_text}
            evaluation_results_obj = await evaluator.evaluate_voice_conversation(conversation_data)
            db_eval.results = evaluation_results_obj.dict() if evaluation_results_obj else None
            logger.info(f"LLM-based evaluation completed for {eval_id}.")
        elif not transcript_text:
             logger.warning(f"Skipping LLM-based evaluation for {eval_id} as transcript is missing.")
        else: # No metrics
            logger.info(f"Skipping LLM-based evaluation for {eval_id} as no metrics were loaded/specified.")


        db_eval.status = "completed"
        db_eval.completed_at = datetime.utcnow()
        logger.info(f"Evaluation {eval_id} completed successfully.")

    except Exception as e:
        logger.error(f"Error during evaluation {eval_id}: {str(e)}", exc_info=True)
        if db_eval: # db_eval might not be set if the first query fails
            db_eval.status = "failed"
            db_eval.error_message = str(e)
            db_eval.completed_at = datetime.utcnow()
    finally:
        if db_eval: # Ensure commit if db_eval was fetched
            db.commit()
        db.close()
        logger.info(f"DB session closed for evaluation {eval_id}.")

@app.post("/api/v1/test-runs", response_model=TestRunResponse)
async def create_test_run(
    test_run: TestRunCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate agent exists in database
    agent = db.query(AgentDB).filter(AgentDB.id == test_run.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Filter out any None or empty values from test_case_ids
    valid_test_case_ids = [test_id for test_id in test_run.test_case_ids if test_id]
    
    if not valid_test_case_ids:
        raise HTTPException(status_code=400, detail="At least one valid test case ID is required")
    
    # Validate test cases exist and user has access
    for test_id in valid_test_case_ids:
        test_case = db.query(TestCaseDB).filter(TestCaseDB.id == test_id).first()
        if not test_case:
            raise HTTPException(status_code=404, detail=f"Test case {test_id} not found")
        
        # Check if user has access to this test case
        if test_case.user_id != current_user["id"] and not test_case.is_shared:
            raise HTTPException(
                status_code=403, 
                detail=f"Not authorized to use test case {test_id}"
            )
    
    # Create test run in database
    run_id = str(uuid.uuid4())
    db_test_run = TestRunDB(
        id=run_id,
        user_id=current_user["id"],
        agent_id=test_run.agent_id,
        test_case_ids=valid_test_case_ids,  # Use the filtered list
        time_limit=test_run.time_limit or 60,
        outbound_call_params=test_run.outbound_call_params,
        status="pending",
        started_at=datetime.now()
    )
    db.add(db_test_run)
    db.commit()
    
    # Save to in-memory dictionary
    run_data = test_run.dict()
    run_data["id"] = run_id
    run_data["status"] = "pending"
    run_data["started_at"] = db_test_run.started_at
    test_runs[run_id] = run_data
    
    # Start test in background
    background_tasks.add_task(
        run_test, 
        run_id=run_id, 
        agent_id_from_run=test_run.agent_id, # Renamed for clarity in run_test
        test_case_ids=valid_test_case_ids,
        time_limit=test_run.time_limit or 60
        # language and accent parameters removed from run_test call
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
    test_runs = db.query(TestRunDB).filter(TestRunDB.user_id == current_user["id"]).offset(offset).limit(limit).all()
    return [test_run.to_dict() for test_run in test_runs]

@app.get("/api/v1/test-runs/{run_id}", response_model=TestRunResponse)
async def get_test_run(
    run_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Try to get from database first
    db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
    if db_test_run:
        # Check if user has access
        if db_test_run.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this test run")
        return db_test_run.to_dict()
    
    # If not in database, try in-memory
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    return test_runs[run_id]

@app.delete("/api/v1/test-runs/{run_id}", status_code=204)
async def cancel_test_run(
    run_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if test run exists in memory
    if run_id not in test_runs:
        # Check if it exists in database
        db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
        if not db_test_run:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Check if user owns the test run
        if db_test_run.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this test run")
        
        # Delete from database
        db.delete(db_test_run)
        db.commit()
        return None
    
    # If it exists in memory, check if it exists in database
    db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
    if db_test_run:
        # Check if user owns the test run
        if db_test_run.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this test run")
        
        # Delete from database
        db.delete(db_test_run)
        db.commit()
    
    # Delete from in-memory dictionary or mark as cancelled if running
    if test_runs[run_id]["status"] in ["pending", "running"]:
        test_runs[run_id]["status"] = "cancelled"
        test_runs[run_id]["completed_at"] = datetime.now()
    else:
        # If not running, just delete it
        del test_runs[run_id]
    
    return None

@app.get("/api/v1/test-runs/{run_id}/transcript")
async def get_test_transcript(
    run_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Try to get from database first
    db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
    if db_test_run:
        # Check if user has access
        if db_test_run.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this test run")
        
        # Check if test run is completed
        if db_test_run.status != "completed":
            raise HTTPException(status_code=400, detail="Test run not completed")
        
        # Check if results and transcript exist
        if not db_test_run.results or "transcript" not in db_test_run.results:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        return db_test_run.results["transcript"]
    
    # If not in database, try in-memory
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    if test_runs[run_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Test run not completed")
    
    if "results" not in test_runs[run_id] or "transcript" not in test_runs[run_id]["results"]:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    return test_runs[run_id]["results"]["transcript"]

@app.get("/api/v1/test-runs/{run_id}/report")
async def get_test_run_report(
    request: Request,
    run_id: str = Path(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if test run exists and user has access
    db_test_run = db.query(TestRunDB).filter(TestRunDB.id == run_id).first()
    if not db_test_run:
        raise HTTPException(status_code=404, detail="Test run not found or access denied")

    if db_test_run.status != "completed":
        logger.info(f"Test run {run_id} is not completed yet (status: {db_test_run.status}). Returning empty report.")
        return []

    report_dir_path = os.path.join(reports_dir, db_test_run.agent_id, run_id)
    logger.info(f"Looking for reports in directory: {report_dir_path}")

    if not os.path.exists(report_dir_path) or not os.path.isdir(report_dir_path):
        logger.warning(f"Report directory not found: {report_dir_path}")
        return []

    all_report_data = []
    base_url = str(request.base_url)

    try:
        report_files = [f for f in os.listdir(report_dir_path) if f.startswith("report_") and f.endswith(".json")]
        
        if not report_files:
            logger.info(f"No individual report_*.json files found in {report_dir_path}. Returning empty list.")
            return []

        for report_filename in sorted(report_files):
            individual_report_path = os.path.join(report_dir_path, report_filename)
            logger.info(f"Reading individual report file: {individual_report_path}")
            with open(individual_report_path, 'r') as f:
                try:
                    report_content_list = json.load(f)
                    
                    # Ensure report_content_list is a list for uniform processing
                    if isinstance(report_content_list, dict):
                        report_content_list = [report_content_list]
                    elif not isinstance(report_content_list, list):
                        logger.warning(f"Report file {individual_report_path} contains unexpected data type. Skipping.")
                        continue

                    for report_item in report_content_list:
                        if isinstance(report_item, dict) and 'recording_url' in report_item:
                            filename = report_item['recording_url']
                            if filename and isinstance(filename, str) and filename != "No recording URL available":
                                # Construct full URL. Ensure no double slashes if base_url ends with / and api path starts with /
                                api_path = f"api/v1/test-runs/recordings/{filename}"
                                full_url = f"{base_url.rstrip('/')}/{api_path.lstrip('/')}"
                                report_item['recording_url'] = full_url
                                logger.debug(f"Updated recording_url for {filename} to {full_url}")
                            else:
                                logger.debug(f"No valid recording filename found for an item in {report_filename}")
                        else:
                            logger.debug(f"Item in {report_filename} is not a dict or does not have 'recording_url'. Item: {report_item}")
                        all_report_data.append(report_item)

                except json.JSONDecodeError as json_err:
                    logger.error(f"Error decoding JSON from {individual_report_path}: {json_err}")
                    continue 
    except Exception as e:
        logger.error(f"Error reading report files for run {run_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing test run reports")

    logger.info(f"Successfully retrieved {len(all_report_data)} report items for run_id: {run_id}")
    return all_report_data

# Endpoint to serve test run recordings
@app.get("/api/v1/test-runs/recordings/{filename:path}", tags=["Test Runs"])
async def get_test_run_recording(
    filename: str = Path(..., description="The filename of the recording to retrieve.")
    # current_user: User = Depends(get_current_user) # Authentication removed
):
    logger.info(f"Request to access recording: {filename}") # Removed by user {current_user.username}
    
    # Security: Basic path traversal check
    if ".." in filename or filename.startswith("/"):
        logger.warning(f"Potential path traversal attempt for filename: {filename}")
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = os.path.join(recordings_dir, filename)
    
    # Check if the file exists and is within the intended directory
    # os.path.abspath will resolve any ".."
    # This check helps prevent accessing files outside recordings_dir even if os.path.join creates a valid-looking path
    if not os.path.exists(file_path) or not os.path.isfile(file_path) or not os.path.abspath(file_path).startswith(os.path.abspath(recordings_dir)):
        logger.error(f"Recording file not found or access denied: {file_path}. Absolute path: {os.path.abspath(file_path)}. recordings_dir: {os.path.abspath(recordings_dir)}")
        raise HTTPException(status_code=404, detail="Recording not found.")
    
    # TODO: Add more fine-grained access control if necessary, e.g.,
    # check if current_user is authorized to access this specific recording
    # based on test run ownership or other criteria.

    logger.info(f"Serving recording file: {file_path}")
    return FileResponse(path=file_path, media_type="audio/wav", filename=filename)

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
    elif api_key.service.upper() == "TWILIO_SID_TOKEN":
        if ":" in api_key.key:  # Format: SID:AUTH_TOKEN
            sid, token = api_key.key.split(":", 1)
            os.environ["TWILIO_ACCOUNT_SID"] = sid
            os.environ["TWILIO_AUTH_TOKEN"] = token
    elif api_key.service.upper() == "TWILIO_PHONE_NUMBER":
        os.environ["TWILIO_PHONE_NUMBER"] = api_key.key
    elif api_key.service.upper() == "VAPI":
        os.environ["VAPI_API_KEY"] = api_key.key
    elif api_key.service.upper() == "CARTESIA":
        os.environ["CARTESIA_API_KEY"] = api_key.key
    elif api_key.service.upper() == "DEEPGRAM":
        os.environ["DEEPGRAM_API_KEY"] = api_key.key
    elif api_key.service.upper() == "VOICE_AGENT_API":
        os.environ["VOICE_AGENT_API"] = api_key.key
    elif api_key.service.upper() == "VOICE_AGENT_API_AUTH_TOKEN":
        os.environ["VOICE_AGENT_API_AUTH_TOKEN"] = api_key.key
    
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
                elif service == "TWILIO_SID_TOKEN":
                    if ":" in key_data["key"]:  # Format: SID:AUTH_TOKEN
                        sid, token = key_data["key"].split(":", 1)
                        os.environ["TWILIO_ACCOUNT_SID"] = sid
                        os.environ["TWILIO_AUTH_TOKEN"] = token
                elif service == "TWILIO_PHONE_NUMBER":
                    os.environ["TWILIO_PHONE_NUMBER"] = key_data["key"]
                elif service == "VAPI":
                    os.environ["VAPI_API_KEY"] = key_data["key"]
                elif service == "CARTESIA":
                    os.environ["CARTESIA_API_KEY"] = key_data["key"]
                elif service == "DEEPGRAM":
                    os.environ["DEEPGRAM_API_KEY"] = key_data["key"]
                elif service == "VOICE_AGENT_API":
                    os.environ["VOICE_AGENT_API"] = key_data["key"]
                elif service == "VOICE_AGENT_API_AUTH_TOKEN":
                    os.environ["VOICE_AGENT_API_AUTH_TOKEN"] = key_data["key"]
                
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
            "twilio_sid_token": "TWILIO_ACCOUNT_SID" in os.environ and "TWILIO_AUTH_TOKEN" in os.environ and 
                            bool(os.environ["TWILIO_ACCOUNT_SID"]) and bool(os.environ["TWILIO_AUTH_TOKEN"]),
            "twilio_phone_number": "TWILIO_PHONE_NUMBER" in os.environ and bool(os.environ["TWILIO_PHONE_NUMBER"]),
            "vapi": "VAPI_API_KEY" in os.environ and bool(os.environ["VAPI_API_KEY"]),
            "cartesia": "CARTESIA_API_KEY" in os.environ and bool(os.environ["CARTESIA_API_KEY"]),
            "deepgram": "DEEPGRAM_API_KEY" in os.environ and bool(os.environ["DEEPGRAM_API_KEY"]),
            "voice_agent_api": "VOICE_AGENT_API" in os.environ and bool(os.environ["VOICE_AGENT_API"]),
            "voice_agent_api_auth_token": "VOICE_AGENT_API_AUTH_TOKEN" in os.environ and bool(os.environ["VOICE_AGENT_API_AUTH_TOKEN"])
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
            "twilio_sid_token": "TWILIO_ACCOUNT_SID" in os.environ and "TWILIO_AUTH_TOKEN" in os.environ and 
                            bool(os.environ["TWILIO_ACCOUNT_SID"]) and bool(os.environ["TWILIO_AUTH_TOKEN"]),
            "twilio_phone_number": "TWILIO_PHONE_NUMBER" in os.environ and bool(os.environ["TWILIO_PHONE_NUMBER"]),
            "vapi": "VAPI_API_KEY" in os.environ and bool(os.environ["VAPI_API_KEY"]),
            "cartesia": "CARTESIA_API_KEY" in os.environ and bool(os.environ["CARTESIA_API_KEY"]),
            "deepgram": "DEEPGRAM_API_KEY" in os.environ and bool(os.environ["DEEPGRAM_API_KEY"]),
            "voice_agent_api": "VOICE_AGENT_API" in os.environ and bool(os.environ["VOICE_AGENT_API"]),
            "voice_agent_api_auth_token": "VOICE_AGENT_API_AUTH_TOKEN" in os.environ and bool(os.environ["VOICE_AGENT_API_AUTH_TOKEN"])
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
    
    # Load agents, test cases, and metrics from database
    await load_data_from_db()

# Function to load data from database into in-memory dictionaries
async def load_data_from_db():
    logger.info("Loading data from database into memory...")
    db = next(get_db())
    
    # Load agents
    db_agents = db.query(AgentDB).all()
    for agent_db_obj in db_agents: 
        agents[agent_db_obj.id] = agent_db_obj.to_dict() # AgentDB.to_dict() is already updated
    logger.info(f"Loaded {len(agents)} agents from database")
    
    # Load test cases
    db_test_cases = db.query(TestCaseDB).all()
    for test_case_db_obj in db_test_cases: # Renamed for clarity
        # TestCaseDB.to_dict() should correctly serialize user_persona JSON
        # which now implicitly includes language/accent.
        test_cases[test_case_db_obj.id] = test_case_db_obj.to_dict()
    logger.info(f"Loaded {len(test_cases)} test cases from database")
    
    # Load metrics from database
    db_metrics = db.query(MetricDB).all()
    for metric in db_metrics:
        metrics[metric.id] = {
            "id": metric.id,
            "name": metric.name,
            "prompt": metric.prompt,
            "user_id": metric.user_id,
            "created_at": metric.created_at
        }
    logger.info(f"Loaded {len(metrics)} metrics from database")
    
    # Load evaluations
    db_evaluations = db.query(EvaluationDB).all()
    for evaluation in db_evaluations:
        # Assuming EvaluationDB has a to_dict() method or we manually construct the dict
        # Based on EvaluationResponse, the in-memory store might want to hold similar fields.
        # For simplicity, let's store what's directly available and useful for quick status checks/listings.
        eval_dict = {
            "id": evaluation.id,
            "user_id": evaluation.user_id,
            "recording_filename": evaluation.recording_filename,
            "metric_ids": evaluation.metric_ids,
            "status": evaluation.status,
            "transcript": evaluation.transcript,
            "results": evaluation.results, # This could be large, consider if needed in mem for all
            "error_message": evaluation.error_message,
            "created_at": evaluation.created_at,
            "completed_at": evaluation.completed_at
        }
        evaluations[evaluation.id] = eval_dict
    logger.info(f"Loaded {len(evaluations)} evaluations from database")
    
    db.close()
    logger.info("Data loading complete")

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

# Test case sharing
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
    
    # Check if user owns the test case
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

# Evaluation Endpoints (Placeholder for POST, then GET list, then GET detail)

@app.get("/api/v1/evaluations", response_model=List[EvaluationResponse])
async def list_evaluations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve a list of all evaluations for the current user.
    """
    logger.info(f"User {current_user['username']} (ID: {current_user['id']}) fetching their evaluations.")
    evaluations_db = db.query(EvaluationDB).filter(EvaluationDB.user_id == current_user["id"]).all()
    
    # The response_model will handle the conversion of each EvaluationDB object
    # to an EvaluationResponse object, thanks to orm_mode = True.
    return evaluations_db

@app.get("/api/v1/evaluations/{eval_id}", response_model=EvaluationResponse)
async def get_evaluation_detail(
    eval_id: str = Path(..., title="Evaluation ID", description="The ID of the evaluation to retrieve."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve details for a specific evaluation.
    """
    logger.info(f"User {current_user['username']} fetching details for evaluation_id: {eval_id}")
    db_eval = db.query(EvaluationDB).filter(EvaluationDB.id == eval_id).first()

    if not db_eval:
        logger.warning(f"Evaluation {eval_id} not found in database.")
        raise HTTPException(status_code=404, detail="Evaluation not found")

    if db_eval.user_id != current_user["id"]:
        logger.warning(f"User {current_user['username']} (ID: {current_user['id']}) attempted to access unauthorized evaluation {eval_id} owned by user {db_eval.user_id}.")
        # As per OBSERVABILITY.md, return 404 if not found or unauthorized to avoid leaking info
        raise HTTPException(status_code=404, detail="Evaluation not found")

    return db_eval

@app.get("/api/v1/evaluations/{eval_id}/download")
async def download_evaluation_recording(
    eval_id: str = Path(..., title="Evaluation ID", description="The ID of the evaluation whose recording is to be downloaded."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download the audio recording for a specific evaluation.
    """
    logger.info(f"User {current_user['username']} attempting to download recording for evaluation_id: {eval_id}")
    db_eval = db.query(EvaluationDB).filter(EvaluationDB.id == eval_id).first()

    if not db_eval:
        logger.warning(f"Evaluation {eval_id} not found for recording download attempt.")
        raise HTTPException(status_code=404, detail="Evaluation not found")

    if db_eval.user_id != current_user["id"]:
        logger.warning(f"User {current_user['username']} (ID: {current_user['id']}) attempted to download recording for unauthorized evaluation {eval_id}.")
        raise HTTPException(status_code=404, detail="Evaluation not found") # Or 403, but 404 as per plan

    if not db_eval.recording_filename:
        logger.error(f"Evaluation {eval_id} does not have an associated recording filename.")
        raise HTTPException(status_code=404, detail="Recording file not available for this evaluation")

    recording_path = os.path.join(recordings_dir, db_eval.recording_filename) # Use recordings_dir global
    logger.info(f"Constructed recording path for download: {recording_path}")

    if not os.path.exists(recording_path):
        logger.error(f"Recording file not found at path: {recording_path} for evaluation {eval_id}")
        raise HTTPException(status_code=404, detail="Recording file not found on server")

    # Determine a media type if possible, otherwise default to application/octet-stream
    # For simplicity, let's use a generic one, or try to infer.
    # Example: file_extension = os.path.splitext(db_eval.recording_filename)[1].lower()
    # media_type = "audio/wav" if file_extension == ".wav" else "audio/mpeg" if file_extension == ".mp3" else "application/octet-stream"
    media_type = "application/octet-stream" # Safest default for download

    return FileResponse(
        path=recording_path, 
        media_type=media_type, 
        filename=db_eval.recording_filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 