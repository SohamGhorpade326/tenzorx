from pathlib import Path
import sys


SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


from main import health, root  # noqa: E402


def test_health_returns_expected_payload():
    assert health() == {
        "status": "ok",
        "service": "Video Onboarding API",
        "version": "1.0.0",
    }


def test_root_returns_expected_links():
    response = root()

    assert response["message"] == "Video Onboarding API"
    assert response["docs"] == "/docs"
    assert response["health"] == "/health"