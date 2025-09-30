"""Domain services combining Supabase, negotiation model, and Twilio notifications."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Mapping

from fastapi import HTTPException

from twilio_revenue_and_expense_ngotiation_model import (
    calculate_negotiation_envelope,
)

from .config import Settings
from .supabase_gateway import SupabaseGateway
from .twilio_gateway import NotificationResult, TwilioGateway

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    supabase_online: bool
    twilio_online: bool
    cached_notifications: int
    generated_at: datetime


class NegotiationService:
    """Orchestrates data access and negotiation logic."""

    def __init__(self, settings: Settings, supabase: SupabaseGateway, twilio: TwilioGateway) -> None:
        self._settings = settings
        self._supabase = supabase
        self._twilio = twilio

    # ------------------------------------------------------------------
    def health(self) -> HealthStatus:
        _ = self._supabase.fetch_invoices()
        supabase_online = bool(self._supabase._client)  # type: ignore[attr-defined]
        twilio_online = self._twilio.queued_notifications() == 0 and self._twilio._client is not None  # type: ignore[attr-defined]
        return HealthStatus(
            supabase_online=supabase_online,
            twilio_online=twilio_online,
            cached_notifications=self._twilio.queued_notifications(),
            generated_at=datetime.utcnow(),
        )

    def invoice_summary(self) -> Dict[str, Any]:
        invoices = self._supabase.fetch_invoices()
        totals = sample_invoice_totals(invoices)
        return {
            "invoices": invoices,
            "totals": totals,
        }

    def negotiation_envelope(self) -> Mapping[str, Any]:
        revenue_streams = self._supabase.fetch_revenue_streams()
        expense_streams = self._supabase.fetch_expense_streams()
        if not revenue_streams or not expense_streams:
            raise HTTPException(status_code=503, detail="Insufficient data to compute negotiation envelope.")

        envelope = calculate_negotiation_envelope(
            revenue_streams,
            expense_streams,
            target_margin="35%",
            reserve_band="200bp",
            currency=self._settings.fallback_currency,
            return_dataclass=True,
        )
        return envelope.to_dict(numeric_type=float)

    def send_demo_notification(self, payload: Mapping[str, Any]) -> NotificationResult:
        message = (
            "Negotiation snapshot "
            f"(target margin: {payload.get('target_margin')}, revenue: {payload.get('revenue')})."
        )
        return self._twilio.send_notification(message)


def sample_invoice_totals(invoices: List[Mapping[str, Any]]) -> Dict[str, Any]:
    total = sum(Decimal(str(invoice.get("amount_usd", 0))) for invoice in invoices)
    return {
        "total": float(total.quantize(Decimal("0.01"))),
        "count": len(invoices),
        "currency": "USD",
    }


def format_health_payload(health: HealthStatus) -> Dict[str, Any]:
    return {
        "supabase_online": health.supabase_online,
        "twilio_online": health.twilio_online,
        "cached_notifications": health.cached_notifications,
        "generated_at": health.generated_at.isoformat() + "Z",
        "correlation_id": str(uuid.uuid4()),
    }


__all__ = [
    "NegotiationService",
    "HealthStatus",
    "format_health_payload",
    "sample_invoice_totals",
]
