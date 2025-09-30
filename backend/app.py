"""FastAPI application wiring for the negotiation platform."""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .services import NegotiationService, format_health_payload
from .supabase_gateway import SupabaseGateway
from .twilio_gateway import TwilioGateway

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(title="Twilio Negotiation Backend", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    supabase_gateway = SupabaseGateway(settings)
    twilio_gateway = TwilioGateway(settings)
    service = NegotiationService(settings, supabase_gateway, twilio_gateway)

    def get_service() -> NegotiationService:
        return service

    prefix = settings.api_prefix.rstrip("/")

    @app.get(f"{prefix}/health", tags=["health"])
    def health_endpoint(service: NegotiationService = Depends(get_service)) -> Dict[str, Any]:
        health = service.health()
        payload = format_health_payload(health)
        logger.info("Health check: %s", payload)
        return payload

    @app.get(f"{prefix}/invoices", tags=["invoices"])
    def invoices_endpoint(service: NegotiationService = Depends(get_service)) -> Dict[str, Any]:
        return service.invoice_summary()

    @app.get(f"{prefix}/negotiation", tags=["negotiation"])
    def negotiation_endpoint(service: NegotiationService = Depends(get_service)) -> Dict[str, Any]:
        return service.negotiation_envelope()

    @app.post(f"{prefix}/notifications/demo", tags=["notifications"])
    def notification_endpoint(service: NegotiationService = Depends(get_service)) -> Dict[str, Any]:
        envelope = service.negotiation_envelope()
        result = service.send_demo_notification(envelope)
        return {
            "delivered": result.delivered,
            "sid": result.sid,
            "message": result.message,
            "queued": service.health().cached_notifications,
        }

    return app


app = create_app()


__all__ = ["create_app", "app"]
