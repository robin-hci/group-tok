from app.schemas.chat import ChatData

SYSTEM_PARTICIPANT_NAMES = {"grouptok"}


def exclude_system_participants(chat: ChatData) -> ChatData:
    system_participant_ids = {
        participant.id
        for participant in chat.participants
        if participant.name.strip().lower() in SYSTEM_PARTICIPANT_NAMES
    }

    return ChatData(
        participants=[
            participant
            for participant in chat.participants
            if participant.id not in system_participant_ids
        ],
        messages=[
            message
            for message in chat.messages
            if message.participantId not in system_participant_ids
        ],
    )
