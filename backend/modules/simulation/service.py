"""
Simulation Service.

Main orchestrator for simulation operations.
Delegates to specialized services for lifecycle, grading, and progress operations.
"""

from typing import Dict, Any, Optional, AsyncGenerator
import json
import logging

from sqlalchemy.orm import Session

from modules.simulation.repository import SimulationRepository
from modules.simulation.core import OrchestratorManager, SceneProgressionHandler
from modules.simulation.handlers import ChatHandler
from modules.simulation.schemas.dto import (
    SimulationStartResponse, SimulationChatResponse,
    UserProgressResponse, SimulationSceneResponse
)
from modules.simulation.services import GradingService, ProgressService, LifecycleService, ConsequenceService
from modules.simulation.schemas.consequence_schemas import ConsequenceHistoryResponse
from common.db.models import ConversationLog
from common.exceptions import NotFoundError, ForbiddenError
from common.config import get_settings
from common.utils.concurrency import acquire_stream_slot, release_stream_slot

logger = logging.getLogger(__name__)

settings = get_settings()
_is_dev = settings.environment != "production"


class SimulationService:
    """Main service orchestrator for simulation operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.repository = SimulationRepository(db)
        self.chat_handler = ChatHandler(db, self.repository)
        self.scene_handler = SceneProgressionHandler(db, self.repository)
        self.orchestrator_manager = OrchestratorManager(db, self.repository)
        
        # Specialized services
        self.lifecycle_service = LifecycleService(db, self.repository)
        self.grading_service = GradingService(db, self.repository)
        self.progress_service = ProgressService(db, self.repository)
        self.consequence_service = ConsequenceService(db, self.repository)

    def _build_scene_payload(self, scene_id: int, user_progress_id: int) -> Optional[Dict[str, Any]]:
        scene = self.repository.get_scene_by_id(scene_id)
        if not scene:
            return None
        personas = self.repository.get_personas_for_scene(scene_id)
        return {
            'id': scene.id,
            'simulation_id': scene.simulation_id,
            'title': scene.title,
            'description': scene.description,
            'objectives': [scene.user_goal] if scene.user_goal else ['Continue the simulation'],
            'user_goal': scene.user_goal,
            'image_url': scene.image_url,
            'scene_order': scene.scene_order,
            'timeout_turns': scene.timeout_turns or 15,
            'success_metric': scene.success_metric,
            'personas_involved': [p.name for p in personas],
            'personas': [
                {
                    'id': p.id,
                    'simulation_id': p.simulation_id,
                    'name': p.name,
                    'role': p.role,
                    'background': p.background,
                    'correlation': p.correlation,
                    'primary_goals': p.primary_goals if isinstance(p.primary_goals, list) else ([p.primary_goals] if p.primary_goals else []),
                    'personality_traits': p.personality_traits or {},
                    'image_url': p.image_url,
                }
                for p in personas
            ],
            'scene_type': getattr(scene, 'scene_type', None) or 'conversation',
            'starter_code': getattr(scene, 'starter_code', None),
            'data_files': getattr(scene, 'data_files', None),
            'reference_files': getattr(scene, 'reference_files', None),
            'what_has_changed': [item.model_dump(mode='json') for item in self.consequence_service.what_has_changed(user_progress_id)],
        }
    
    def generate_scene_intro_message(
        self, 
        scene: dict, 
        db_scene = None
    ) -> str:
        """Generate the scene introduction message that appears at the start of each scene."""
        return self.lifecycle_service.generate_scene_intro_message(scene, db_scene)
    
    def validate_goal_with_function_calling(
        self,
        conversation_history: str,
        scene_goal: str,
        scene_description: str,
        current_attempts: int,
        max_attempts: int,
        user_progress_id: int = None,
        current_scene_id: int = None,
        perform_db_progression: bool = False
    ) -> dict:
        """
        Use OpenAI function calling to validate if user has achieved the scene goal.
        
        TODO: This method needs to be fully extracted from legacy code.
        Currently returns a placeholder structure.
        """
        # TODO: Extract full implementation from legacy simulation.py
        # This requires OpenAI client setup and function calling logic
        return {
            "goal_achieved": False,
            "confidence_score": 0.0,
            "reasoning": "Not implemented",
            "next_action": "continue",
            "hint_message": None
        }
    
    async def start_simulation(
        self,
        user_id: int,
        simulation_id: int
    ) -> SimulationStartResponse:
        """Start a new simulation or resume existing one."""
        return await self.lifecycle_service.start_simulation(user_id, simulation_id)
    
    async def process_chat_message(
        self,
        user_id: int,
        user_progress_id: int,
        message: str,
        scene_id: Optional[int] = None
    ) -> SimulationChatResponse:
        """
        Process a chat message (non-streaming).
        
        Used for SUBMIT_FOR_GRADING and other special messages.
        """
        user_progress = self.repository.get_user_progress_by_id(user_progress_id)
        if not user_progress:
            raise NotFoundError("User progress not found")
        
        if user_progress.user_id != user_id:
            raise ForbiddenError("Access denied")
        
        if not user_progress.orchestrator_data:
            raise NotFoundError("Simulation not properly initialized")
        
        # Check if this is SUBMIT_FOR_GRADING
        if message.strip() == "SUBMIT_FOR_GRADING":
            scene_id_to_use = scene_id if scene_id is not None else user_progress.current_scene_id
            if scene_id_to_use != user_progress.current_scene_id:
                raise ForbiddenError("Only the current scene can be submitted")

            orchestrator = self.orchestrator_manager.load_orchestrator(user_progress, user_id)
            await self.orchestrator_manager.initialize_langchain_session(orchestrator, user_progress.id)
            self.orchestrator_manager.load_orchestrator_state(orchestrator, user_progress)

            consequence = await self.consequence_service.complete_scene(
                user_progress_id=user_progress.id,
                scene_id=scene_id_to_use,
                trigger_type="submitted",
                turn_count=orchestrator.state.turn_count,
                scene_progression_handler=self.scene_handler,
            )
            return SimulationChatResponse(
                message="Your decisions are shaping what happens next.",
                scene_id=scene_id_to_use,
                scene_completed=consequence.generation_status == "ready",
                next_scene_id=None,
                persona_name="System",
                persona_id=None,
                turn_count=orchestrator.state.turn_count,
                consequence=consequence,
                consequences=self.consequence_service.list_responses(user_progress.id, ready_only=True),
                awaiting_consequence_ack=True,
            )
        
        # For other messages, return a basic response
        return SimulationChatResponse(
            message="This endpoint is for SUBMIT_FOR_GRADING. Use /linear-chat-stream for regular chat.",
            scene_id=scene_id,
            scene_completed=False,
            persona_name="System",
            persona_id=None,
            turn_count=0
        )

    def get_consequence_history(
        self, user_progress_id: int, user_id: int
    ) -> ConsequenceHistoryResponse:
        progress = self.repository.get_user_progress_by_id(user_progress_id)
        if not progress:
            raise NotFoundError("User progress not found")
        if progress.user_id != user_id:
            raise ForbiddenError("Access denied")
        return ConsequenceHistoryResponse(
            consequences=self.consequence_service.list_responses(user_progress_id, ready_only=True),
            pending_consequence=self.consequence_service.get_pending_response(user_progress_id),
        )

    async def resolve_pending_consequence(
        self, user_progress_id: int, user_id: int
    ) -> ConsequenceHistoryResponse:
        progress = self.repository.get_user_progress_by_id(user_progress_id)
        if not progress:
            raise NotFoundError("User progress not found")
        if progress.user_id != user_id:
            raise ForbiddenError("Access denied")
        pending = self.repository.get_pending_scene_consequence(user_progress_id)
        if pending and pending.generation_status == "generating":
            await self.consequence_service.complete_scene(
                user_progress_id=user_progress_id,
                scene_id=pending.scene_id,
                trigger_type=pending.trigger_type,
                turn_count=((progress.orchestrator_data or {}).get("state", {}).get("turn_count", 0)),
                scene_progression_handler=self.scene_handler,
            )
        return self.get_consequence_history(user_progress_id, user_id)

    async def continue_after_consequence(
        self, user_progress_id: int, consequence_id: int, user_id: int
    ) -> SimulationChatResponse:
        progress = self.repository.get_user_progress_by_id(user_progress_id)
        if not progress:
            raise NotFoundError("User progress not found")
        if progress.user_id != user_id:
            raise ForbiddenError("Access denied")

        orchestrator = self.orchestrator_manager.load_orchestrator(progress, user_id)
        await self.orchestrator_manager.initialize_langchain_session(orchestrator, progress.id)
        self.orchestrator_manager.load_orchestrator_state(orchestrator, progress)
        result = self.consequence_service.acknowledge_and_advance(
            consequence_id=consequence_id,
            user_progress=progress,
            orchestrator=orchestrator,
            scene_progression_handler=self.scene_handler,
            generate_scene_intro_fn=lambda scene: self.lifecycle_service.generate_scene_intro_message(
                scene, self.repository.get_scene_by_id(scene.get("id"))
            ),
        )

        if result.get("already_acknowledged"):
            self.db.refresh(progress)
            is_complete = progress.simulation_status == "completed"
            next_scene_id = None if is_complete else progress.current_scene_id
            next_scene = self._build_scene_payload(next_scene_id, progress.id) if next_scene_id else None
            return SimulationChatResponse(
                scene_id=next_scene_id,
                scene_completed=True,
                next_scene_id=next_scene_id,
                next_scene=next_scene,
                simulation_complete=is_complete,
                consequences=self.consequence_service.list_responses(progress.id, ready_only=True),
            )

        self.orchestrator_manager.save_orchestrator_state(orchestrator, progress)
        self.db.commit()

        if result.get("simulation_complete"):
            if progress.sandbox_id:
                try:
                    from common.services.sandbox_service import sandbox_service
                    if await sandbox_service.delete_sandbox(progress.sandbox_id):
                        progress.sandbox_id = None
                        self.db.commit()
                except Exception:
                    logger.exception("Failed to clean up sandbox after final consequence")
            return SimulationChatResponse(
                message="Simulation complete",
                scene_id=None,
                scene_completed=True,
                next_scene_id=None,
                simulation_complete=True,
                consequences=self.consequence_service.list_responses(progress.id, ready_only=True),
            )

        next_scene_id = result["next_scene_id"]
        next_scene = self._build_scene_payload(next_scene_id, progress.id)

        if progress.sandbox_id and next_scene and next_scene.get("scene_type") == "code_challenge":
            data_files = next_scene.get("data_files")
            if data_files:
                try:
                    from common.services.sandbox_service import sandbox_service
                    await sandbox_service.upload_scene_data_files(progress.sandbox_id, data_files)
                except Exception:
                    logger.exception("Failed to upload next-scene data files")

        return SimulationChatResponse(
            message="Continue to the next scene",
            scene_id=next_scene_id,
            scene_completed=True,
            next_scene_id=next_scene_id,
            next_scene=next_scene,
            scene_intro_message=result.get("scene_intro_message"),
            turn_count=0,
            consequences=self.consequence_service.list_responses(progress.id, ready_only=True),
        )
    
    async def stream_chat_message(
        self,
        user_id: int,
        user_progress_id: int,
        message: str,
        scene_id: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat message (streaming).
        
        Used for real-time chat interactions with persona agents.
        Handles @mentions, @all, scene transitions, and timeouts.
        Applies global back-pressure when the process is at capacity.
        """
        acquired = await acquire_stream_slot()
        if not acquired:
            # Immediate back-pressure: inform client that capacity is reached.
            logger.warning(f"[CAPACITY] Stream slot unavailable for user {user_id}, user_progress_id {user_progress_id} - system at capacity")
            error_payload = {
                "error": "Simulation system is at capacity. Please wait a moment and try again.",
                "code": "SIMULATION_STREAMS_AT_CAPACITY",
                "message": "Too many users are using the simulation right now. Please wait a few seconds and try again."
            }
            yield f"data: {json.dumps(error_payload)}\n\n"
            return

        try:
            last_chunk_was_done = False
            async for chunk in self.chat_handler.handle_stream_message(
                user_id=user_id,
                user_progress_id=user_progress_id,
                message=message,
                orchestrator_manager=self.orchestrator_manager,
                scene_progression_handler=self.scene_handler,
                generate_scene_intro_fn=self.lifecycle_service.generate_scene_intro_message,
            ):
                yield chunk
                # Check if this is the final 'done' chunk and commit
                try:
                    if chunk.startswith("data: "):
                        data_str = chunk.replace("data: ", "").strip()
                        if data_str:
                            data = json.loads(data_str)
                            if data.get("done", False):
                                last_chunk_was_done = True
                except (json.JSONDecodeError, KeyError, json.JSONDecodeError):
                    # Ignore malformed payloads in the commit detection logic.
                    pass

            # Commit after streaming completes successfully
            # NOTE: turn_count and persona responses may have already been committed
            # by chat_handler or PersonaCallbackHandler, but we commit here to ensure 
            # any remaining changes (like orchestrator state updates) are persisted
            if last_chunk_was_done:
                # Refresh to see any changes from other commits (e.g., PersonaCallbackHandler)
                # This ensures persona responses and turn_count changes are visible
                self.db.expire_all()
                self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        finally:
            release_stream_slot()
    
    def get_user_progress(
        self,
        user_progress_id: int,
        user_id: int
    ) -> UserProgressResponse:
        """Get detailed user progress for a simulation."""
        return self.progress_service.get_user_progress(user_progress_id, user_id)
    
    def get_scene_by_id(self, scene_id: int, user_id: int) -> SimulationSceneResponse:
        """Get scene data by ID with ownership validation."""
        return self.progress_service.get_scene_by_id(scene_id, user_id)
    
    async def get_simulation_grading(
        self,
        user_progress_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Get simulation grading.
        
        Returns AI-generated grades and feedback for the simulation.
        """
        return await self.grading_service.get_simulation_grading(user_progress_id, user_id)
    
    def save_message(
        self,
        user_id: int,
        user_progress_id: int,
        scene_id: int,
        sender_name: str,
        message_content: str,
        message_type: str,
        session_id: str = None
    ) -> Dict[str, Any]:
        """Save a system message to conversation history."""
        import secrets
        user_progress = self.repository.get_user_progress_by_id(user_progress_id)
        if not user_progress:
            raise NotFoundError("User progress not found")

        if user_progress.user_id != user_id:
            raise ForbiddenError("Access denied: You can only save messages to your own simulation")

        next_message_order = self.repository.get_next_message_order(user_progress_id)

        # Generate a session_id for system messages if not provided by caller
        effective_session_id = session_id or f"system_{user_progress_id}_{scene_id}_{secrets.token_urlsafe(8)}"

        log = self.repository.create_conversation_log(
            user_progress_id=user_progress_id,
            scene_id=scene_id,
            message_type=message_type,
            sender_name=sender_name,
            message_content=message_content,
            message_order=next_message_order,
            session_id=effective_session_id
        )
        self.repository.db.commit()
        return {"id": log.id, "message_order": log.message_order, "status": "saved"}
