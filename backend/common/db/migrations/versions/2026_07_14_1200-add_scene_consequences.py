"""add canonical scene consequences

Revision ID: add_scene_consequences
Revises: merge_persona_code_challenge
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa


revision = "add_scene_consequences"
down_revision = "merge_persona_code_challenge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scene_consequences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_progress_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=True),
        sa.Column("narrative", sa.Text(), nullable=True),
        sa.Column("context_summary", sa.Text(), nullable=True),
        sa.Column("trigger_type", sa.String(length=16), nullable=False),
        sa.Column("generation_status", sa.String(length=16), server_default="generating", nullable=False),
        sa.Column("generation_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("generation_token", sa.String(length=64), nullable=True),
        sa.Column("is_fallback", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("source_message_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("ai_model_version", sa.String(length=128), nullable=True),
        sa.Column("generation_error_code", sa.String(length=64), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "outcome IS NULL OR outcome IN ('strong', 'mixed', 'risky')",
            name="ck_scene_consequences_outcome",
        ),
        sa.CheckConstraint(
            "trigger_type IN ('submitted', 'timeout')",
            name="ck_scene_consequences_trigger",
        ),
        sa.CheckConstraint(
            "generation_status IN ('generating', 'ready')",
            name="ck_scene_consequences_generation_status",
        ),
        sa.CheckConstraint(
            "generation_status != 'ready' OR "
            "(outcome IS NOT NULL AND narrative IS NOT NULL AND "
            "context_summary IS NOT NULL AND generated_at IS NOT NULL)",
            name="ck_scene_consequences_ready_payload",
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"], ["simulation_scenes.id"], name="fk_scene_consequences_scene"
        ),
        sa.ForeignKeyConstraint(
            ["user_progress_id"],
            ["user_progress.id"],
            name="fk_scene_consequences_user_progress",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_progress_id",
            "scene_id",
            name="uq_scene_consequences_progress_scene",
        ),
    )
    op.create_index(
        "ix_scene_consequences_user_progress_id",
        "scene_consequences",
        ["user_progress_id"],
    )
    op.create_index("ix_scene_consequences_scene_id", "scene_consequences", ["scene_id"])
    op.create_index(
        "ix_scene_consequences_progress_created",
        "scene_consequences",
        ["user_progress_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_scene_consequences_progress_created", table_name="scene_consequences")
    op.drop_index("ix_scene_consequences_scene_id", table_name="scene_consequences")
    op.drop_index("ix_scene_consequences_user_progress_id", table_name="scene_consequences")
    op.drop_table("scene_consequences")
