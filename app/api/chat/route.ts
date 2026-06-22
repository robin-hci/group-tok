import {
  addChatMessage,
  addChatMessageByName,
  getChatData,
  joinChat,
} from "@/lib/chat-store";

export async function GET() {
  const data = await getChatData();

  return Response.json(data);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      type?: "join" | "message";
      name?: string;
      participantId?: string;
      body?: string;
    };

    if (payload.type === "join") {
      const data = await joinChat(payload.name ?? "");

      return Response.json(data);
    }

    if (payload.type === "message") {
      if (payload.name) {
        const data = await addChatMessageByName(payload.name, payload.body ?? "");

        return Response.json(data);
      }

      const data = await addChatMessage(
        payload.participantId ?? "",
        payload.body ?? "",
      );

      return Response.json(data);
    }

    return Response.json({ error: "Unsupported chat action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Chat request failed." },
      { status: 400 },
    );
  }
}
