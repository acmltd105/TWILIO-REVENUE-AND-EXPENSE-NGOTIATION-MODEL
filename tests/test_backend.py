import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from backend.config import Settings


class StubSupabase:
    def __init__(self):
        self._client = None

    def fetch_invoices(self, force: bool = False):  # noqa: D401 - test stub
        return [
            {"invoice_id": "INV-1", "amount_usd": 10.0},
            {"invoice_id": "INV-2", "amount_usd": 20.0},
        ]

    def fetch_revenue_streams(self, force: bool = False):
        return [
            {"name": "sms", "unit_price": "0.01", "list_unit_price": "0.015", "volume": 1000, "currency": "USD"}
        ]

    def fetch_expense_streams(self, force: bool = False):
        return [
            {"name": "sms_cost", "unit_cost": "0.002", "volume": 1000, "currency": "USD"}
        ]


class StubTwilio:
    def __init__(self):
        self._client = None
        self._sent = []

    def queued_notifications(self):
        return len(self._sent)

    def send_notification(self, body: str, *, to=None):
        self._sent.append(body)
        return type("Result", (), {"delivered": False, "sid": None, "message": "queued"})()


@pytest.fixture
def client():
    settings = Settings()

    # override service dependencies
    from backend import app as app_module

    app_module.SupabaseGateway = lambda settings: StubSupabase()
    app_module.TwilioGateway = lambda settings: StubTwilio()

    test_app = app_module.create_app(settings)
    return TestClient(test_app)


def test_health_endpoint_reports_status(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert "supabase_online" in payload
    assert "twilio_online" in payload
    assert "correlation_id" in payload


def test_negotiation_endpoint_returns_payload(client):
    response = client.get("/api/v1/negotiation")
    assert response.status_code == 200
    payload = response.json()
    assert pytest.approx(payload["expense"], rel=1e-3) >= 0
    assert payload["currency"] == "USD"


def test_notification_endpoint_queues_when_twilio_missing(client):
    response = client.post("/api/v1/notifications/demo")
    assert response.status_code == 200
    payload = response.json()
    assert payload["delivered"] is False
    assert payload["queued"] >= 0
