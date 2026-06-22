import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChatData, ChatMessage, ChatParticipant } from "@/lib/chat-types";

const chatFilePath = path.join(process.cwd(), "data", "chat.json");

const participantColors = [
  "#2563eb",
  "#db2777",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
];

function fallbackData(): ChatData {
  return {
    participants: [],
    messages: [],
  };
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

async function readChatData(): Promise<ChatData> {
  try {
    const raw = await readFile(chatFilePath, "utf8");
    return JSON.parse(raw) as ChatData;
  } catch {
    return fallbackData();
  }
}

async function writeChatData(data: ChatData) {
  await writeFile(chatFilePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getChatData() {
  return readChatData();
}

export async function joinChat(name: string) {
  const cleanName = name.trim().slice(0, 32);

  if (!cleanName) {
    throw new Error("Name is required.");
  }

  const data = await readChatData();
  const existingParticipant = data.participants.find(
    (participant) => participant.name.toLowerCase() === cleanName.toLowerCase(),
  );

  if (existingParticipant) {
    return {
      ...data,
      activeParticipant: existingParticipant,
    };
  }

  const participant: ChatParticipant = {
    id: createId("participant"),
    name: cleanName,
    color: participantColors[data.participants.length % participantColors.length],
    joinedAt: new Date().toISOString(),
  };

  const nextData = {
    ...data,
    participants: [...data.participants, participant],
  };

  await writeChatData(nextData);

  return {
    ...nextData,
    activeParticipant: participant,
  };
}

function findParticipantByName(data: ChatData, name: string) {
  return data.participants.find(
    (participant) => participant.name.toLowerCase() === name.toLowerCase(),
  );
}

function createParticipant(data: ChatData, name: string): ChatParticipant {
  return {
    id: createId("participant"),
    name,
    color: participantColors[data.participants.length % participantColors.length],
    joinedAt: new Date().toISOString(),
  };
}

export async function addChatMessage(participantId: string, body: string) {
  const cleanBody = body.trim().slice(0, 1000);

  if (!participantId || !cleanBody) {
    throw new Error("Participant and message body are required.");
  }

  const data = await readChatData();
  const participant = data.participants.find((item) => item.id === participantId);

  if (!participant) {
    throw new Error("Participant was not found.");
  }

  const message: ChatMessage = {
    id: createId("message"),
    participantId,
    body: cleanBody,
    createdAt: new Date().toISOString(),
  };

  const nextData = {
    ...data,
    messages: [...data.messages, message],
  };

  await writeChatData(nextData);

  return {
    ...nextData,
    activeParticipant: participant,
  };
}

export async function addChatMessageByName(name: string, body: string) {
  const cleanName = name.trim().slice(0, 32);
  const cleanBody = body.trim().slice(0, 1000);

  if (!cleanName || !cleanBody) {
    throw new Error("Name and message body are required.");
  }

  const data = await readChatData();
  const participant =
    findParticipantByName(data, cleanName) ?? createParticipant(data, cleanName);
  const participants = data.participants.some((item) => item.id === participant.id)
    ? data.participants
    : [...data.participants, participant];
  const message: ChatMessage = {
    id: createId("message"),
    participantId: participant.id,
    body: cleanBody,
    createdAt: new Date().toISOString(),
  };
  const nextData = {
    participants,
    messages: [...data.messages, message],
  };

  await writeChatData(nextData);

  return {
    ...nextData,
    activeParticipant: participant,
  };
}
