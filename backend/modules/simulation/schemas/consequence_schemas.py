"""Typed contracts for scene consequence generation and delivery."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ConsequenceOutcome(str, Enum):
    strong = "strong"
    mixed = "mixed"
    risky = "risky"


class ConsequenceTrigger(str, Enum):
    submitted = "submitted"
    timeout = "timeout"


class ConsequenceGeneration(BaseModel):
    """Structured LLM output; scoring is deliberately absent."""

    outcome: ConsequenceOutcome
    narrative: str = Field(
        min_length=80,
        description="A five or six sentence, second-person cause-and-effect narrative.",
    )
    context_summary: str = Field(
        min_length=20,
        max_length=800,
        description="Compact factual carry-forward context for later scenes.",
    )


class WhatHasChangedItem(BaseModel):
    scene_id: int
    scene_title: str
    outcome: ConsequenceOutcome
    summary: str


class SceneConsequenceResponse(BaseModel):
    id: int
    scene_id: int
    scene_order: int
    scene_title: str
    outcome: Optional[ConsequenceOutcome] = None
    narrative: Optional[str] = None
    context_summary: Optional[str] = None
    trigger_type: ConsequenceTrigger
    generation_status: str
    is_fallback: bool = False
    source_message_order: int = 0
    generated_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None


class ConsequenceHistoryResponse(BaseModel):
    consequences: list[SceneConsequenceResponse] = Field(default_factory=list)
    pending_consequence: Optional[SceneConsequenceResponse] = None
