from __future__ import annotations

from app.config import get_settings


class GeminiConfigurationError(RuntimeError):
    pass


class GeminiGenerationError(RuntimeError):
    pass


class GeminiClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.gemini_api_key:
            raise GeminiConfigurationError(
                "GEMINI_API_KEY is required to run GroupTok."
            )

        try:
            from google import genai

            self._client = genai.Client(api_key=self.settings.gemini_api_key)
        except Exception as error:
            raise GeminiConfigurationError(
                "Gemini client could not be initialized."
            ) from error

    @property
    def available(self) -> bool:
        return True

    def generate_text(self, prompt: str) -> str:
        try:
            response = self._client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
            )
            text = getattr(response, "text", None)
        except Exception as error:
            raise GeminiGenerationError("Gemini generation request failed.") from error

        if not text:
            raise GeminiGenerationError("Gemini returned an empty response.")

        return text
