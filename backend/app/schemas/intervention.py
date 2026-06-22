from pydantic import BaseModel, Field

from app.schemas.activity import Activity
from app.schemas.group_context import GroupContext


class Intervention(BaseModel):
    id: str
    activity_id: str
    activity_title: str
    risk_level: str
    adapted_title: str
    recommendation_reason: str = ""
    adapter_notes: str
    card_text: str
    facilitation_plan: list[str] = Field(default_factory=list)
    reminder_text: str = ""
    closing_text: str = ""
    offline_suggestion_text: str = ""
    status: str = "ready_to_send"
    created_at: str
    sent_at: str | None = None
    completed_at: str | None = None
    reminder_count: int = 0
    last_action_at: str | None = None


class FacilitationAction(BaseModel):
    type: str = "none"
    intervention_id: str | None = None
    message: str = ""
    reason: str = ""


class FeedbackSnapshot(BaseModel):
    intervention_id: str
    participant_count: int = 0
    message_count: int = 0
    first_time_speaker_count: int = 0
    emoji_count: int = 0
    participation_rate: float = 0
    completion_status: str = "watching"
    updated_at: str


class OpsState(BaseModel):
    group_context: GroupContext
    retrieved_activities: list[Activity] = Field(default_factory=list)
    selected_activity: Activity | None = None
    intervention: Intervention | None = None
    feedback: FeedbackSnapshot | None = None
    facilitation_action: FacilitationAction = Field(default_factory=FacilitationAction)
    pipeline_events: list[str] = Field(default_factory=list)
