from pydantic import BaseModel, Field


class Activity(BaseModel):
    id: str
    title: str
    source: str
    risk_level: str
    group_stages: list[str] = Field(default_factory=list)
    duration_minutes: int = 5
    materials: list[str] = Field(default_factory=list)
    original_format: str = "offline"
    participation_modes: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    instructions: str
    online_adaptation_notes: str = ""
    facilitation_notes: str = ""
