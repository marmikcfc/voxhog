from dataclasses import dataclass
from openai import AsyncOpenAI
from pydantic import BaseModel
from typing import Literal, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VoiceAgentEvaluation(BaseModel):
    name: str
    result: Literal["pass", "fail"]
    reason: str

class VoiceAgentEvaluationResults(BaseModel):
    evaluations: List[VoiceAgentEvaluation]

class VoiceAgentMetric:
    def __init__(self, name: str, prompt: str):
        self.name = name
        self.prompt = prompt
        logger.debug(f"Created new VoiceAgentMetric: {name}")

class VoiceAgentEvaluator:
    def __init__(self, model: str):
        logger.info(f"Initializing VoiceAgentEvaluator with model: {model}")
        self.client = AsyncOpenAI()
        self.model = model
        self.metrics = []  # List of VoiceAgentMetric objects
        self.evaluations = []  # List to store evaluation results
        logger.debug("VoiceAgentEvaluator initialized successfully")

    def add_metric(self, metric: VoiceAgentMetric):
        """Adds a VoiceAgentMetric to the evaluation list."""
        logger.info(f"Adding new metric: {metric.name}")
        self.metrics.append(metric)
        logger.debug(f"Current number of metrics: {len(self.metrics)}")

    async def evaluate_voice_conversation(self, conversation_data: dict) -> List[VoiceAgentEvaluation]:
        """
        Evaluate the voice conversation across all metrics in a single API call.
        Returns a list of VoiceAgentEvaluation objects.
        """
        logger.info(f"Number of metrics to evaluate: {len(self.metrics)}")
        
        try:
            if len(self.metrics) == 0:
                logger.warning("No metrics to evaluate, returning empty list")
                return VoiceAgentEvaluationResults(evaluations=[])
                
            metrics_prompt = "\n".join([f"Metric {i+1}: {m.name}\n{m.prompt}" for i, m in enumerate(self.metrics)])
            logger.info(f"Generated metrics prompt with {len(self.metrics)} metrics")
            logger.debug(f"Metrics prompt: {metrics_prompt}")
            
            messages = [
                {"role": "system", "content": "You are an expert in evaluating transcripts between customers and agents. "
                                            "Evaluate the conversation for all the following metrics. For each metric, "
                                            "provide a pass/fail result and a brief reason."},
                {"role": "user", "content": f"Metrics to evaluate:\n{metrics_prompt}\n\nConversation Data: {conversation_data}"}
            ]
            
            response = await self.client.beta.chat.completions.parse(
                model=self.model,
                messages=messages,
                temperature=0,
                response_format=VoiceAgentEvaluationResults
            )
            parsed = response.choices[0].message.parsed
            logger.info(f"Received response from OpenAI {parsed} type of {type(parsed)}")
            self.evaluations = parsed #VoiceAgentEvaluationResults(parsed)
            
            # Log individual evaluation results
            for eval in self.evaluations.evaluations:
                logger.debug(f"Metric: {eval.name}, Result: {eval.result}, Reason: {eval.reason}")
            
            return self.evaluations
            
        except Exception as e:
            logger.error(f"Error during voice conversation evaluation: {str(e)}", exc_info=True)
            raise 