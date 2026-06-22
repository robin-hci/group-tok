from pydantic import BaseModel, Field


class ChatParticipant(BaseModel):
    id: str
    name: str
    color: str
    joinedAt: str


class ChatMessage(BaseModel):
    id: str
    participantId: str
    body: str
    createdAt: str


class ChatData(BaseModel):
    participants: list[ChatParticipant] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(default_factory=list)
