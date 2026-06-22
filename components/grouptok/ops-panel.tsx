"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type GroupContext = {
  summary: string;
  state: string;
  group_stage: string;
  participation_level: string;
  energy_level: string;
  familiarity_level: string;
  fatigue_level: string;
  recommended_risk_level: string;
  recent_topics: string[];
  rationale: string;
  updated_at: string | null;
  signals: {
    recent_message_count: number;
    active_participant_count: number;
    total_participant_count: number;
    first_time_speaker_count: number;
    silence_duration_minutes: number | null;
    question_answer_flow: string;
  };
  intervention_readiness: {
    status: string;
    reason: string;
    cautions: string[];
  };
};

type Activity = {
  id: string;
  title: string;
  risk_level: string;
  duration_minutes: number;
  participation_modes: string[];
  online_adaptation_notes: string;
};

type Intervention = {
  id: string;
  activity_title: string;
  risk_level: string;
  adapted_title: string;
  recommendation_reason: string;
  adapter_notes: string;
  card_text: string;
  facilitation_plan: string[];
  reminder_text: string;
  closing_text: string;
  offline_suggestion_text: string;
  status: string;
};

type Feedback = {
  participant_count: number;
  message_count: number;
  first_time_speaker_count: number;
  emoji_count: number;
  participation_rate: number;
  completion_status: string;
};

type OpsState = {
  group_context: GroupContext;
  retrieved_activities: Activity[];
  selected_activity: Activity | null;
  intervention: Intervention | null;
  feedback: Feedback | null;
  facilitation_action: {
    type: string;
    intervention_id: string | null;
    message: string;
    reason: string;
  };
  pipeline_events: string[];
  error?: string;
  backendUrl?: string;
};

type OpsPanelProps = {
  refreshKey: number;
  onChatUpdated: () => void;
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">
        {value ?? "-"}
      </p>
    </div>
  );
}

export function OpsPanel({ refreshKey, onChatUpdated }: OpsPanelProps) {
  const [opsState, setOpsState] = useState<OpsState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postStatus, setPostStatus] = useState("");

  async function postGroupTokMessage(body: string) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message",
        name: "GroupTok",
        body,
      }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok || data.error) {
      throw new Error(data.error ?? "채팅방에 보내지 못했어요.");
    }
  }

  async function acknowledgeAction(interventionId: string, actionType: string) {
    await fetch("/api/grouptok", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intervention_id: interventionId,
        action_type: actionType,
      }),
    });
  }

  async function applyFacilitationAction(nextState: OpsState) {
    const action = nextState.facilitation_action;

    if (
      !action ||
      action.type === "none" ||
      !action.message ||
      !action.intervention_id
    ) {
      return nextState;
    }

    await postGroupTokMessage(action.message);
    await acknowledgeAction(action.intervention_id, action.type);
    onChatUpdated();

    const response = await fetch("/api/grouptok", { cache: "no-store" });
    return (await response.json()) as OpsState;
  }

  async function runPipeline() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/grouptok", {
        method: "POST",
      });
      const data = (await response.json()) as OpsState;
      const nextState = await applyFacilitationAction(data);
      setOpsState(nextState);
    } finally {
      setIsRunning(false);
    }
  }

  async function postInterventionToChat() {
    if (!opsState?.intervention) {
      return;
    }

    setPostStatus("");
    setIsPosting(true);

    try {
      await postGroupTokMessage(opsState.intervention.card_text);
      await acknowledgeAction(opsState.intervention.id, "start");
      onChatUpdated();
      setPostStatus("채팅방에 보냈습니다.");
    } catch (error) {
      setPostStatus(
        error instanceof Error ? error.message : "채팅방에 보내지 못했어요.",
      );
    } finally {
      setIsPosting(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function fetchOpsState() {
      try {
        const response = await fetch("/api/grouptok", {
          cache: "no-store",
        });
        const data = (await response.json()) as OpsState;

        if (isMounted) {
          setOpsState(data);
        }
      } catch {
        if (isMounted) {
          setOpsState({
            error: "GroupTok backend is not running.",
          } as OpsState);
        }
      }
    }

    void fetchOpsState();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  if (!opsState || opsState.error) {
    return (
      <aside className="hidden min-h-screen flex-1 overflow-y-auto bg-zinc-50 p-5 lg:block">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">
            GroupTok Ops
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {opsState?.error ?? "Loading backend state..."}
          </p>
          {opsState?.backendUrl ? (
            <p className="mt-2 text-xs text-zinc-400">{opsState.backendUrl}</p>
          ) : null}
        </div>
      </aside>
    );
  }

  const context = opsState.group_context;
  const feedback = opsState.feedback;

  return (
    <aside className="hidden min-h-screen flex-1 overflow-y-auto bg-zinc-50 p-5 lg:block">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              GroupTok Ops
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Group Context Dashboard
            </h2>
          </div>
          <Button onClick={runPipeline} disabled={isRunning}>
            {isRunning ? "분석 중" : "상태 갱신"}
          </Button>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{context.group_stage}</Badge>
            <Badge>{context.participation_level} participation</Badge>
            <Badge>{context.energy_level}</Badge>
            <Badge>{context.recommended_risk_level} risk</Badge>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-950">
            {context.summary}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {context.rationale}
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Metric
            label="recent messages"
            value={context.signals.recent_message_count}
          />
          <Metric
            label="active people"
            value={`${context.signals.active_participant_count}/${context.signals.total_participant_count}`}
          />
          <Metric
            label="silence"
            value={
              context.signals.silence_duration_minutes === null
                ? null
                : `${context.signals.silence_duration_minutes}m`
            }
          />
          <Metric
            label="first speakers"
            value={context.signals.first_time_speaker_count}
          />
          <Metric
            label="Q/A flow"
            value={context.signals.question_answer_flow}
          />
          <Metric label="fatigue" value={context.fatigue_level} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">
            Intervention Readiness
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {context.intervention_readiness.reason}
          </p>
          {context.intervention_readiness.cautions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {context.intervention_readiness.cautions.map((caution) => (
                <Badge key={caution}>{caution}</Badge>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">
            Activity RAG
          </p>
          <div className="mt-3 space-y-2">
            {opsState.retrieved_activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-950">
                    {activity.title}
                  </p>
                  <Badge>{activity.risk_level}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {activity.online_adaptation_notes}
                </p>
              </div>
            ))}
          </div>
        </section>

        {opsState.intervention ? (
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-950">
                Adapted Intervention
              </p>
              <Button
                variant="secondary"
                onClick={postInterventionToChat}
                disabled={isPosting || opsState.intervention.status !== "ready_to_send"}
              >
                {opsState.intervention.status === "ready_to_send"
                  ? isPosting
                    ? "보내는 중"
                    : "채팅방에 보내기"
                  : "이미 시작됨"}
              </Button>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-950">
              {opsState.intervention.adapted_title}
            </p>
            {opsState.intervention.recommendation_reason ? (
              <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
                추천 이유: {opsState.intervention.recommendation_reason}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {opsState.intervention.adapter_notes}
            </p>
            <div className="mt-3 grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              <p>
                <span className="font-semibold text-zinc-900">Status:</span>{" "}
                {opsState.intervention.status}
              </p>
              <p>
                <span className="font-semibold text-zinc-900">Next action:</span>{" "}
                {opsState.facilitation_action.type}
              </p>
              {opsState.facilitation_action.reason ? (
                <p>{opsState.facilitation_action.reason}</p>
              ) : null}
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
              {opsState.intervention.card_text}
            </pre>
            <div className="mt-3 grid gap-2">
              {opsState.intervention.reminder_text ? (
                <div className="rounded-md border border-zinc-200 bg-white p-3">
                  <p className="text-xs font-semibold text-zinc-950">
                    Reminder
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {opsState.intervention.reminder_text}
                  </p>
                </div>
              ) : null}
              {opsState.intervention.closing_text ? (
                <div className="rounded-md border border-zinc-200 bg-white p-3">
                  <p className="text-xs font-semibold text-zinc-950">
                    Closing
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {opsState.intervention.closing_text}
                  </p>
                  {opsState.intervention.offline_suggestion_text ? (
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      대면 제안: {opsState.intervention.offline_suggestion_text}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {postStatus ? (
              <p className="mt-3 text-xs font-medium text-zinc-500">
                {postStatus}
              </p>
            ) : null}
          </section>
        ) : null}

        {feedback ? (
          <section className="grid grid-cols-4 gap-3">
            <Metric label="participants" value={feedback.participant_count} />
            <Metric label="messages" value={feedback.message_count} />
            <Metric
              label="first timers"
              value={feedback.first_time_speaker_count}
            />
            <Metric
              label="rate"
              value={`${Math.round(feedback.participation_rate * 100)}%`}
            />
          </section>
        ) : null}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">
            Pipeline Trace
          </p>
          <ol className="mt-3 space-y-2">
            {opsState.pipeline_events.map((event) => (
              <li key={event} className="flex items-center gap-2 text-sm text-zinc-600">
                <span className="size-2 rounded-full bg-emerald-500" />
                {event}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
