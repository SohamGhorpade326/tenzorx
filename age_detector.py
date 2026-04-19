"""
Real-Time Age Estimator
=======================
Uses OpenCV + pre-trained Caffe DNN (Gil Levi & Tal Hassner, 2015)
for fast, low-latency age estimation via webcam.

First run: auto-downloads ~28 MB of model weights (one time only).
After that: instant startup, ~30 FPS on any modern CPU.

Requirements:
    pip install opencv-python numpy

Usage:
    python age_detector.py

Controls:
    Q  →  Quit
    S  →  Save screenshot
"""

import cv2
import numpy as np
import urllib.request
import os
import sys
import time

# ─── Model config ────────────────────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "age_models")

MODEL_FILES = {
    "opencv_face_detector.pbtxt": (
        "https://raw.githubusercontent.com/spmallick/learnopencv/"
        "master/AgeGender/opencv_face_detector.pbtxt"
    ),
    "opencv_face_detector_uint8.pb": (
        "https://github.com/spmallick/learnopencv/raw/master/"
        "AgeGender/opencv_face_detector_uint8.pb"
    ),
    "age_deploy.prototxt": (
        "https://raw.githubusercontent.com/spmallick/learnopencv/"
        "master/AgeGender/age_deploy.prototxt"
    ),
    "age_net.caffemodel": (
        "https://github.com/smahesh29/Gender-and-Age-Detection/raw/"
        "master/age_net.caffemodel"
    ),
}

# Age buckets the Caffe model was trained on
AGE_BUCKETS = [
    "(0-2)",   "(4-6)",   "(8-12)",  "(15-20)",
    "(25-32)", "(38-43)", "(48-53)", "(60-100)",
]

# Visual settings
FONT          = cv2.FONT_HERSHEY_SIMPLEX
BOX_COLOR     = (0, 255, 0)       # green face box
TEXT_BG_COLOR = (0, 200, 0)
TEXT_COLOR    = (255, 255, 255)
CONF_THRESH   = 0.7                # face-detector confidence threshold
INPUT_SIZE    = (300, 300)         # face detector input size
AGE_INPUT_SIZE= (227, 227)         # age net input size
MEAN_VALUES   = (78.426, 87.769, 114.896)   # ImageNet mean for the age net


# ─── Model download ──────────────────────────────────────────────────────────

def _progress_bar(downloaded, total):
    bar_len = 30
    filled  = int(bar_len * downloaded / total) if total else 0
    bar     = "█" * filled + "░" * (bar_len - filled)
    pct     = downloaded / total * 100 if total else 0
    mb_done = downloaded / 1_048_576
    mb_tot  = total      / 1_048_576
    print(f"\r  [{bar}] {pct:5.1f}%  {mb_done:.1f}/{mb_tot:.1f} MB", end="", flush=True)


def download_models():
    """Download model weights on first run."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    needed = [
        (fname, url)
        for fname, url in MODEL_FILES.items()
        if not os.path.exists(os.path.join(MODELS_DIR, fname))
        or os.path.getsize(os.path.join(MODELS_DIR, fname)) < 1024
    ]
    if not needed:
        return  # all present

    print("\n📦  First-run setup: downloading model weights (~28 MB total)…\n")
    for fname, url in needed:
        dest = os.path.join(MODELS_DIR, fname)
        print(f"  ↓  {fname}")
        try:
            urllib.request.urlretrieve(url, dest, reporthook=lambda b, bs, t: _progress_bar(b*bs, t))
            print()  # newline after progress bar
        except Exception as exc:
            print(f"\n  ✗  Failed: {exc}")
            print("     Make sure you have internet access and try again.")
            sys.exit(1)
    print("\n✅  Models ready!\n")


# ─── Network loader ──────────────────────────────────────────────────────────

def load_networks():
    face_proto  = os.path.join(MODELS_DIR, "opencv_face_detector.pbtxt")
    face_model  = os.path.join(MODELS_DIR, "opencv_face_detector_uint8.pb")
    age_proto   = os.path.join(MODELS_DIR, "age_deploy.prototxt")
    age_weights = os.path.join(MODELS_DIR, "age_net.caffemodel")

    face_net = cv2.dnn.readNet(face_model, face_proto)
    age_net  = cv2.dnn.readNet(age_weights, age_proto)

    # Prefer OpenCL/GPU if available, else CPU
    face_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_DEFAULT)
    face_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    age_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_DEFAULT)
    age_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    return face_net, age_net


# ─── Inference helpers ───────────────────────────────────────────────────────

def detect_faces(frame, net, conf_thresh=CONF_THRESH):
    """Return list of (x1,y1,x2,y2) bounding boxes."""
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1.0, INPUT_SIZE,
                                  [104, 117, 123], swapRB=False)
    net.setInput(blob)
    detections = net.forward()
    boxes = []
    for i in range(detections.shape[2]):
        conf = detections[0, 0, i, 2]
        if conf > conf_thresh:
            x1 = max(0, int(detections[0, 0, i, 3] * w))
            y1 = max(0, int(detections[0, 0, i, 4] * h))
            x2 = min(w - 1, int(detections[0, 0, i, 5] * w))
            y2 = min(h - 1, int(detections[0, 0, i, 6] * h))
            boxes.append((x1, y1, x2, y2))
    return boxes


def estimate_age(face_img, net):
    """Return (age_label, confidence_pct) for a cropped face image."""
    blob = cv2.dnn.blobFromImage(face_img, 1.0, AGE_INPUT_SIZE,
                                  MEAN_VALUES, swapRB=False)
    net.setInput(blob)
    preds = net.forward()[0]
    idx   = int(np.argmax(preds))
    return AGE_BUCKETS[idx], float(preds[idx]) * 100


# ─── Overlay drawing ─────────────────────────────────────────────────────────

def draw_overlay(frame, box, age_label, conf, fps):
    x1, y1, x2, y2 = box
    pad = 20
    h, w = frame.shape[:2]

    # Face bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, 2)

    # Age label badge
    label     = f"Age: {age_label}  ({conf:.0f}%)"
    (tw, th), baseline = cv2.getTextSize(label, FONT, 0.65, 2)
    bg_y1 = max(0, y1 - th - baseline - 10)
    bg_y2 = max(0, y1 - 2)
    bg_x2 = min(w - 1, x1 + tw + 8)

    cv2.rectangle(frame, (x1, bg_y1), (bg_x2, bg_y2), TEXT_BG_COLOR, -1)
    cv2.putText(frame, label, (x1 + 4, bg_y2 - baseline),
                FONT, 0.65, TEXT_COLOR, 2, cv2.LINE_AA)

    # FPS counter (top-left corner)
    fps_txt = f"FPS: {fps:.1f}"
    cv2.putText(frame, fps_txt, (12, 30), FONT, 0.7, (0, 220, 255), 2, cv2.LINE_AA)


def draw_no_face_hint(frame):
    msg = "No face detected — look at the camera"
    (tw, _), _ = cv2.getTextSize(msg, FONT, 0.6, 1)
    x = (frame.shape[1] - tw) // 2
    cv2.putText(frame, msg, (x, frame.shape[0] - 18),
                FONT, 0.6, (80, 80, 255), 1, cv2.LINE_AA)


# ─── Main loop ───────────────────────────────────────────────────────────────

def run():
    download_models()

    print("🔄  Loading neural networks…", end=" ", flush=True)
    face_net, age_net = load_networks()
    print("done.")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌  Could not open webcam. Check that a camera is connected.")
        sys.exit(1)
    start_time = time.time()
    detected_ages = []

    # Request 720p for better accuracy (falls back gracefully)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)   # minimise latency

    print("\n✅  Running!  Press  Q  to quit,  S  to save a screenshot.\n")

    fps_time    = time.perf_counter()
    fps         = 0.0
    frame_count = 0
    screenshot_n = 0

    while time.time() - start_time < 10:
        ret, frame = cap.read()
        if not ret:
            print("⚠️  Lost camera feed.")
            break

        frame_count += 1

        # ── FPS calculation (rolling over last 10 frames) ──────────────────
        if frame_count % 10 == 0:
            now  = time.perf_counter()
            fps  = 10 / (now - fps_time)
            fps_time = now

        # ── Face detection ─────────────────────────────────────────────────
        small  = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)  # detect on half-res for speed
        boxes  = detect_faces(small, face_net)

        # Scale boxes back to full resolution
        boxes = [(x1*2, y1*2, x2*2, y2*2) for x1, y1, x2, y2 in boxes]

        if not boxes:
            draw_no_face_hint(frame)
        else:
            for box in boxes:
                x1, y1, x2, y2 = box
                face_crop = frame[y1:y2, x1:x2]
                if face_crop.size == 0:
                    continue
                age_label, conf = estimate_age(face_crop, age_net)
                detected_ages.append(age_label)
                draw_overlay(frame, box, age_label, conf, fps)

        """
        # ── Display ────────────────────────────────────────────────────────
        #cv2.imshow("Age Estimator  [Q = quit | S = screenshot]", frame)

        #key = cv2.waitKey(1) & 0xFF
        #if key == ord('q') or key == ord('Q'):
        #   break
        #elif key == ord('s') or key == ord('S'):
            screenshot_n += 1
            fname = f"screenshot_{screenshot_n:03d}.png"
            cv2.imwrite(fname, frame)
            print(f"📸  Saved {fname}")
        """

        if detected_ages:
            from collections import Counter
            most_common_age = Counter(detected_ages).most_common(1)[0][0]
            print("\n🎯 Detected Age Group:", most_common_age)
        else:
            print("\n⚠️ No face detected in 10 seconds")

    cap.release()
    cv2.destroyAllWindows()
    print("\nGoodbye 👋")


if __name__ == "__main__":
    run()
