"""
Whisper Transcription Service
------------------------------
Transcribe audio blobs to text using OpenAI Whisper (local, no API cost).
Based on meeting workflow implementation.
"""

import os
import tempfile
import time
from typing import Optional

from config import WHISPER_MODEL_SIZE, WHISPER_LANGUAGE, DEMO_MODE


def transcribe_audio_blob(audio_bytes: bytes, audio_format: str = "webm", run_id: Optional[str] = None) -> str:
    """
    Transcribe audio blob using Whisper.
    
    Args:
        audio_bytes: Audio file bytes (from RecordRTC.getBlob())
        audio_format: Audio format (webm, wav, mp3, m4a, ogg, flac, etc.)
        run_id: Optional run ID for logging
    
    Returns:
        Transcribed text
        
    Raises:
        Exception: If transcription fails
    """
    if DEMO_MODE:
        print(f"[TranscriptionService] DEMO_MODE: Returning mock transcript")
        return "I confirm that I agree with all company policies and will comply with all requirements."
    
    start = time.time()
    try:
        import whisper
        
        print(f"[TranscriptionService] Loading Whisper model ({WHISPER_MODEL_SIZE})...")
        
        # Save blob to temp file (Whisper needs file path)
        suffix = f".{audio_format}" if audio_format else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            # Load model
            model = whisper.load_model(WHISPER_MODEL_SIZE)
            
            # Prepare transcription prompt
            prompt = (
                "Video onboarding interview response. "
                "Preserve all spoken details accurately. "
                "Improve readability with proper punctuation and capitalization."
            )
            
            # Transcribe
            print(f"[TranscriptionService] Transcribing audio from {tmp_path}...")
            result = model.transcribe(
                tmp_path,
                language=WHISPER_LANGUAGE,
                temperature=0,
                best_of=3,
                beam_size=5,
                condition_on_previous_text=True,
                fp16=False,
                initial_prompt=prompt,
            )
            
            text = result.get("text", "").strip()
            elapsed_ms = int((time.time() - start) * 1000)
            
            print(f"[TranscriptionService] ✅ Transcribed {len(text)} chars in {elapsed_ms}ms")
            print(f"[TranscriptionService] Text: {text[:100]}...")
            
            return text
        
        finally:
            os.unlink(tmp_path)
    
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        print(f"[TranscriptionService] ❌ Whisper failed after {elapsed_ms}ms: {str(e)}")
        raise Exception(f"Whisper transcription failed: {str(e)}")
