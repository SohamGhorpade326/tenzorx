from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Optional

from config import MAX_RETRIES
from models.event import Event


ActionType = Literal[
    "trigger_procurement",
    "trigger_onboarding",
    "trigger_contract",
    "update_meeting_task",
    "compliance_escalate",
    "retry_task",
    "final_escalation",
    "noop",
]


@dataclass(frozen=True)
class WorkflowAction:
    type: ActionType
    target_service: Optional[str]
    description: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class DecisionResult:
    summary: str
    actions: list[WorkflowAction]


class DecisionEngine:
    """Deterministic rule-based orchestration.

    Important: this service intentionally does NOT use LangGraph or LLMs.
    """

    def decide(self, event: Event) -> DecisionResult:
        et = event.event_type
        payload = event.payload or {}

        # 0) Compliance-grade SLA breach handling (Task & SLA service)
        # Always: compliance escalation action + auditability.
        # Then: bounded self-healing retry.
        if et == "task.sla_breached":
            workflow = payload.get("workflow")
            step = payload.get("step")
            task_id = payload.get("task_id")
            reason = payload.get("reason")
            retry_count = int(payload.get("retry_count") or 0)

            workflow_s = workflow if isinstance(workflow, str) else "unknown"
            step_s = step if isinstance(step, str) else ""
            task_id_s = task_id if isinstance(task_id, str) else ""

            base_payload: dict[str, Any] = {
                "task_id": task_id_s,
                "workflow": workflow_s,
                "step": step_s,
                "retry_count": retry_count,
                "reason": reason if isinstance(reason, str) else None,
            }

            compliance = WorkflowAction(
                type="compliance_escalate",
                target_service=workflow_s,
                description="Compliance escalation (always): mark SLA breach as escalated",
                payload=base_payload,
            )

            if retry_count < MAX_RETRIES:
                operational = WorkflowAction(
                    type="retry_task",
                    target_service=workflow_s,
                    description="Operational self-healing: retry failed step via workflow service",
                    payload=base_payload,
                )
                return DecisionResult(summary="SLA breach: escalated + retry", actions=[compliance, operational])

            operational = WorkflowAction(
                type="final_escalation",
                target_service=workflow_s,
                description="Operational: max retries exceeded; final escalation (no retry)",
                payload=base_payload,
            )
            return DecisionResult(summary="SLA breach: escalated + final escalation", actions=[compliance, operational])

        # 1) Meeting-created tasks -> route by task_type
        if et == "meeting.tasks_created":
            task_type = payload.get("task_type")
            if task_type == "procurement":
                return DecisionResult(
                    summary="Triggered procurement workflow",
                    actions=[
                        WorkflowAction(
                            type="trigger_procurement",
                            target_service="procurement",
                            description="Start procurement run",
                            payload=_procurement_payload_from_event(payload),
                        )
                    ],
                )
            if task_type == "onboarding":
                ob_payload = _onboarding_payload_from_event(payload)
                if not ob_payload.get("employee_name") or not ob_payload.get("employee_id"):
                    return DecisionResult(
                        summary="Onboarding task received but missing employee details",
                        actions=[
                            WorkflowAction(
                                type="noop",
                                target_service=None,
                                description="No-op (missing employee_name/employee_id)",
                                payload={"task_type": task_type},
                            )
                        ],
                    )
                return DecisionResult(
                    summary="Triggered onboarding workflow",
                    actions=[
                        WorkflowAction(
                            type="trigger_onboarding",
                            target_service="onboarding",
                            description="Start onboarding run",
                            payload=ob_payload,
                        )
                    ],
                )
            if task_type == "contract":
                c_payload = _contract_payload_from_event(payload)
                if not c_payload.get("contract_id"):
                    return DecisionResult(
                        summary="Contract task received but missing contract_id",
                        actions=[
                            WorkflowAction(
                                type="noop",
                                target_service=None,
                                description="No-op (missing contract_id)",
                                payload={"task_type": task_type},
                            )
                        ],
                    )
                return DecisionResult(
                    summary="Triggered contract workflow",
                    actions=[
                        WorkflowAction(
                            type="trigger_contract",
                            target_service="contract",
                            description="Start contract run",
                            payload=c_payload,
                        )
                    ],
                )

            return DecisionResult(
                summary="No matching workflow for meeting task_type",
                actions=[
                    WorkflowAction(
                        type="noop",
                        target_service=None,
                        description="No-op (unknown task_type)",
                        payload={"task_type": task_type},
                    )
                ],
            )

        # 2) Onboarding started -> ensure onboarding workflow is running
        if et == "onboarding.started":
            ob_payload = _onboarding_payload_from_event(payload)
            if not ob_payload.get("employee_name") or not ob_payload.get("employee_id"):
                return DecisionResult(
                    summary="Onboarding.started received but missing employee details",
                    actions=[
                        WorkflowAction(
                            type="noop",
                            target_service=None,
                            description="No-op (missing employee_name/employee_id)",
                            payload={},
                        )
                    ],
                )
            return DecisionResult(
                summary="Triggered onboarding workflow",
                actions=[
                    WorkflowAction(
                        type="trigger_onboarding",
                        target_service="onboarding",
                        description="Start onboarding run",
                        payload=ob_payload,
                    )
                ],
            )

        # 3) Contract pending approval -> start/continue contract workflow
        if et == "contract.pending_approval":
            c_payload = _contract_payload_from_event(payload)
            if not c_payload.get("contract_id"):
                return DecisionResult(
                    summary="contract.pending_approval received but missing contract_id",
                    actions=[
                        WorkflowAction(
                            type="noop",
                            target_service=None,
                            description="No-op (missing contract_id)",
                            payload={},
                        )
                    ],
                )
            return DecisionResult(
                summary="Triggered contract workflow",
                actions=[
                    WorkflowAction(
                        type="trigger_contract",
                        target_service="contract",
                        description="Start contract run",
                        payload=c_payload,
                    )
                ],
            )

        # 4) Task failed -> retry or escalate (deterministic)
        if et == "task.failed":
            retry_count = int(payload.get("retry_count") or 0)
            target = payload.get("target_service")

            # Try: retry by re-triggering the relevant workflow "start" endpoint.
            if retry_count < MAX_RETRIES and isinstance(target, str):
                target = target.lower()
                if target == "procurement":
                    return DecisionResult(
                        summary="Retrying procurement workflow",
                        actions=[
                            WorkflowAction(
                                type="trigger_procurement",
                                target_service="procurement",
                                description="Retry procurement run (re-trigger start)",
                                payload=_procurement_payload_from_event(payload),
                            )
                        ],
                    )
                if target == "onboarding":
                    return DecisionResult(
                        summary="Retrying onboarding workflow",
                        actions=[
                            WorkflowAction(
                                type="trigger_onboarding",
                                target_service="onboarding",
                                description="Retry onboarding run (re-trigger start)",
                                payload=_onboarding_payload_from_event(payload),
                            )
                        ],
                    )
                if target == "contract":
                    return DecisionResult(
                        summary="Retrying contract workflow",
                        actions=[
                            WorkflowAction(
                                type="trigger_contract",
                                target_service="contract",
                                description="Retry contract run (re-trigger start)",
                                payload=_contract_payload_from_event(payload),
                            )
                        ],
                    )

            # Escalation path: if this failure maps to a meeting task, mark it BLOCKED.
            meeting_task_id = payload.get("meeting_task_id") or payload.get("task_id")
            if isinstance(meeting_task_id, str) and meeting_task_id:
                return DecisionResult(
                    summary="Escalated failed task (marked meeting task as BLOCKED)",
                    actions=[
                        WorkflowAction(
                            type="update_meeting_task",
                            target_service="meeting",
                            description="Update meeting task status to BLOCKED",
                            payload={
                                "task_id": meeting_task_id,
                                "status": "BLOCKED",
                                "reason": payload.get("reason") or "task.failed",
                            },
                        )
                    ],
                )

            return DecisionResult(
                summary="No retry possible; escalation required",
                actions=[
                    WorkflowAction(
                        type="noop",
                        target_service=target if isinstance(target, str) else None,
                        description="No-op (requires human escalation)",
                        payload={"retry_count": retry_count, "target_service": target},
                    )
                ],
            )

        # 5) SLA breach -> escalate (best-effort)
        if et == "sla.breached":
            meeting_task_id = payload.get("meeting_task_id") or payload.get("task_id")
            if isinstance(meeting_task_id, str) and meeting_task_id:
                return DecisionResult(
                    summary="Escalated SLA breach (marked meeting task as OVERDUE)",
                    actions=[
                        WorkflowAction(
                            type="update_meeting_task",
                            target_service="meeting",
                            description="Update meeting task status to OVERDUE",
                            payload={
                                "task_id": meeting_task_id,
                                "status": "OVERDUE",
                                "reason": payload.get("reason") or "sla.breached",
                            },
                        )
                    ],
                )

            return DecisionResult(
                summary="SLA breach received; no concrete task to escalate",
                actions=[
                    WorkflowAction(
                        type="noop",
                        target_service=None,
                        description="No-op (missing meeting_task_id/task_id)",
                        payload={},
                    )
                ],
            )

        # Default: deterministic no-op
        return DecisionResult(
            summary="No rule matched; no action taken",
            actions=[
                WorkflowAction(
                    type="noop",
                    target_service=None,
                    description="No-op (unhandled event_type)",
                    payload={"event_type": et},
                )
            ],
        )


def _procurement_payload_from_event(payload: dict[str, Any]) -> dict[str, Any]:
    # Procurement service expects: { purchase_request: {...} }
    if isinstance(payload.get("purchase_request"), dict):
        return {"purchase_request": payload["purchase_request"]}
    if isinstance(payload.get("data"), dict) and isinstance(payload["data"].get("purchase_request"), dict):
        return {"purchase_request": payload["data"]["purchase_request"]}
    # Fallback: treat entire payload as purchase_request (keeps orchestrator flexible)
    return {"purchase_request": payload}


def _onboarding_payload_from_event(payload: dict[str, Any]) -> dict[str, Any]:
    # Onboarding service expects: { employee_name: str, employee_id: str }
    employee_name = payload.get("employee_name") or payload.get("name") or payload.get("employee")
    employee_id = payload.get("employee_id") or payload.get("id")
    out: dict[str, Any] = {}
    if employee_name is not None:
        out["employee_name"] = employee_name
    if employee_id is not None:
        out["employee_id"] = employee_id
    return out


def _contract_payload_from_event(payload: dict[str, Any]) -> dict[str, Any]:
    # Contract service expects: { contract_id: str }
    contract_id = payload.get("contract_id") or payload.get("id")
    out: dict[str, Any] = {}
    if contract_id is not None:
        out["contract_id"] = contract_id
    return out
