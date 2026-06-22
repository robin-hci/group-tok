export type ChatParticipant = {
  id: string;
  name: string;
  color: string;
  joinedAt: string;
};

export type ChatMessage = {
  id: string;
  participantId: string;
  body: string;
  createdAt: string;
};

export type ChatData = {
  participants: ChatParticipant[];
  messages: ChatMessage[];
};

export type ChatSnapshot = ChatData & {
  activeParticipant?: ChatParticipant;
};
