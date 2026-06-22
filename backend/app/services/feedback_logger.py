from datetime import datetime, timezone

from app.schemas.chat import ChatData
from app.schemas.intervention import FeedbackSnapshot, Intervention


EMOJI_MARKERS = {"❤️", "💙", "💚", "💛", "👍", "😂", "🙂", "🔥", "✨"}


def _parse_time(value: str) -> datetime | None:
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def summarize_feedback(chat: ChatData, intervention: Intervention | None) -> FeedbackSnapshot | None:
    if intervention is None:
        return None

    intervention_time = _parse_time(intervention.sent_at or intervention.created_at)
    if intervention_time is None:
        return None

    total_participants = len(chat.participants)
    messages_after = []
    messages_before = []
    for message in chat.messages:
        message_time = _parse_time(message.createdAt)
        if message_time is None:
            continue
        if message_time >= intervention_time:
            messages_after.append(message)
        else:
            messages_before.append(message)
    participant_ids = {message.participantId for message in messages_after}
    previous_speaker_ids = {message.participantId for message in messages_before}
    first_time_speaker_count = len(participant_ids - previous_speaker_ids)
    emoji_count = sum(
        sum(marker in message.body for marker in EMOJI_MARKERS)
        for message in messages_after
    )
    participation_rate = (
        round(len(participant_ids) / total_participants, 2)
        if total_participants
        else 0
    )
    completion_status = "watching"
    if len(messages_after) >= 5 or participation_rate >= 0.35:
        completion_status = "active_response"
    elif len(messages_after) == 0:
        completion_status = "no_response_yet"

    return FeedbackSnapshot(
        intervention_id=intervention.id,
        participant_count=len(participant_ids),
        message_count=len(messages_after),
        first_time_speaker_count=first_time_speaker_count,
        emoji_count=emoji_count,
        participation_rate=participation_rate,
        completion_status=completion_status,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
