import json
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel, TypeAdapter

from app.config import get_settings
from app.schemas.activity import Activity
from app.schemas.chat import ChatData
from app.schemas.group_context import GroupContext
from app.schemas.intervention import FeedbackSnapshot, Intervention

T = TypeVar("T", bound=BaseModel)


class JsonStore:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _read_json(self, path: Path, default_value: Any) -> Any:
        if not path.exists():
            return default_value
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def read_chat(self) -> ChatData:
        raw = self._read_json(self.settings.data_dir / "chat.json", {})
        return ChatData.model_validate(raw)

    def read_activities(self) -> list[Activity]:
        raw = self._read_json(
            self.settings.data_dir / "activities" / "ucsd-cba.seed.json",
            [],
        )
        return TypeAdapter(list[Activity]).validate_python(raw)

    def read_activity_candidates(self) -> list[Activity]:
        raw = self._read_json(self.settings.data_dir / "activity-candidates.json", [])
        return TypeAdapter(list[Activity]).validate_python(raw)

    def write_activity_candidates(self, activities: list[Activity]) -> None:
        self._write_json(
            self.settings.data_dir / "activity-candidates.json",
            [activity.model_dump(mode="json") for activity in activities],
        )

    def read_group_context(self) -> GroupContext:
        raw = self._read_json(self.settings.data_dir / "group-context.json", {})
        return GroupContext.model_validate(raw)

    def write_group_context(self, context: GroupContext) -> None:
        self._write_json(
            self.settings.data_dir / "group-context.json",
            context.model_dump(mode="json"),
        )

    def read_interventions(self) -> list[Intervention]:
        raw = self._read_json(self.settings.data_dir / "interventions.json", [])
        return TypeAdapter(list[Intervention]).validate_python(raw)

    def append_intervention(self, intervention: Intervention) -> None:
        interventions = self.read_interventions()
        interventions.append(intervention)
        self._write_json(
            self.settings.data_dir / "interventions.json",
            [item.model_dump(mode="json") for item in interventions],
        )

    def write_interventions(self, interventions: list[Intervention]) -> None:
        self._write_json(
            self.settings.data_dir / "interventions.json",
            [item.model_dump(mode="json") for item in interventions],
        )

    def update_intervention(self, intervention: Intervention) -> None:
        interventions = self.read_interventions()
        updated = [
            intervention if item.id == intervention.id else item
            for item in interventions
        ]
        self.write_interventions(updated)

    def read_feedback(self) -> list[FeedbackSnapshot]:
        raw = self._read_json(self.settings.data_dir / "feedback.json", [])
        return TypeAdapter(list[FeedbackSnapshot]).validate_python(raw)

    def append_feedback(self, feedback: FeedbackSnapshot) -> None:
        feedback_items = self.read_feedback()
        feedback_items.append(feedback)
        self._write_json(
            self.settings.data_dir / "feedback.json",
            [item.model_dump(mode="json") for item in feedback_items],
        )
