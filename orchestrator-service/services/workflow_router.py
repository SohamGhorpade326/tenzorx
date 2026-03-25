from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from config import RETRY_BACKOFF_SECONDS, WORKFLOW_SERVICE_MAP
from clients.contract_client import ContractClient
from clients.meeting_client import MeetingClient
from clients.onboarding_client import OnboardingClient
from clients.procurement_client import ProcurementClient
from services.decision_engine import WorkflowAction


@dataclass(frozen=True)
class ActionExecutionResult:
    action_type: str
    target_service: Optional[str]
    ok: bool
    status_code: Optional[int]
    response_json: Optional[dict[str, Any]]
    error: Optional[str]


class WorkflowRouter:
    def __init__(
        self,
        *,
        http: httpx.AsyncClient,
        meeting_base_url: str,
        onboarding_base_url: str,
        procurement_base_url: str,
        contract_base_url: str,
    ) -> None:
        self._http = http
        self._meeting = MeetingClient(meeting_base_url, http)
        self._onboarding = OnboardingClient(onboarding_base_url, http)
        self._procurement = ProcurementClient(procurement_base_url, http)
        self._contract = ContractClient(contract_base_url, http)

        # Use config map but also ensure the constructor-provided base URLs are preferred.
        self._service_map: dict[str, str] = {
            **WORKFLOW_SERVICE_MAP,
            "meeting": meeting_base_url,
            "onboarding": onboarding_base_url,
            "procurement": procurement_base_url,
            "contract": contract_base_url,
        }

    async def execute_actions(self, actions: list[WorkflowAction]) -> list[ActionExecutionResult]:
        if not actions:
            return []
        coros = [self._execute_one(a) for a in actions]
        return await asyncio.gather(*coros)

    async def _execute_one(self, action: WorkflowAction) -> ActionExecutionResult:
        try:
            resp: Optional[httpx.Response] = None
            if action.type == "trigger_procurement":
                resp = await self._procurement.start_procurement(action.payload)
            elif action.type == "trigger_onboarding":
                resp = await self._onboarding.start_onboarding(action.payload)
            elif action.type == "trigger_contract":
                resp = await self._contract.start_contract(action.payload)
            elif action.type == "update_meeting_task":
                task_id = str(action.payload.get("task_id") or "")
                if not task_id:
                    return ActionExecutionResult(
                        action_type=action.type,
                        target_service=action.target_service,
                        ok=False,
                        status_code=None,
                        response_json=None,
                        error="Missing task_id for update_meeting_task",
                    )
                patch = {}
                if action.payload.get("status"):
                    patch["status"] = action.payload["status"]
                if action.payload.get("owner"):
                    patch["owner"] = action.payload["owner"]
                if action.payload.get("priority"):
                    patch["priority"] = action.payload["priority"]
                if action.payload.get("deadline"):
                    patch["deadline"] = action.payload["deadline"]
                resp = await self._meeting.update_task(task_id, patch)
            elif action.type == "compliance_escalate":
                # Compliance layer is mandatory but internal; no downstream call needed.
                return ActionExecutionResult(
                    action_type=action.type,
                    target_service=action.target_service,
                    ok=True,
                    status_code=None,
                    response_json={"compliance_action": "Escalated"},
                    error=None,
                )
            elif action.type == "final_escalation":
                # No retry; optionally this could integrate with an alert system.
                return ActionExecutionResult(
                    action_type=action.type,
                    target_service=action.target_service,
                    ok=True,
                    status_code=None,
                    response_json={"operational_action": "Final Escalation", "alert": "simulated"},
                    error=None,
                )
            elif action.type == "retry_task":
                workflow = action.payload.get("workflow") or action.target_service
                task_id = action.payload.get("task_id")
                step = action.payload.get("step")

                if not isinstance(workflow, str) or not workflow:
                    return ActionExecutionResult(
                        action_type=action.type,
                        target_service=action.target_service,
                        ok=False,
                        status_code=None,
                        response_json=None,
                        error="Missing workflow for retry_task",
                    )
                if not isinstance(task_id, str) or not task_id:
                    return ActionExecutionResult(
                        action_type=action.type,
                        target_service=action.target_service,
                        ok=False,
                        status_code=None,
                        response_json=None,
                        error="Missing task_id for retry_task",
                    )

                base_url = self._service_map.get(workflow.lower())
                if not isinstance(base_url, str) or not base_url:
                    return ActionExecutionResult(
                        action_type=action.type,
                        target_service=action.target_service,
                        ok=False,
                        status_code=None,
                        response_json=None,
                        error=f"Unknown workflow for retry_task: {workflow}",
                    )

                # Optional backoff (bonus) to avoid immediate hammering.
                backoff_s = action.payload.get("backoff_seconds")
                if backoff_s is None:
                    backoff_s = RETRY_BACKOFF_SECONDS
                try:
                    backoff_s_f = float(backoff_s)
                except Exception:
                    backoff_s_f = 0.0
                if backoff_s_f > 0:
                    await asyncio.sleep(backoff_s_f)

                url = f"{base_url.rstrip('/')}/retry-step"
                resp = await self._http.post(
                    url,
                    json={
                        "task_id": task_id,
                        "workflow": workflow,
                        "step": step,
                    },
                )
            elif action.type == "noop":
                return ActionExecutionResult(
                    action_type=action.type,
                    target_service=action.target_service,
                    ok=True,
                    status_code=None,
                    response_json=None,
                    error=None,
                )
            else:
                return ActionExecutionResult(
                    action_type=action.type,
                    target_service=action.target_service,
                    ok=False,
                    status_code=None,
                    response_json=None,
                    error=f"Unsupported action type: {action.type}",
                )

            if resp is None:
                return ActionExecutionResult(
                    action_type=action.type,
                    target_service=action.target_service,
                    ok=False,
                    status_code=None,
                    response_json=None,
                    error="No response (action did not execute)",
                )

            # Parse response body as JSON where possible.
            response_json: Optional[dict[str, Any]] = None
            try:
                data = resp.json()
                if isinstance(data, dict):
                    response_json = data
                else:
                    response_json = {"data": data}
            except Exception:
                response_json = None

            ok = 200 <= resp.status_code < 300
            return ActionExecutionResult(
                action_type=action.type,
                target_service=action.target_service,
                ok=ok,
                status_code=resp.status_code,
                response_json=response_json,
                error=None if ok else f"Downstream error: HTTP {resp.status_code}",
            )

        except Exception as e:
            return ActionExecutionResult(
                action_type=action.type,
                target_service=action.target_service,
                ok=False,
                status_code=None,
                response_json=None,
                error=f"{type(e).__name__}: {e}" if str(e) else type(e).__name__,
            )
