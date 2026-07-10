"""
Image Generation Service for PDF Processing

Generates simulation scene images and persona avatars using OpenAI's
GPT Image API, uploading results directly to AWS S3.

GPT Image models return base64 image data (no temporary CDN URL), so images
are stored permanently at generation time and the returned S3 URLs pass
through the publishing flow untouched (is_temporary_image_url -> False).
"""
import asyncio
import base64
import time
import logging
import uuid
import openai
from typing import List, Dict, Any, Optional
from common.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Image generation configuration
OPENAI_API_KEY = getattr(settings, 'openai_api_key', None)
IMAGE_MODEL = "gpt-image-2"
IMAGE_QUALITY = "high"
IMAGE_SIZE = "1024x1024"
MAX_CONCURRENT_IMAGES = 10  # Limit concurrent image generations for scenes

# Global semaphore for image generation rate limiting (scenes) - lazily initialized
_image_semaphore: Optional[asyncio.Semaphore] = None

# Log configuration on module load
logger.info(f"[IMAGE] OpenAI image configuration loaded: model={IMAGE_MODEL}, API Key available = {bool(OPENAI_API_KEY)}")


def _get_image_semaphore() -> asyncio.Semaphore:
    """
    Get or create the image generation semaphore with lazy initialization.
    This ensures the semaphore is bound to the correct event loop at runtime.

    Returns:
        The semaphore instance for rate limiting scene image generation
    """
    global _image_semaphore
    if _image_semaphore is None:
        _image_semaphore = asyncio.Semaphore(MAX_CONCURRENT_IMAGES)
    return _image_semaphore


async def _generate_and_store_image(prompt: str, s3_key_prefix: str, label: str) -> str:
    """
    Generate an image with the OpenAI GPT Image API and upload it to S3.

    Args:
        prompt: Image generation prompt
        s3_key_prefix: S3 key prefix (e.g. "generated/avatars")
        label: Human-readable label for logging

    Returns:
        Permanent S3 URL, or empty string on failure.
    """
    start_time = time.time()

    if not OPENAI_API_KEY:
        logger.error(f"[IMAGE] OpenAI API key not configured (while generating {label})")
        return ""

    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)

        # GPT Image models return base64 data (no URL) - blocking call in executor
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.images.generate(
                model=IMAGE_MODEL,
                prompt=prompt,
                size=IMAGE_SIZE,
                quality=IMAGE_QUALITY,
                n=1,
            )
        )

        image_bytes = base64.b64decode(response.data[0].b64_json)
        generation_time = time.time() - start_time
        logger.info(f"[IMAGE] Generated {label} in {generation_time:.2f}s ({len(image_bytes)} bytes)")

        from common.services.s3_service import s3_service
        s3_key = f"{s3_key_prefix}/{uuid.uuid4().hex}.png"
        image_url = await s3_service.upload_from_bytes(image_bytes, s3_key, "image/png")

        if not image_url:
            logger.error(f"[IMAGE] S3 upload failed for {label} (key: {s3_key})")
            return ""

        logger.info(f"[IMAGE] Stored {label} at: {image_url}")
        return image_url

    except Exception as e:
        logger.error(f"[ERROR] Image generation failed for {label}: {type(e).__name__}: {str(e)}")
        return ""


async def generate_scene_image(
    scene_description: str,
    scene_title: str,
    simulation_id: int = 0,
    scene_id: Optional[int] = None
) -> str:
    """
    Generate an image for a scene using OpenAI's GPT Image API.

    Args:
        scene_description: Description of the scene for image generation
        scene_title: Title of the scene
        simulation_id: Simulation ID (for reference, not used for upload here)
        scene_id: Optional scene ID (for reference, not used for upload here)

    Returns:
        Permanent S3 URL of the generated image, or empty string on failure.
    """
    logger.info(f"[IMAGE] Generating image for scene: {scene_title}")

    async with _get_image_semaphore():  # Rate limiting
        image_prompt = f"Professional business illustration: {scene_title}. {scene_description[:100]}. Clean, modern corporate style, educational use."
        return await _generate_and_store_image(
            image_prompt[:400],  # Truncate to stay within limits
            "generated/scenes",
            f"scene image '{scene_title}'"
        )


async def generate_scenes_with_images(
    scenes: List[Dict[str, Any]],
    session_id: Optional[str] = None,
    simulation_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Generate images for multiple scenes in parallel.

    Args:
        scenes: List of scene dictionaries with 'description' and 'title' keys
        session_id: Optional session ID for progress tracking
        simulation_id: Optional simulation ID (for reference, not used for upload here)

    Returns:
        List of scenes with 'image_url' added to each scene.
        URLs are permanent S3 URLs.
    """
    if not scenes:
        logger.info("[IMAGE] No scenes to generate images for")
        return scenes

    logger.info(f"[IMAGE] Starting image generation for {len(scenes)} scenes")
    logger.info(f"[IMAGE] OpenAI API key available: {bool(OPENAI_API_KEY)}")

    image_tasks = []
    for i, scene in enumerate(scenes):
        if isinstance(scene, dict) and "description" in scene and "title" in scene:
            scene_id = scene.get("id") or scene.get("scene_id")
            logger.info(f"[IMAGE] Creating image task for scene {i+1}: {scene.get('title', 'Untitled')}")
            task = generate_scene_image(
                scene["description"],
                scene["title"],
                simulation_id or 0,
                scene_id
            )
            image_tasks.append(task)
        else:
            logger.warning(f"[IMAGE] Skipping invalid scene {i+1}: {scene}")
            # Create a simple async function that returns empty string
            async def empty_task():
                return ""
            image_tasks.append(empty_task())

    # Wait for all image generations to complete
    logger.info(f"[IMAGE] Waiting for {len(image_tasks)} image generation tasks...")
    image_urls = await asyncio.gather(*image_tasks, return_exceptions=True)

    # Update scenes with image URLs
    for i, scene in enumerate(scenes):
        if isinstance(scene, dict):
            image_url = image_urls[i] if i < len(image_urls) and not isinstance(image_urls[i], Exception) else ""
            scene["image_url"] = image_url
            if isinstance(image_urls[i], Exception):
                logger.error(f"[IMAGE] Scene {i+1}: {scene.get('title', 'Untitled')} - Image FAILED: {image_urls[i]}")
            else:
                logger.info(f"[IMAGE] Scene {i+1}: {scene.get('title', 'Untitled')} - Image: {'Generated' if image_url else 'Failed'}")

    return scenes


async def _generate_persona_avatar_unsafe(
    persona_name: str,
    persona_role: str,
    background: str = "",
    persona_id: Optional[int] = None
) -> str:
    """
    Generate a professional avatar image for a persona using OpenAI's GPT Image API.
    Internal function without semaphore - use via generate_personas_with_avatars.

    Args:
        persona_name: Name of the persona
        persona_role: Professional role/title
        background: Background description (optional)
        persona_id: Optional persona ID (for reference, not used for upload here)

    Returns:
        Permanent S3 URL of the generated avatar, or empty string on failure.
    """
    logger.info(f"[AVATAR] Generating avatar for persona: {persona_name} ({persona_role})")

    # Create a professional avatar prompt
    avatar_prompt = f"Professional business portrait of {persona_name}, {persona_role}. "
    if background:
        avatar_prompt += f"{background}. "
    avatar_prompt += "Corporate headshot style, professional attire, neutral background, high quality, portrait photography."

    # Trim prompt to reasonable length
    avatar_prompt = avatar_prompt[:500]

    logger.info(f"[AVATAR] Prompt: {avatar_prompt}")

    return await _generate_and_store_image(
        avatar_prompt,
        "generated/avatars",
        f"avatar '{persona_name}'"
    )


async def generate_personas_with_avatars(personas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate avatar images for multiple personas in parallel using OpenAI's GPT Image API.

    Args:
        personas: List of persona dictionaries with 'name', 'role', and optionally 'background'

    Returns:
        List of personas with 'image_url' added to each persona (or 'avatar_url' for compatibility)
    """
    if not personas:
        logger.info("[AVATAR] No personas to generate avatars for")
        return personas

    logger.info(f"[AVATAR] Starting avatar generation for {len(personas)} personas")
    logger.info(f"[AVATAR] OpenAI API key available: {bool(OPENAI_API_KEY)}")

    # Create a dynamic semaphore based on the number of personas (max 10 to respect API rate limits)
    dynamic_limit = min(len(personas), 10)
    persona_semaphore = asyncio.Semaphore(dynamic_limit)
    logger.info(f"[AVATAR] Using dynamic semaphore limit: {dynamic_limit}")

    # Inner function that uses the dynamic semaphore
    async def generate_with_semaphore(persona_name: str, persona_role: str, background: str, persona_id: Optional[int] = None) -> str:
        async with persona_semaphore:
            return await _generate_persona_avatar_unsafe(persona_name, persona_role, background, persona_id)

    avatar_tasks = []
    for i, persona in enumerate(personas):
        if isinstance(persona, dict) and "name" in persona and "role" in persona:
            persona_id = persona.get("id") or persona.get("persona_id")
            logger.info(f"[AVATAR] Creating avatar task for persona {i+1}: {persona.get('name', 'Unknown')}")
            task = generate_with_semaphore(
                persona.get("name", ""),
                persona.get("role", ""),
                persona.get("background", ""),
                persona_id
            )
            avatar_tasks.append(task)
        else:
            logger.warning(f"[AVATAR] Skipping invalid persona {i+1}: {persona}")
            async def empty_task():
                return ""
            avatar_tasks.append(empty_task())

    # Wait for all avatar generations to complete
    logger.info(f"[AVATAR] Waiting for {len(avatar_tasks)} avatar generation tasks...")
    avatar_urls = await asyncio.gather(*avatar_tasks, return_exceptions=True)

    # Update personas with avatar URLs (using image_url to match database schema)
    for i, persona in enumerate(personas):
        if isinstance(persona, dict):
            avatar_url = avatar_urls[i] if i < len(avatar_urls) and not isinstance(avatar_urls[i], Exception) else ""
            persona["image_url"] = avatar_url
            # Also set avatar_url for backwards compatibility
            if avatar_url:
                persona["avatar_url"] = avatar_url
            if isinstance(avatar_urls[i], Exception):
                logger.error(f"[AVATAR] Persona {i+1}: {persona.get('name', 'Unknown')} - Avatar FAILED: {avatar_urls[i]}")
            else:
                logger.info(f"[AVATAR] Persona {i+1}: {persona.get('name', 'Unknown')} - Avatar: {'Generated' if avatar_url else 'Failed'}")

    return personas
