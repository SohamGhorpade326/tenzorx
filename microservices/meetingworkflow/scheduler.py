"""
APScheduler — runs TrackerAgent and EscalationAgent on a schedule.
Default: every 5 minutes (configurable via TRACKER_INTERVAL_MINUTES env var).
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
import uuid

from config import TRACKER_INTERVAL_MINUTES

scheduler = BackgroundScheduler()


def run_tracker_cycle():
    """Full tracker → escalation cycle."""
    run_id = f"sched_{uuid.uuid4().hex[:6]}"
    print(f"[Scheduler] 🔄 Tracker cycle starting (run_id={run_id})...")

    try:
        from agents import tracker_agent, escalation_agent
        result = tracker_agent.run(run_id=run_id)

        overdue_stalled = result.get("overdue_or_stalled", [])
        if overdue_stalled:
            print(f"[Scheduler] ⚠️  {len(overdue_stalled)} overdue/stalled tasks — running EscalationAgent")
            escalation_agent.run(overdue_stalled_tasks=overdue_stalled, run_id=run_id)
        else:
            print(f"[Scheduler] ✅ No overdue tasks — all good")

    except Exception as e:
        print(f"[Scheduler] ❌ Error in tracker cycle: {e}")


def start_scheduler():
    if scheduler.running:
        return

    scheduler.add_job(
        run_tracker_cycle,
        trigger=IntervalTrigger(minutes=TRACKER_INTERVAL_MINUTES),
        id="tracker_cycle",
        name="TrackerAgent + EscalationAgent cycle",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),  # Run immediately on startup too
    )
    scheduler.start()
    print(f"[Scheduler] Started — TrackerAgent runs every {TRACKER_INTERVAL_MINUTES} minutes")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
