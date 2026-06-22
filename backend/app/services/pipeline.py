from datetime import datetime, timezone
from uuid import uuid4

from app.repositories.json_store import JsonStore
from app.schemas.intervention import FacilitationAction, Intervention, OpsState
from app.services.chat_filter import exclude_system_participants
from app.services.feedback_logger import summarize_feedback
from app.services.gemini_agent import GeminiAgent


ACTIVE_STATUSES = {"ready_to_send", "sent", "active", "closing_ready"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class GroupTokPipeline:
    def __init__(self) -> None:
        self.store = JsonStore()
        self.agent = GeminiAgent()

    def _latest_active_intervention(self) -> Intervention | None:
        for intervention in reversed(self.store.read_interventions()):
            if intervention.status in ACTIVE_STATUSES:
                return intervention
        return None

    def _activity_candidates_for(self, intervention: Intervention | None):
        retrieved = self.store.read_activity_candidates()

        if retrieved or intervention is None:
            return retrieved

        return [
            activity
            for activity in self.store.read_activities()
            if activity.id == intervention.activity_id
        ]

    def get_ops_state(self) -> OpsState:
        chat = exclude_system_participants(self.store.read_chat())
        context = self.store.read_group_context()
        interventions = self.store.read_interventions()
        latest_intervention = interventions[-1] if interventions else None
        retrieved = self._activity_candidates_for(latest_intervention)
        feedback = summarize_feedback(chat, latest_intervention)

        return OpsState(
            group_context=context,
            retrieved_activities=retrieved,
            selected_activity=retrieved[0] if retrieved else None,
            intervention=latest_intervention,
            feedback=feedback,
            pipeline_events=[
                "Loaded chat history",
                "Loaded latest group context",
                "Loaded persisted Activity RAG candidates",
                "Updated feedback snapshot",
            ],
        )

    def acknowledge_action(self, intervention_id: str, action_type: str) -> OpsState:
        interventions = self.store.read_interventions()
        intervention = next(
            (item for item in interventions if item.id == intervention_id),
            None,
        )

        if intervention is None:
            return self.get_ops_state()

        timestamp = _now()

        if action_type == "start":
            intervention.status = "active"
            intervention.sent_at = intervention.sent_at or timestamp
            intervention.last_action_at = timestamp
        elif action_type == "reminder":
            intervention.status = "active"
            intervention.reminder_count += 1
            intervention.last_action_at = timestamp
        elif action_type == "closing":
            intervention.status = "completed"
            intervention.completed_at = timestamp
            intervention.last_action_at = timestamp

        self.store.update_intervention(intervention)
        return self.get_ops_state()

    def run(self) -> OpsState:
        chat = exclude_system_participants(self.store.read_chat())
        activities = self.store.read_activities()
        context = self.agent.model_context(chat)
        self.store.write_group_context(context)

        active_intervention = self._latest_active_intervention()

        if active_intervention is not None:
            feedback = summarize_feedback(chat, active_intervention)
            decision = self.agent.decide_facilitation_action(
                chat,
                context,
                active_intervention,
                feedback,
            )
            action_type = str(decision["action"])
            action_message = str(decision.get("message", ""))
            reason = str(decision.get("reason", ""))

            if action_type == "closing":
                offline_suggestion = str(decision.get("offline_suggestion_text", ""))
                if offline_suggestion:
                    active_intervention.offline_suggestion_text = offline_suggestion
                    self.store.update_intervention(active_intervention)
                if offline_suggestion and offline_suggestion not in action_message:
                    action_message = f"{action_message}\n\n대면으로도 해볼 만한 것: {offline_suggestion}"

            return OpsState(
                group_context=context,
                retrieved_activities=self._activity_candidates_for(active_intervention),
                selected_activity=None,
                intervention=active_intervention,
                feedback=feedback,
                facilitation_action=FacilitationAction(
                    type=action_type,
                    intervention_id=(
                        active_intervention.id if action_type != "none" else None
                    ),
                    message=action_message if action_type != "none" else "",
                    reason=reason,
                ),
                pipeline_events=[
                    "Read group chat data",
                    "Modeled current group context with Gemini",
                    "Detected an ongoing activity",
                    "Skipped new Activity RAG until current activity completes",
                    "Evaluated reminder/closing timing with Gemini",
                ],
            )

        timing = self.agent.decide_intervention_timing(
            chat,
            context,
            activities,
            active_intervention,
        )
        should_start = bool(timing["should_start"])

        if not should_start:
            return OpsState(
                group_context=context,
                retrieved_activities=self.store.read_activity_candidates(),
                selected_activity=None,
                intervention=None,
                feedback=None,
                facilitation_action=FacilitationAction(
                    type="none",
                    reason=str(timing["reason"]),
                ),
                pipeline_events=[
                    "Read group chat data",
                    "Modeled current group context with Gemini",
                    "Evaluated intervention timing with Gemini",
                    "No intervention sent",
                ],
            )

        retrieved = self.agent.select_activities(context, activities)
        self.store.write_activity_candidates(retrieved)
        selected = retrieved[0] if retrieved else None
        intervention = None
        feedback = None

        if selected is not None:
            adaptation = self.agent.adapt_activity(selected, context)
            generated = self.agent.generate_intervention(selected, context, adaptation)
            intervention = Intervention(
                id=f"intervention_{uuid4().hex[:10]}",
                activity_id=selected.id,
                activity_title=selected.title,
                risk_level=selected.risk_level,
                adapted_title=str(generated["adapted_title"]),
                recommendation_reason=str(generated["recommendation_reason"]),
                adapter_notes=str(generated["adapter_notes"]),
                card_text=str(generated["card_text"]),
                facilitation_plan=[
                    str(item) for item in generated["facilitation_plan"]
                ],
                reminder_text=str(generated["reminder_text"]),
                closing_text=str(generated["closing_text"]),
                offline_suggestion_text=str(generated["offline_suggestion_text"]),
                status="ready_to_send",
                created_at=_now(),
            )
            self.store.append_intervention(intervention)
            feedback = summarize_feedback(chat, intervention)
            if feedback:
                self.store.append_feedback(feedback)

        return OpsState(
            group_context=context,
            retrieved_activities=retrieved,
            selected_activity=selected,
            intervention=intervention,
            feedback=feedback,
            facilitation_action=FacilitationAction(
                type="start" if intervention else "none",
                intervention_id=intervention.id if intervention else None,
                message=intervention.card_text if intervention else "",
                reason=str(timing["reason"]),
            ),
            pipeline_events=[
                "Read group chat data",
                "Modeled current group context with Gemini",
                "Evaluated intervention timing with Gemini",
                "Retrieved CBA candidates with Gemini",
                "Adapted selected activity with Gemini",
                "Generated facilitator activity card with Gemini",
            ],
        )
