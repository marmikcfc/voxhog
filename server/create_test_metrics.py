#!/usr/bin/env python

import sys
import os
import uuid
import logging
from sqlalchemy.orm import Session
from database import get_db, MetricDB, init_db

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_sample_metrics():
    """Create sample metrics in the database."""
    logger.info("Creating sample metrics...")
    
    # Initialize the database
    init_db()
    
    # Get database session
    db = next(get_db())
    
    # Check if we already have metrics
    existing_metrics = db.query(MetricDB).count()
    logger.info(f"Found {existing_metrics} existing metrics")
    
    if existing_metrics > 0:
        logger.info("Metrics already exist, skipping creation")
        return
    
    # Sample metrics
    sample_metrics = [
        {
            "name": "Conversation Flow",
            "prompt": "Evaluate if the conversation flows naturally and the agent maintains appropriate turn-taking"
        },
        {
            "name": "Task Completion",
            "prompt": "Assess if the agent successfully completes the primary task booking with all necessary information"
        },
        {
            "name": "Personality Consistency",
            "prompt": "Evaluate if the agent maintains its friendly and witty personality throughout the conversation"
        }
    ]
    
    # Add metrics to database
    for metric_data in sample_metrics:
        metric_id = str(uuid.uuid4())
        db_metric = MetricDB(
            id=metric_id,
            name=metric_data["name"],
            prompt=metric_data["prompt"]
        )
        db.add(db_metric)
        logger.info(f"Added metric: {metric_data['name']} with ID: {metric_id}")
    
    # Commit changes
    db.commit()
    logger.info(f"Successfully created {len(sample_metrics)} sample metrics")

if __name__ == "__main__":
    create_sample_metrics() 