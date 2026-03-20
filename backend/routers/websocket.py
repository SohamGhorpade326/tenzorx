"""FastAPI router — WebSocket endpoint for live pipeline step updates."""

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from agents.orchestrator import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/pipeline/{run_id}")
async def pipeline_ws(websocket: WebSocket, run_id: str):
    """
    WebSocket endpoint that streams real-time pipeline step updates.
    
    Frontend connects after calling POST /api/meetings/process-transcript
    with the returned run_id.
    
    Messages format:
    {
        "type": "step_update",
        "run_id": "abc123",
        "agent": "TranscriptAgent",
        "status": "RUNNING" | "SUCCESS" | "FAILED",
        "description": "Extracting decisions...",
        "output": {...},
        "timestamp": "2026-03-20T..."
    }
    """
    await websocket.accept()
    
    # Create a queue for this connection
    queue: asyncio.Queue = asyncio.Queue()
    ws_manager.subscribe(run_id, queue)
    
    try:
        # Send initial connected message
        await websocket.send_json({
            "type": "connected",
            "run_id": run_id,
            "message": f"Connected to pipeline run #{run_id}",
        })
        
        while True:
            try:
                # Wait for messages with a timeout so we can check connection
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(msg)
                
                # If pipeline is complete or failed, close after sending
                if msg.get("type") == "step_update" and msg.get("status") in ("COMPLETE", "FAILED"):
                    if msg.get("agent") == "OrchestratorAgent":
                        await asyncio.sleep(1)  # Let client process last message
                        break
                        
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                try:
                    await websocket.send_json({"type": "heartbeat", "run_id": run_id})
                except Exception:
                    break
                    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Error for run {run_id}: {e}")
    finally:
        ws_manager.unsubscribe(run_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
