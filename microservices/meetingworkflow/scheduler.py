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
    print(f"[SCHEDULER] >> Tracker cycle starting (run_id={run_id})...")

    try:
        from agents import tracker_agent, escalation_agent
        result = tracker_agent.run(run_id=run_id)

        overdue_stalled = result.get("overdue_or_stalled", [])
        if overdue_stalled:
            print(f"[SCHEDULER] WARNING: {len(overdue_stalled)} overdue/stalled tasks — running EscalationAgent")
            escalation_agent.run(overdue_stalled_tasks=overdue_stalled, run_id=run_id)
        else:
            print(f"[SCHEDULER] OK: No overdue tasks — all good")

    except ConnectionError as e:
        # Network/DNS error - log but continue (temporary connectivity issue)
        print(f"[SCHEDULER] WARNING: Connection error (will retry): {type(e).__name__}")
    except Exception as e:
        # Any other error - log but don't crash
        print(f"[SCHEDULER] ERROR: Error in tracker cycle: {type(e).__name__}: {e}")


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
    print(f"[SCHEDULER] OK: Started — TrackerAgent runs every {TRACKER_INTERVAL_MINUTES} minutes")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
