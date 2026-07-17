"""Persisted cause-and-effect outcomes for completed simulation scenes."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from common.db.base import Base


class SceneConsequence(Base):
    """A single canonical consequence for one learner's completed scene.

    Generated content is finalized once. ``acknowledged_at`` is intentionally
    separate lifecycle metadata so acknowledging a transition never rewrites
    the outcome that the learner received.
    """

    __tablename__ = "scene_consequences"
    __table_args__ = (
        UniqueConstraint(
            "user_progress_id",
            "scene_id",
            name="uq_scene_consequences_progress_scene",
        ),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('strong', 'mixed', 'risky')",
            name="ck_scene_consequences_outcome",
        ),
        CheckConstraint(
            "trigger_type IN ('submitted', 'timeout')",
            name="ck_scene_consequences_trigger",
        ),
        CheckConstraint(
            "generation_status IN ('generating', 'ready')",
            name="ck_scene_consequences_generation_status",
        ),
        CheckConstraint(
            "generation_status != 'ready' OR "
            "(outcome IS NOT NULL AND narrative IS NOT NULL AND "
            "context_summary IS NOT NULL AND generated_at IS NOT NULL)",
            name="ck_scene_consequences_ready_payload",
        ),
        Index(
            "ix_scene_consequences_progress_created",
            "user_progress_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_progress_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_progress.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scene_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("simulation_scenes.id"),
        nullable=False,
        index=True,
    )

    outcome: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    narrative: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(16), nullable=False)
    generation_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="generating", server_default="generating"
    )
    generation_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    generation_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_fallback: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    source_message_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_model_version: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    generation_error_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    claimed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
