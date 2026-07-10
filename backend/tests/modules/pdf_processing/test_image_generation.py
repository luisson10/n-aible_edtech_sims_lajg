"""
Tests for image generation service.
"""
import base64
import pytest
from unittest.mock import Mock, patch, AsyncMock
from modules.pdf_processing.image_generation_service import (
    generate_scene_image,
    generate_scenes_with_images,
    generate_personas_with_avatars,
    _generate_persona_avatar_unsafe,
    _generate_and_store_image,
    OPENAI_API_KEY,
    IMAGE_MODEL,
    IMAGE_QUALITY,
)


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI GPT Image response (base64 payload)"""
    mock_response = Mock()
    mock_data = Mock()
    mock_data.b64_json = base64.b64encode(b"fake-png-bytes").decode()
    mock_response.data = [mock_data]
    return mock_response


@pytest.fixture
def mock_settings(monkeypatch):
    """Mock settings with API keys"""
    monkeypatch.setattr('modules.pdf_processing.image_generation_service.OPENAI_API_KEY', 'test-openai-key')


@pytest.mark.asyncio
async def test_generate_and_store_image_success(mock_settings, mock_openai_response):
    """Test image generation uploads decoded bytes to S3 and returns the S3 URL"""
    with patch('openai.OpenAI') as mock_openai:
        mock_client = Mock()
        mock_client.images.generate = Mock(return_value=mock_openai_response)
        mock_openai.return_value = mock_client

        with patch('common.services.s3_service.s3_service.upload_from_bytes',
                   new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/abc.png"

            result = await _generate_and_store_image("a portrait", "generated/avatars", "test image")

            assert result == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/abc.png"
            uploaded_bytes, s3_key, content_type = mock_upload.call_args[0]
            assert uploaded_bytes == b"fake-png-bytes"
            assert s3_key.startswith("generated/avatars/")
            assert s3_key.endswith(".png")
            assert content_type == "image/png"

            call_kwargs = mock_client.images.generate.call_args[1]
            assert call_kwargs["model"] == IMAGE_MODEL
            assert call_kwargs["quality"] == IMAGE_QUALITY


@pytest.mark.asyncio
async def test_generate_and_store_image_s3_failure(mock_settings, mock_openai_response):
    """Test generation returns empty string when the S3 upload fails"""
    with patch('openai.OpenAI') as mock_openai:
        mock_client = Mock()
        mock_client.images.generate = Mock(return_value=mock_openai_response)
        mock_openai.return_value = mock_client

        with patch('common.services.s3_service.s3_service.upload_from_bytes',
                   new_callable=AsyncMock) as mock_upload:
            mock_upload.return_value = None

            result = await _generate_and_store_image("a portrait", "generated/avatars", "test image")
            assert result == ""


@pytest.mark.asyncio
async def test_generate_and_store_image_openai_error(mock_settings):
    """Test generation handles OpenAI errors gracefully"""
    with patch('openai.OpenAI') as mock_openai:
        mock_client = Mock()
        mock_client.images.generate = Mock(side_effect=Exception("API Error"))
        mock_openai.return_value = mock_client

        result = await _generate_and_store_image("a portrait", "generated/scenes", "test image")
        assert result == ""


@pytest.mark.asyncio
async def test_generate_scene_image_no_api_key(monkeypatch):
    """Test scene image generation fails gracefully when API key is missing"""
    monkeypatch.setattr('modules.pdf_processing.image_generation_service.OPENAI_API_KEY', None)

    result = await generate_scene_image(
        scene_description="A business meeting room",
        scene_title="Team Meeting"
    )

    assert result == ""


@pytest.mark.asyncio
async def test_generate_scene_image_success(mock_settings):
    """Test scene image generation builds a prompt and stores via the shared helper"""
    with patch('modules.pdf_processing.image_generation_service._generate_and_store_image',
               new_callable=AsyncMock) as mock_store:
        mock_store.return_value = "https://n-aible.s3.us-east-2.amazonaws.com/generated/scenes/xyz.png"

        result = await generate_scene_image(
            scene_description="A business meeting room",
            scene_title="Team Meeting",
            simulation_id=1,
            scene_id=100
        )

        assert result == "https://n-aible.s3.us-east-2.amazonaws.com/generated/scenes/xyz.png"
        prompt, prefix, _ = mock_store.call_args[0]
        assert "Team Meeting" in prompt
        assert prefix == "generated/scenes"


@pytest.mark.asyncio
async def test_generate_scenes_with_images(mock_settings):
    """Test generating images for multiple scenes"""
    scenes = [
        {"title": "Scene 1", "description": "First scene", "id": 1},
        {"title": "Scene 2", "description": "Second scene", "id": 2}
    ]

    with patch('modules.pdf_processing.image_generation_service.generate_scene_image') as mock_generate:
        mock_generate.return_value = "https://example.com/image.jpg"

        result = await generate_scenes_with_images(scenes, simulation_id=1)

        assert len(result) == 2
        assert result[0]["image_url"] == "https://example.com/image.jpg"
        assert result[1]["image_url"] == "https://example.com/image.jpg"
        assert mock_generate.call_count == 2


@pytest.mark.asyncio
async def test_generate_scenes_with_images_empty_list():
    """Test generating images for empty scene list"""
    result = await generate_scenes_with_images([])
    assert result == []


@pytest.mark.asyncio
async def test_generate_scenes_with_images_invalid_scenes():
    """Test generating images handles invalid scene data"""
    scenes = [
        {"invalid": "data"},
        {"title": "Valid Scene", "description": "Description"}
    ]

    with patch('modules.pdf_processing.image_generation_service.generate_scene_image') as mock_generate:
        mock_generate.return_value = "https://example.com/image.jpg"

        result = await generate_scenes_with_images(scenes)

        assert len(result) == 2
        # Invalid scene should have empty image_url
        assert result[0].get("image_url") == ""
        # Valid scene should have image URL
        assert result[1]["image_url"] == "https://example.com/image.jpg"


@pytest.mark.asyncio
async def test_generate_personas_with_avatars_empty_list():
    """Test generating avatars for empty persona list"""
    result = await generate_personas_with_avatars([])
    assert result == []


@pytest.mark.asyncio
async def test_generate_personas_with_avatars_no_api_key(monkeypatch):
    """Test persona avatar generation fails gracefully when API key is missing"""
    monkeypatch.setattr('modules.pdf_processing.image_generation_service.OPENAI_API_KEY', None)

    personas = [
        {"name": "John Doe", "role": "CEO", "background": "Experienced leader"}
    ]

    result = await generate_personas_with_avatars(personas)

    assert len(result) == 1
    assert result[0].get("image_url") == ""


@pytest.mark.asyncio
async def test_generate_persona_avatar_unsafe_success(mock_settings):
    """Test successful persona avatar generation via OpenAI"""
    with patch('modules.pdf_processing.image_generation_service._generate_and_store_image',
               new_callable=AsyncMock) as mock_store:
        mock_store.return_value = "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/abc.png"

        result = await _generate_persona_avatar_unsafe(
            persona_name="John Doe",
            persona_role="CEO",
            background="Experienced leader"
        )

        assert result == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/abc.png"
        prompt, prefix, _ = mock_store.call_args[0]
        assert "John Doe" in prompt
        assert "CEO" in prompt
        assert "Experienced leader" in prompt
        assert prefix == "generated/avatars"


@pytest.mark.asyncio
async def test_generate_persona_avatar_unsafe_no_api_key(monkeypatch):
    """Test persona avatar generation fails when API key is missing"""
    monkeypatch.setattr('modules.pdf_processing.image_generation_service.OPENAI_API_KEY', None)

    result = await _generate_persona_avatar_unsafe(
        persona_name="John Doe",
        persona_role="CEO"
    )

    assert result == ""


@pytest.mark.asyncio
async def test_generate_personas_with_avatars_success(mock_settings):
    """Test generating avatars for multiple personas"""
    personas = [
        {"name": "John Doe", "role": "CEO", "background": "Experienced leader", "id": 1},
        {"name": "Jane Smith", "role": "CFO", "background": "Financial expert", "id": 2}
    ]

    with patch('modules.pdf_processing.image_generation_service._generate_persona_avatar_unsafe') as mock_generate:
        mock_generate.return_value = "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"

        result = await generate_personas_with_avatars(personas)

        assert len(result) == 2
        assert result[0]["image_url"] == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"
        assert result[1]["image_url"] == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"
        assert result[0]["avatar_url"] == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"  # Backwards compatibility


@pytest.mark.asyncio
async def test_generate_personas_with_avatars_invalid_personas():
    """Test generating avatars handles invalid persona data"""
    personas = [
        {"invalid": "data"},
        {"name": "John Doe", "role": "CEO"}
    ]

    with patch('modules.pdf_processing.image_generation_service._generate_persona_avatar_unsafe') as mock_generate:
        mock_generate.return_value = "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"

        result = await generate_personas_with_avatars(personas)

        assert len(result) == 2
        # Invalid persona should have empty image_url
        assert result[0].get("image_url") == ""
        # Valid persona should have image URL
        assert result[1]["image_url"] == "https://n-aible.s3.us-east-2.amazonaws.com/generated/avatars/a.png"


@pytest.mark.asyncio
async def test_generate_personas_with_avatars_api_error(mock_settings):
    """Test generating avatars handles API errors gracefully"""
    personas = [
        {"name": "John Doe", "role": "CEO"}
    ]

    with patch('modules.pdf_processing.image_generation_service._generate_persona_avatar_unsafe') as mock_generate:
        mock_generate.return_value = ""  # Empty string on error

        result = await generate_personas_with_avatars(personas)

        assert len(result) == 1
        assert result[0]["image_url"] == ""
