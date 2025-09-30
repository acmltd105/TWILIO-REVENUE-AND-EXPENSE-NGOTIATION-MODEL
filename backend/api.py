"""FastAPI app that exposes the negotiation model and scenario persistence."""
from __future__ import annotations

import json
import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:  # Optional dependency
    from supabase import Client as SupabaseClient, create_client
except Exception:  # pragma: no cover - supabase optional
    SupabaseClient = None  # type: ignore
    create_client = None  # type: ignore

from twilio_revenue_and_expense_ngotiation_model.model import (  # noqa: E402
    NegotiationEnvelope,
    calculate_negotiation_envelope,
)

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "twilio_sku_catalog.json"
SCENARIO_CACHE = Path(__file__).resolve().parent.parent / "data" / "scenario_cache.json"
CATALOG_PAYLOAD = json.loads(CATALOG_PATH.read_text())
TOTAL_SKUS = len(CATALOG_PAYLOAD.get("skus", []))


class ScenarioPayload(BaseModel):
    start_date: str = Field(alias="startDate", pattern="^sep(1|15)$")
    trailing_90: float = Field(alias="trailing90", ge=0)
    leads: int = Field(ge=0)
    words_per_outbound: float = Field(alias="wordsPerOutbound", ge=0)
    conversations_per_lead: float = Field(alias="conversationsPerLead", ge=0)
    outbound_per_conversation: float = Field(alias="outboundPerConversation", ge=0)
    inbound_per_conversation: float = Field(alias="inboundPerConversation", ge=0)
    rcs_adoption: float = Field(alias="rcsAdoption", ge=0, le=1)
    mms_share: float = Field(alias="mmsShare", ge=0, le=1)
    toll_free_share: float = Field(alias="tollFreeShare", ge=0, le=1)
    verify_attempts_per_lead: float = Field(alias="verifyAttemptsPerLead", ge=0)
    verify_success_rate: float = Field(alias="verifySuccessRate", ge=0, le=1)
    ai_replies_per_conversation: float = Field(alias="aiRepliesPerConversation", ge=0)
    lookups_per_lead: float = Field(alias="lookupsPerLead", ge=0)
    calls_per_lead: float = Field(alias="callsPerLead", ge=0)
    minutes_per_call: float = Field(alias="minutesPerCall", ge=0)
    campaigns_active: float = Field(alias="campaignsActive", ge=0)
    ask_tier_a: float = Field(alias="askTierA", ge=0, le=100)
    ask_tier_b: float = Field(alias="askTierB", ge=0, le=100)
    ask_tier_c: float = Field(alias="askTierC", ge=0, le=100)
    engagement_rate: float = Field(alias="engagementRate", ge=0)
    conversion_rate: float = Field(alias="conversionRate", ge=0)
    revenue_per_sale: float = Field(alias="revenuePerSale", ge=0)
    projection_start_spend: float = Field(alias="projectionStartSpend", ge=0)
    projection_growth: float = Field(alias="projectionGrowth")
    projection_months: int = Field(alias="projectionMonths", ge=1)

    class Config:
        populate_by_name = True


class NegotiationRequest(BaseModel):
    scenario: ScenarioPayload


class NegotiationResponse(BaseModel):
    envelope: Dict[str, Any]
    audit: Dict[str, float]


def load_catalog() -> Dict[str, Dict[str, float]]:
    payload = CATALOG_PAYLOAD
    theme_map: Dict[str, Dict[str, float]] = {}
    for sku in payload["skus"]:
        theme = sku["theme"]
        entry = theme_map.setdefault(
            theme,
            {"rack": 0.0, "effective": 0.0, "count": 0},
        )
        entry["rack"] += sku["rack_rate"]
        effective_rate = sku.get("price_after_discount") or sku.get("contract_rate") or sku["rack_rate"]
        entry["effective"] += effective_rate
        entry["count"] += 1
    for theme, entry in theme_map.items():
        if entry["count"]:
            entry["rack"] /= entry["count"]
            entry["effective"] /= entry["count"]
    return theme_map


@lru_cache(maxsize=1)
def catalog_theme_rates() -> Dict[str, Dict[str, float]]:
    return load_catalog()


def segments_from_words(words: float) -> float:
    characters = max(words, 0) * 5.2
    if characters <= 160:
        return 1.0
    return float(int(-(-characters // 153)))


def derive_drivers(payload: ScenarioPayload) -> Dict[str, float]:
    leads = max(payload.leads, 0)
    conversations = leads * max(payload.conversations_per_lead, 0)
    outbound = conversations * max(payload.outbound_per_conversation, 0)
    inbound = conversations * max(payload.inbound_per_conversation, 0)
    segments = segments_from_words(payload.words_per_outbound)

    rcs_messages = outbound * min(max(payload.rcs_adoption, 0), 1)
    non_rcs = max(outbound - rcs_messages, 0)
    mms_messages = non_rcs * min(max(payload.mms_share, 0), 1)
    sms_outbound = max(non_rcs - mms_messages, 0)
    sms_segments = sms_outbound * segments
    toll_free_segments = sms_segments * min(max(payload.toll_free_share, 0), 1)
    standard_segments = max(sms_segments - toll_free_segments, 0)

    verify_checks = leads * payload.verify_attempts_per_lead * min(max(payload.verify_success_rate, 0), 1)
    ai_responses = conversations * payload.ai_replies_per_conversation
    lookups = leads * payload.lookups_per_lead
    voice_minutes = leads * payload.calls_per_lead * payload.minutes_per_call
    whatsapp_conversations = conversations * 0.22
    flex_seats = max(60.0, conversations * 0.0015)
    email_thousands = max(1.0, leads * 0.45 / 1000)
    segment_mtus = max(leads * 0.55, flex_seats * 40)

    return {
        "leads": leads,
        "conversations": conversations,
        "outbound": outbound,
        "inbound": inbound,
        "segments": segments,
        "sms_standard": standard_segments,
        "sms_toll_free": toll_free_segments,
        "mms_messages": mms_messages,
        "rcs_messages": rcs_messages,
        "verify_checks": verify_checks,
        "ai_responses": ai_responses,
        "lookups": lookups,
        "voice_minutes": voice_minutes,
        "whatsapp": whatsapp_conversations,
        "flex_seats": flex_seats,
        "email_thousands": email_thousands,
        "segment_mtus": segment_mtus,
    }


def build_streams(payload: ScenarioPayload, drivers: Dict[str, float]):
    theme_rates = catalog_theme_rates()
    volume_map = {
        "SMS Standard": drivers["sms_standard"],
        "SMS Toll-Free": drivers["sms_toll_free"],
        "SMS Short Code": drivers["sms_standard"] * 0.18,
        "MMS": drivers["mms_messages"],
        "RCS": drivers["rcs_messages"],
        "WhatsApp": drivers["whatsapp"],
        "PSTN Outbound": drivers["voice_minutes"],
        "Elastic SIP": drivers["voice_minutes"] * 0.35,
        "Verify": drivers["verify_checks"],
        "Twilio Segment": drivers["segment_mtus"],
        "Flex Seats": drivers["flex_seats"],
        "SendGrid": drivers["email_thousands"],
    }

    revenue_streams = []
    expense_streams = []
    list_revenue = 0.0
    for theme, volume in volume_map.items():
        if volume <= 0:
            continue
        rates = theme_rates.get(theme)
        if not rates:
            continue
        effective = rates["effective"]
        rack = rates["rack"]
        revenue_streams.append(
            {
                "name": theme,
                "unit_price": f"{effective:.6f}",
                "list_unit_price": f"{rack:.6f}",
                "volume": max(volume, 0),
            }
        )
        list_revenue += rack * volume
        expense_streams.append(
            {
                "name": f"{theme}_cost",
                "unit_cost": f"{(effective * 0.45):.6f}",
                "volume": max(volume, 0),
            }
        )
    return revenue_streams, expense_streams, list_revenue


def compute_envelope(payload: ScenarioPayload) -> NegotiationEnvelope:
    drivers = derive_drivers(payload)
    revenue_streams, expense_streams, list_revenue = build_streams(payload, drivers)
    if not revenue_streams:
        raise HTTPException(status_code=400, detail="Scenario produces no revenue streams")
    reserve_band = max(payload.ask_tier_b - payload.ask_tier_a, 1.0) / 100
    envelope = calculate_negotiation_envelope(
        revenue_streams,
        expense_streams,
        target_margin=f"{payload.ask_tier_b / 100:.4f}",
        floor_margin=f"{payload.ask_tier_a / 100:.4f}",
        ceiling_margin=f"{payload.ask_tier_c / 100:.4f}",
        currency="USD",
        list_revenue=list_revenue,
        reserve_band=reserve_band,
        return_dataclass=True,
    )
    return envelope  # type: ignore[return-value]


def get_supabase_client() -> Optional[SupabaseClient]:
    if not create_client:
        return None
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def persist_scenario(payload: ScenarioPayload) -> None:
    supabase = get_supabase_client()
    record = {
        "slug": "executive-pro",
        "payload": payload.dict(by_alias=True),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if supabase is not None:
        try:
            supabase.table("scenarios").upsert(record, on_conflict="slug").execute()
            return
        except Exception as exc:  # pragma: no cover - network issue
            print(f"Supabase persistence failed: {exc}")
    SCENARIO_CACHE.parent.mkdir(parents=True, exist_ok=True)
    SCENARIO_CACHE.write_text(json.dumps(record, indent=2))


app = FastAPI(title="Twilio Negotiation API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"],
)


@app.get("/healthz")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "catalog": str(CATALOG_PATH)}


@app.post("/api/negotiation/envelope", response_model=NegotiationResponse)
def negotiation_endpoint(request: NegotiationRequest) -> NegotiationResponse:
    envelope = compute_envelope(request.scenario)
    persist_scenario(request.scenario)
    envelope_dict = envelope.to_dict() if isinstance(envelope, NegotiationEnvelope) else envelope
    audit = {
        "revenue": float(envelope_dict.get("revenue", 0.0)),
        "expense": float(envelope_dict.get("expense", 0.0)),
        "current_margin": float(envelope_dict.get("current_margin", 0.0)),
    }
    return NegotiationResponse(envelope=envelope_dict, audit=audit)


@app.get("/api/catalog/summary")
def catalog_summary() -> Dict[str, int]:
    rates = catalog_theme_rates()
    sku_count = TOTAL_SKUS
    return {"themes": len(rates), "sku_count": sku_count}


@app.get("/api/scenarios/latest")
def latest_scenario() -> Dict[str, object]:
    if SCENARIO_CACHE.exists():
        return json.loads(SCENARIO_CACHE.read_text())
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(status_code=404, detail="No cached scenario available")
    response = supabase.table("scenarios").select("payload", "updated_at").eq("slug", "executive-pro").limit(1).execute()
    data = response.data  # type: ignore[attr-defined]
    if not data:
        raise HTTPException(status_code=404, detail="No cached scenario available")
    return data[0]
