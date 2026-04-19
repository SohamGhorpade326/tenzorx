"""CV age estimation wrapper.

Uses the existing OpenCV + Caffe age model artifacts under the repository's
`age_models/` folder.

This is intentionally written to be callable per-image (frame) so the frontend
can send a single captured frame silently before the Q&A begins.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional, Tuple


@dataclass(frozen=True)
class AgeEstimate:
    age_range: str  # e.g. "25-32"
    midpoint_age: int
    confidence_pct: float


def _repo_root() -> str:
    # microservices/video_onboarding_service/services -> repo root
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _models_dir() -> str:
    return os.path.join(_repo_root(), "age_models")


def _parse_bucket(bucket: str) -> Tuple[int, int]:
    # Accept "(25-32)", "25-32", "25–32"
    m = re.search(r"(\d+)\s*[-–]\s*(\d+)", bucket)
    if not m:
        raise ValueError(f"Unrecognized age bucket: {bucket}")
    return int(m.group(1)), int(m.group(2))


@lru_cache(maxsize=1)
def _load_networks():
    # Import heavy deps lazily so the service can still run without CV if needed.
    import cv2  # type: ignore

    models_dir = _models_dir()
    face_proto = os.path.join(models_dir, "opencv_face_detector.pbtxt")
    face_model = os.path.join(models_dir, "opencv_face_detector_uint8.pb")
    age_proto = os.path.join(models_dir, "age_deploy.prototxt")
    age_weights = os.path.join(models_dir, "age_net.caffemodel")

    if not (os.path.exists(face_proto) and os.path.exists(face_model) and os.path.exists(age_proto) and os.path.exists(age_weights)):
        missing = [p for p in [face_proto, face_model, age_proto, age_weights] if not os.path.exists(p)]
        raise FileNotFoundError(f"Missing age model files: {missing}")

    face_net = cv2.dnn.readNet(face_model, face_proto)
    age_net = cv2.dnn.readNet(age_weights, age_proto)

    face_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_DEFAULT)
    face_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    age_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_DEFAULT)
    age_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    return face_net, age_net


def estimate_age_from_image_bytes(image_bytes: bytes) -> Optional[AgeEstimate]:
    """Estimate age from an encoded image (JPEG/PNG).

    Returns None if no face is detected.
    """

    import cv2  # type: ignore
    import numpy as np  # type: ignore

    face_net, age_net = _load_networks()

    img_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image")

    h, w = frame.shape[:2]

    # Face detector
    blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), [104, 117, 123], swapRB=False)
    face_net.setInput(blob)
    detections = face_net.forward()

    best_box = None
    best_conf = 0.0
    for i in range(detections.shape[2]):
        conf = float(detections[0, 0, i, 2])
        if conf > best_conf:
            x1 = max(0, int(detections[0, 0, i, 3] * w))
            y1 = max(0, int(detections[0, 0, i, 4] * h))
            x2 = min(w - 1, int(detections[0, 0, i, 5] * w))
            y2 = min(h - 1, int(detections[0, 0, i, 6] * h))
            best_box = (x1, y1, x2, y2)
            best_conf = conf

    # Require at least modest confidence to avoid noise
    if not best_box or best_conf < 0.6:
        return None

    x1, y1, x2, y2 = best_box
    face_crop = frame[y1:y2, x1:x2]
    if face_crop.size == 0:
        return None

    # Age net
    mean_values = (78.426, 87.769, 114.896)
    age_blob = cv2.dnn.blobFromImage(face_crop, 1.0, (227, 227), mean_values, swapRB=False)
    age_net.setInput(age_blob)
    preds = age_net.forward()[0]

    # Buckets from the original model
    age_buckets = [
        "(0-2)",
        "(4-6)",
        "(8-12)",
        "(15-20)",
        "(25-32)",
        "(38-43)",
        "(48-53)",
        "(60-100)",
    ]

    idx = int(np.argmax(preds))
    bucket = age_buckets[idx]
    conf_pct = float(preds[idx]) * 100.0

    min_age, max_age = _parse_bucket(bucket)
    midpoint = int(round((min_age + max_age) / 2))

    return AgeEstimate(age_range=f"{min_age}-{max_age}", midpoint_age=midpoint, confidence_pct=conf_pct)
