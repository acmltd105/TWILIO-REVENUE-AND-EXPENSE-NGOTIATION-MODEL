"""Exercise the FastAPI negotiation endpoint."""
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.api import app

client = TestClient(app)

SCENARIO = {
    "startDate": "sep15",
    "trailing90": 250000,
    "leads": 500000,
    "wordsPerOutbound": 20,
    "conversationsPerLead": 1.0,
    "outboundPerConversation": 2.0,
    "inboundPerConversation": 2.0,
    "rcsAdoption": 0.5,
    "mmsShare": 0.2,
    "tollFreeShare": 0.3,
    "verifyAttemptsPerLead": 0.5,
    "verifySuccessRate": 0.9,
    "aiRepliesPerConversation": 1.0,
    "lookupsPerLead": 0.2,
    "callsPerLead": 0.1,
    "minutesPerCall": 3.5,
    "campaignsActive": 3,
    "askTierA": 32,
    "askTierB": 37,
    "askTierC": 45,
    "engagementRate": 19,
    "conversionRate": 1.0,
    "revenuePerSale": 120,
    "projectionStartSpend": 100000,
    "projectionGrowth": 12.5,
    "projectionMonths": 24,
}


def test_health_check():
    response = client.get("/healthz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"


def test_negotiation_endpoint_returns_envelope():
    response = client.post("/api/negotiation/envelope", json={"scenario": SCENARIO})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "envelope" in payload
    assert "target_discount" in payload["envelope"]
    assert payload["envelope"]["target_discount"] > 0
    assert payload["audit"]["revenue"] > 0
