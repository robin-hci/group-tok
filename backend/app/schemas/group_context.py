from pydantic import BaseModel, Field


class GroupSignals(BaseModel):
    recent_message_count: int = 0
    active_participant_count: int = 0
    total_participant_count: int = 0
    first_time_speaker_count: int = 0
    silence_duration_minutes: int | None = None
    question_answer_flow: str = "weak"


class InterventionReadiness(BaseModel):
    status: str = "wait"
    reason: str
    cautions: list[str] = Field(default_factory=list)


class GroupContext(BaseModel):
    summary: str
    state: str
    group_stage: str
    participation_level: str
    energy_level: str
    familiarity_level: str
    fatigue_level: str
    recommended_risk_level: str
    recent_topics: list[str] = Field(default_factory=list)
    signals: GroupSignals
    rationale: str
    intervention_readiness: InterventionReadiness
    updated_at: str | None = None
