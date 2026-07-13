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
IMAGE_MODEL = "gpt-image-1-mini"  # supports transparent backgrounds (gpt-image-2 does not)
IMAGE_QUALITY = "high"
PERSONA_IMAGE_SIZE = "1024x1024"
SCENE_IMAGE_SIZE = "1536x1024"  # landscape environment / backdrop
IMAGE_SIZE = PERSONA_IMAGE_SIZE  # backward-compatible default
MAX_CONCURRENT_IMAGES = 10  # Limit concurrent image generations for scenes

# Global semaphore for image generation rate limiting (scenes) - lazily initialized
_image_semaphore: Optional[asyncio.Semaphore] = None

# Log configuration on module load
logger.info(f"[IMAGE] OpenAI image configuration loaded: model={IMAGE_MODEL}, API Key available = {bool(OPENAI_API_KEY)}")

# Visual cues for Big Five traits (1–10) — used to shape expression, posture, and styling
_VISUAL_TRAIT_CUES: Dict[str, Dict[str, str]] = {
    "openness": {
        "very low": "conventional, practical look",
        "low": "understated, traditional styling",
        "moderate": "balanced everyday appearance",
        "high": "curious expression, slightly creative or expressive styling",
        "very high": "imaginative presence, unconventional or artistic styling cues",
    },
    "conscientiousness": {
        "very low": "casual, loosely put-together look",
        "low": "relaxed, informal grooming",
        "moderate": "neat but not rigid presentation",
        "high": "polished, intentional grooming and outfit",
        "very high": "immaculately put-together, precise appearance",
    },
    "extraversion": {
        "very low": "reserved posture, quiet closed-off energy",
        "low": "soft presence, restrained expression",
        "moderate": "approachable, natural demeanor",
        "high": "open body language, engaging warm expression",
        "very high": "confident, animated, highly expressive presence",
    },
    "agreeableness": {
        "very low": "sharp, assertive expression; competitive edge",
        "low": "candid, firm look; not overly soft",
        "moderate": "friendly but grounded expression",
        "high": "warm, empathetic, inviting expression",
        "very high": "very kind, gentle, accommodating face",
    },
    "neuroticism": {
        "very low": "very calm, steady, unflappable composure",
        "low": "composed, relaxed facial tension",
        "moderate": "generally steady expression",
        "high": "subtle tension or worry in the eyes",
        "very high": "visibly anxious or emotionally reactive look",
    },
}


def _big_five_score_to_level(score: int) -> str:
    """Convert a 1–10 Big Five score to a descriptive level label."""
    if score <= 2:
        return "very low"
    if score <= 4:
        return "low"
    if score <= 6:
        return "moderate"
    if score <= 8:
        return "high"
    return "very high"


def _personality_visual_cues(personality_traits: Optional[Dict[str, Any]]) -> str:
    """
    Turn Big Five personality_traits into short visual descriptors for the image prompt.
    Falls back gracefully if traits are missing or malformed.
    """
    if not isinstance(personality_traits, dict) or not personality_traits:
        return ""

    cues: List[str] = []
    for trait, levels in _VISUAL_TRAIT_CUES.items():
        raw = personality_traits.get(trait)
        if raw is None:
            continue
        try:
            score = int(raw)
        except (TypeError, ValueError):
            continue
        level = _big_five_score_to_level(max(1, min(10, score)))
        cues.append(levels[level])

    return "; ".join(cues)


def _build_persona_avatar_prompt(
    persona_name: str,
    persona_role: str,
    personality_traits: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Build a role-aware waist-up portrait prompt (not forced corporate/professional).
    """
    role = (persona_role or "person").strip() or "person"
    name = (persona_name or "the subject").strip() or "the subject"
    cues = _personality_visual_cues(personality_traits)

    prompt = (
        f"Waist-up portrait of {name}, who is a {role}. "
        f"Show head, shoulders, and torso down to the waist. "
        f"Clothing, grooming, and overall look should naturally fit someone in the role of {role} — "
        f"do not default to a corporate business suit unless the role itself implies that. "
    )
    if cues:
        prompt += f"Let their personality show through expression, posture, and styling: {cues}. "
    prompt += (
        "Photorealistic portrait of a single person, isolated subject, "
        "transparent background, no text, no watermark, no border."
    )
    return prompt[:700]


def _build_scene_background_prompt(scene_title: str, scene_description: str) -> str:
    """
    Build a first-person landscape environment prompt for a simulation scene backdrop.
    """
    title = (scene_title or "Scene").strip() or "Scene"
    description = (scene_description or "").strip()
    # Keep enough scene detail without blowing the prompt budget
    detail = description[:280] if description else "an immersive setting that matches the scene title"

    return (
        f"Wide landscape environment background for a scene titled \"{title}\". "
        f"First-person point of view of the space a participant would see while standing in this scene: {detail}. "
        f"This is a backdrop / establishing environment shot — empty of people by default. "
        f"Do not include people, faces, crowds, or human figures unless the scene description "
        f"explicitly requires them (for example a crowded plaza, busy market, or packed auditorium). "
        f"Photorealistic, cinematic wide-angle, atmosphere and place over characters, "
        f"no text, no UI, no watermark, no border."
    )[:700]


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


async def _generate_and_store_image(
    prompt: str,
    s3_key_prefix: str,
    label: str,
    *,
    background: Optional[str] = None,
    size: Optional[str] = None,
) -> str:
    """
    Generate an image with the OpenAI GPT Image API and upload it to S3.

    Args:
        prompt: Image generation prompt
        s3_key_prefix: S3 key prefix (e.g. "generated/avatars")
        label: Human-readable label for logging
        background: Optional Images API background mode ("transparent" or "opaque").
            Only personas should use transparent; scene images leave this unset/opaque.
        size: Optional image size override (defaults to IMAGE_SIZE / persona square).

    Returns:
        Permanent S3 URL, or empty string on failure.
    """
    start_time = time.time()

    if not OPENAI_API_KEY:
        logger.error(f"[IMAGE] OpenAI API key not configured (while generating {label})")
        return ""

    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)

        generate_kwargs: Dict[str, Any] = {
            "model": IMAGE_MODEL,
            "prompt": prompt,
            "size": size or IMAGE_SIZE,
            "quality": IMAGE_QUALITY,
            "n": 1,
        }
        if background:
            generate_kwargs["background"] = background

        # GPT Image models return base64 data (no URL) - blocking call in executor
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda kwargs=generate_kwargs: client.images.generate(**kwargs),
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
    Generate a first-person landscape environment image for a scene.

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
        image_prompt = _build_scene_background_prompt(scene_title, scene_description)
        return await _generate_and_store_image(
            image_prompt,
            "generated/scenes",
            f"scene image '{scene_title}'",
            size=SCENE_IMAGE_SIZE,
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
    persona_id: Optional[int] = None,
    personality_traits: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a waist-up persona portrait using OpenAI's GPT Image API.
    Internal function without semaphore - use via generate_personas_with_avatars.

    Args:
        persona_name: Name of the persona
        persona_role: Role/title (used to style clothing and look appropriately)
        background: Unused legacy bio field (kept for call-site compatibility)
        persona_id: Optional persona ID (for reference, not used for upload here)
        personality_traits: Optional Big Five traits dict (1–10 scores)

    Returns:
        Permanent S3 URL of the generated avatar, or empty string on failure.
    """
    logger.info(f"[AVATAR] Generating avatar for persona: {persona_name} ({persona_role})")

    avatar_prompt = _build_persona_avatar_prompt(
        persona_name=persona_name,
        persona_role=persona_role,
        personality_traits=personality_traits,
    )
    # background (bio) is intentionally not injected — it biased looks toward corporate/neutral scenes

    logger.info(f"[AVATAR] Prompt: {avatar_prompt}")

    return await _generate_and_store_image(
        avatar_prompt,
        "generated/avatars",
        f"avatar '{persona_name}'",
        background="transparent",
    )


async def generate_personas_with_avatars(personas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate avatar images for multiple personas in parallel using OpenAI's GPT Image API.

    Args:
        personas: List of persona dictionaries with 'name', 'role', and optionally
            'personality_traits' (Big Five) / 'background'

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
    async def generate_with_semaphore(
        persona_name: str,
        persona_role: str,
        background: str,
        persona_id: Optional[int] = None,
        personality_traits: Optional[Dict[str, Any]] = None,
    ) -> str:
        async with persona_semaphore:
            return await _generate_persona_avatar_unsafe(
                persona_name,
                persona_role,
                background,
                persona_id,
                personality_traits,
            )

    avatar_tasks = []
    for i, persona in enumerate(personas):
        if isinstance(persona, dict) and "name" in persona and "role" in persona:
            persona_id = persona.get("id") or persona.get("persona_id")
            traits = persona.get("personality_traits") or persona.get("traits") or {}
            logger.info(f"[AVATAR] Creating avatar task for persona {i+1}: {persona.get('name', 'Unknown')}")
            task = generate_with_semaphore(
                persona.get("name", ""),
                persona.get("role", ""),
                persona.get("background", ""),
                persona_id,
                traits if isinstance(traits, dict) else {},
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
