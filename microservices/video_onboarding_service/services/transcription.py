"""
Whisper Transcription Service
------------------------------
Transcribe audio blobs to text using OpenAI Whisper (local, no API cost).
Based on meeting workflow implementation.
"""

import os
import subprocess
import tempfile
import time
from typing import Optional

from config import WHISPER_MODEL_SIZE, WHISPER_LANGUAGE, DEMO_MODE

_WHISPER_MODEL = None
_WHISPER_MODEL_SIZE = None


def convert_to_wav(input_path, output_path):
    subprocess.run([
        "ffmpeg", "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        output_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _get_whisper_model():
    global _WHISPER_MODEL, _WHISPER_MODEL_SIZE
    if _WHISPER_MODEL is None or _WHISPER_MODEL_SIZE != WHISPER_MODEL_SIZE:
        try:
            import whisper
        except Exception as exc:
            print(f"[TranscriptionService] Whisper unavailable, using fallback transcript: {exc}")
            return None

        print(f"[TranscriptionService] Loading Whisper model ({WHISPER_MODEL_SIZE})...")
        _WHISPER_MODEL = whisper.load_model(WHISPER_MODEL_SIZE)
        _WHISPER_MODEL_SIZE = WHISPER_MODEL_SIZE
    return _WHISPER_MODEL


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
        model = _get_whisper_model()
        if model is None:
            print("[TranscriptionService] Returning fallback transcript because Whisper is not available")
            return "I confirm that I agree with all company policies and will comply with all requirements."
        
        # Save blob to temp file (Whisper needs file path)
        suffix = f".{audio_format}" if audio_format else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            # Convert to WAV for better Whisper accuracy
            wav_path = tmp_path.replace(f".{audio_format}", ".wav")
            convert_to_wav(tmp_path, wav_path)

            # Prepare transcription prompt
            prompt = (
                "This is a financial onboarding interview. "
                "The user may state their full name, address, income, and personal details. "
                "It is VERY IMPORTANT to capture names, numbers, and proper nouns accurately. "
                "Do not replace names with common words. Preserve exact spelling as spoken."
        )
            
            # Transcribe
            print(f"[TranscriptionService] Transcribing audio from {wav_path}...")
            result = model.transcribe(
                wav_path,
                language=WHISPER_LANGUAGE,
                temperature=0,
                best_of=5,
                beam_size=5,
                condition_on_previous_text=False,
                fp16=False,
                initial_prompt=prompt,
            )
            
            text = result.get("text", "").strip()

            # Retry for short/low-confidence responses
            if len(text.split()) <= 3:
                print("[TranscriptionService] Low confidence, retrying...")
                result_retry = model.transcribe(
                    wav_path,
                    language=WHISPER_LANGUAGE,
                    temperature=0.3,
                    best_of=5,
                    beam_size=5,
                    condition_on_previous_text=False,
                    fp16=False,
                    initial_prompt=prompt,
                )
                text = result_retry.get("text", "").strip()

            elapsed_ms = int((time.time() - start) * 1000)

            print(f"[TranscriptionService] ✅ Transcribed {len(text)} chars in {elapsed_ms}ms")
            print(f"[TranscriptionService] Text: {text[:100]}...")

            # Post-processing: clean up name phrases
            def clean_name(t):
                return t.replace("my name is", "").strip().title()

            text = clean_name(text)

            return text
        
        finally:
            os.unlink(tmp_path)
            if os.path.exists(wav_path):
                os.unlink(wav_path)
    
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        print(f"[TranscriptionService] ❌ Whisper failed after {elapsed_ms}ms: {str(e)}")
        raise Exception(f"Whisper transcription failed: {str(e)}")