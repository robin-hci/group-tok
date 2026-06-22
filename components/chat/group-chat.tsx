"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatData, ChatMessage, ChatParticipant } from "@/lib/chat-types";
import { OpsPanel } from "@/components/grouptok/ops-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ChatResponse = ChatData & {
  activeParticipant?: ChatParticipant;
  error?: string;
};

type PipelineResponse = {
  facilitation_action?: {
    type: string;
    intervention_id: string | null;
    message: string;
  };
};

const lastSpeakerNameKey = "group-tok.lastSpeakerName";

function getInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ProfileDot({ participant }: { participant: ChatParticipant }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: participant.color }}
      aria-hidden="true"
    >
      {getInitials(participant.name)}
    </span>
  );
}

export function GroupChat() {
  const [chatData, setChatData] = useState<ChatData>({
    participants: [],
    messages: [],
  });
  const [speakerName, setSpeakerName] = useState("");
  const [lastParticipant, setLastParticipant] =
    useState<ChatParticipant | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [opsRefreshKey, setOpsRefreshKey] = useState(0);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const participantsById = useMemo(() => {
    return new Map(
      chatData.participants.map((participant) => [participant.id, participant]),
    );
  }, [chatData.participants]);

  const currentParticipant = useMemo(() => {
    return (
      chatData.participants.find(
        (participant) =>
          participant.name.toLowerCase() === speakerName.trim().toLowerCase(),
      ) ??
      lastParticipant ??
      null
    );
  }, [chatData.participants, lastParticipant, speakerName]);

  const loadChat = useCallback(async () => {
    const response = await fetch("/api/chat", { cache: "no-store" });
    const data = (await response.json()) as ChatData;
    const savedSpeakerName =
      window.localStorage.getItem(lastSpeakerNameKey) ?? "";
    const previousSpeaker =
      data.messages.length > 0
        ? data.participants.find(
            (item) =>
              item.id === data.messages[data.messages.length - 1].participantId,
          )
        : null;
    const initialSpeakerName = savedSpeakerName || previousSpeaker?.name || "";

    setChatData(data);
    setSpeakerName(initialSpeakerName);
    setLastParticipant(previousSpeaker ?? null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialChat() {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        const data = (await response.json()) as ChatData;
        const savedSpeakerName =
          window.localStorage.getItem(lastSpeakerNameKey) ?? "";
        const previousSpeaker =
          data.messages.length > 0
            ? data.participants.find(
                (item) =>
                  item.id ===
                  data.messages[data.messages.length - 1].participantId,
              )
            : null;
        const initialSpeakerName = savedSpeakerName || previousSpeaker?.name || "";

        if (isMounted) {
          setChatData(data);
          setSpeakerName(initialSpeakerName);
          setLastParticipant(previousSpeaker ?? null);
        }
      } catch {
        if (isMounted) {
          setError("채팅 기록을 불러오지 못했어요.");
        }
      }
    }

    void loadInitialChat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatData.messages.length]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!speakerName.trim()) {
      setError("메시지를 보낼 이름을 입력해주세요.");
      return;
    }

    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          name: speakerName,
          body: message,
        }),
      });
      const data = (await response.json()) as ChatResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "메시지를 저장하지 못했어요.");
      }

      setChatData({
        participants: data.participants,
        messages: data.messages,
      });
      if (data.activeParticipant) {
        setLastParticipant(data.activeParticipant);
        setSpeakerName(data.activeParticipant.name);
        window.localStorage.setItem(
          lastSpeakerNameKey,
          data.activeParticipant.name,
        );
      }
      setMessage("");
      fetch("/api/grouptok", { method: "POST" })
        .then(async (pipelineResponse) => {
          const pipelineData =
            (await pipelineResponse.json()) as PipelineResponse;
          const action = pipelineData.facilitation_action;

          if (
            action &&
            action.type !== "none" &&
            action.message &&
            action.intervention_id
          ) {
            await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "message",
                name: "GroupTok",
                body: action.message,
              }),
            });
            await fetch("/api/grouptok", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                intervention_id: action.intervention_id,
                action_type: action.type,
              }),
            });
            await loadChat();
          }

          setOpsRefreshKey((value) => value + 1);
        })
        .catch(() => {
          setOpsRefreshKey((value) => value + 1);
        });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "메시지를 저장하지 못했어요.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function renderMessage(item: ChatMessage) {
    const participant = participantsById.get(item.participantId);
    const isLastSpeaker = item.participantId === lastParticipant?.id;

    if (!participant) {
      return null;
    }

    return (
      <li
        key={item.id}
        className={`flex gap-3 px-5 py-2.5 ${isLastSpeaker ? "bg-emerald-50/70" : ""
          }`}
      >
        <ProfileDot participant={participant} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-950">
              {participant.name}
            </span>
            <span className="text-xs text-zinc-400">
              {formatMessageTime(item.createdAt)}
            </span>
          </div>
          <p className="mt-1 inline-block max-w-full rounded-md bg-white px-3 py-2 text-sm leading-6 text-zinc-800 shadow-sm ring-1 ring-zinc-200">
            {item.body}
          </p>
        </div>
      </li>
    );
  }

  return (
    <main className="flex min-h-screen bg-zinc-100 text-zinc-950">
      <section className="flex min-h-screen w-full max-w-[820px] border-r border-zinc-200 bg-white shadow-xl lg:w-[54vw]">
        <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-zinc-950 text-white sm:flex sm:flex-col">
          <div className="border-b border-white/10 px-4 py-4">
            <p className="text-sm font-semibold">group-tok</p>
            <p className="mt-1 text-xs text-zinc-400">
              {chatData.participants.length} participants
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              People
            </p>
            <div className="space-y-1">
              {chatData.participants.map((participant) => (
                <div
                  key={participant.id}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${participant.id === currentParticipant?.id
                    ? "bg-white/12 text-white"
                    : "text-zinc-300"
                    }`}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: participant.color }}
                  />
                  <span className="truncate">{participant.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b border-zinc-200 px-5">
            <div>
              <h1 className="text-base font-semibold"># simulation-room</h1>
              <p className="text-xs text-zinc-500">
                JSON 저장 기반 그룹톡 시뮬레이션
              </p>
            </div>
            {currentParticipant ? (
              <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1.5">
                <ProfileDot participant={currentParticipant} />
                <span className="max-w-28 truncate text-sm font-medium">
                  {currentParticipant.name}
                </span>
              </div>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto bg-zinc-50 py-3">
            {chatData.messages.length > 0 ? (
              <ul>{chatData.messages.map(renderMessage)}</ul>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                아직 메시지가 없어요. 이름과 메시지를 입력해 첫 대화를 남겨보세요.
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form
            onSubmit={submitMessage}
            className="border-t border-zinc-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <label
                htmlFor="speaker-name"
                className="shrink-0 text-sm font-medium text-zinc-700"
              >
                보낸 사람
              </label>
              <Input
                id="speaker-name"
                value={speakerName}
                onChange={(event) => setSpeakerName(event.target.value)}
                placeholder="예: Robin"
                className="h-9 max-w-48"
                maxLength={32}
                list="participants"
              />
              <datalist id="participants">
                {chatData.participants.map((participant) => (
                  <option key={participant.id} value={participant.name} />
                ))}
              </datalist>
              {currentParticipant ? (
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: currentParticipant.color }}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleMessageKeyDown}
              placeholder={
                speakerName.trim()
                  ? `${speakerName.trim()}로 메시지 보내기`
                  : "이름을 입력하고 메시지 보내기"
              }
              className="min-h-24"
              maxLength={1000}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                Enter로 전송, Shift+Enter로 줄바꿈
              </p>
              <Button
                type="submit"
                disabled={isSending || !message.trim()}
                className="min-w-20"
              >
                {isSending ? "저장 중" : "전송"}
              </Button>
            </div>
          </form>

          {error ? (
            <div className="border-t border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      <OpsPanel
        refreshKey={opsRefreshKey}
        onChatUpdated={() => {
          loadChat().catch(() => {
            setError("채팅 기록을 불러오지 못했어요.");
          });
          setOpsRefreshKey((value) => value + 1);
        }}
      />
    </main>
  );
}
