from __future__ import annotations

import json
import re
from typing import Any

from app.config import get_settings
from app.schemas.activity import Activity
from app.schemas.chat import ChatData
from app.schemas.group_context import GroupContext
from app.schemas.intervention import FeedbackSnapshot, Intervention
from app.services.gemini_client import GeminiClient


class GeminiOutputError(RuntimeError):
    pass


class GeminiAgent:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = GeminiClient()

    def _prompt(self, name: str) -> str:
        path = self.settings.prompt_dir / name
        return path.read_text(encoding="utf-8")

    def _generate_json(self, prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        text = self.client.generate_text(
            f"{prompt}\n\nInput JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\nReturn JSON only."
        )
        match = re.search(r"\{.*\}", text, re.DOTALL)

        if not match:
            raise GeminiOutputError(
                "Gemini response did not contain a JSON object.")

        try:
            result = json.loads(match.group(0))
        except json.JSONDecodeError as error:
            raise GeminiOutputError(
                "Gemini response was not valid JSON.") from error

        if not isinstance(result, dict):
            raise GeminiOutputError("Gemini JSON response must be an object.")

        return result

    def model_context(self, chat: ChatData) -> GroupContext:
        result = self._generate_json(
            self._prompt("group_context_modeler.md"),
            {"chat": chat.model_dump(mode="json")},
        )

        try:
            return GroupContext.model_validate(result)
        except Exception as error:
            raise GeminiOutputError(
                "Gemini Group Context output failed schema validation.") from error

    def select_activities(
        self,
        context: GroupContext,
        activities: list[Activity],
        limit: int = 3,
    ) -> list[Activity]:
        result = self._generate_json(
            self._prompt("activity_retriever.md"),
            {
                "system_overview": self._prompt("system_overview.md"),
                "group_context": context.model_dump(mode="json"),
                "activity_library": [activity.model_dump(mode="json") for activity in activities],
            },
        )
        ranked_ids = result.get("ranked_activity_ids")

        if not isinstance(ranked_ids, list):
            raise GeminiOutputError(
                "Gemini activity retrieval output must include ranked_activity_ids.")

        activities_by_id = {activity.id: activity for activity in activities}
        selected = [
            activities_by_id[activity_id]
            for activity_id in ranked_ids
            if isinstance(activity_id, str) and activity_id in activities_by_id
        ]

        if not selected:
            raise GeminiOutputError(
                "Gemini did not select any known activity IDs.")

        return selected[:limit]

    def decide_intervention_timing(
        self,
        chat: ChatData,
        context: GroupContext,
        activities: list[Activity],
        active_intervention: Intervention | None,
    ) -> dict[str, Any]:
        result = self._generate_json(
            self._prompt("intervention_timing.md"),
            {
                "system_overview": self._prompt("system_overview.md"),
                "chat": chat.model_dump(mode="json"),
                "group_context": context.model_dump(mode="json"),
                "activity_library": [
                    activity.model_dump(mode="json") for activity in activities
                ],
                "active_intervention": (
                    active_intervention.model_dump(mode="json")
                    if active_intervention
                    else None
                ),
            },
        )

        if "should_start" not in result or "reason" not in result:
            raise GeminiOutputError(
                "Gemini timing output must include should_start and reason.")

        return result

    def adapt_activity(
        self,
        activity: Activity,
        context: GroupContext,
    ) -> dict[str, Any]:
        result = self._generate_json(
            self._prompt("activity_adapter.md"),
            {
                "system_overview": self._prompt("system_overview.md"),
                "activity": activity.model_dump(mode="json"),
                "group_context": context.model_dump(mode="json"),
            },
        )
        required_keys = ["adapted_title", "adapter_notes",
                         "chat_steps", "participation_mode"]
        missing_keys = [key for key in required_keys if key not in result]

        if missing_keys:
            raise GeminiOutputError(
                f"Gemini activity adaptation output is missing: {', '.join(missing_keys)}."
            )

        return result

    def generate_intervention(
        self,
        activity: Activity,
        context: GroupContext,
        adaptation: dict[str, Any],
    ) -> dict[str, Any]:
        result = self._generate_json(
            self._prompt("intervention_generator.md"),
            {
                "system_overview": self._prompt("system_overview.md"),
                "activity": activity.model_dump(mode="json"),
                "group_context": context.model_dump(mode="json"),
                "adaptation": adaptation,
            },
        )
        required_keys = [
            "adapted_title",
            "recommendation_reason",
            "adapter_notes",
            "card_text",
            "facilitation_plan",
            "reminder_text",
            "closing_text",
            "offline_suggestion_text",
        ]
        missing_keys = [key for key in required_keys if key not in result]

        if missing_keys:
            raise GeminiOutputError(
                f"Gemini intervention output is missing: {', '.join(missing_keys)}."
            )

        return result

    def decide_facilitation_action(
        self,
        chat: ChatData,
        context: GroupContext,
        intervention: Intervention,
        feedback: FeedbackSnapshot | None,
    ) -> dict[str, Any]:
        result = self._generate_json(
            self._prompt("facilitation_layer.md"),
            {
                "system_overview": self._prompt("system_overview.md"),
                "chat": chat.model_dump(mode="json"),
                "group_context": context.model_dump(mode="json"),
                "intervention": intervention.model_dump(mode="json"),
                "feedback": feedback.model_dump(mode="json") if feedback else None,
            },
        )
        action = result.get("action")

        if action not in {"none", "reminder", "closing"}:
            raise GeminiOutputError(
                "Gemini facilitation output has an invalid action.")

        return result
