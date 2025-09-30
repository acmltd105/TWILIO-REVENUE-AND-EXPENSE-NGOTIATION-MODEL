"""Configuration utilities for the backend service."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional


@dataclass(frozen=True)
class Settings:
    """Strongly typed settings with safe defaults."""

    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    supabase_schema: str = "public"
    supabase_invoice_table: str = "invoices"
    supabase_stream_table: str = "revenue_streams"
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_number: Optional[str] = None
    notification_recipient: Optional[str] = None
    api_prefix: str = "/api/v1"
    cache_path: str = os.path.expanduser("~/.twilio-negotiation/cache.json")
    fallback_currency: str = "USD"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load settings from environment variables once."""

    return Settings(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"),
        supabase_schema=os.getenv("SUPABASE_SCHEMA", "public"),
        supabase_invoice_table=os.getenv("SUPABASE_INVOICE_TABLE", "invoices"),
        supabase_stream_table=os.getenv("SUPABASE_STREAM_TABLE", "revenue_streams"),
        twilio_account_sid=os.getenv("TWILIO_ACCOUNT_SID"),
        twilio_auth_token=os.getenv("TWILIO_AUTH_TOKEN"),
        twilio_from_number=os.getenv("TWILIO_FROM_NUMBER"),
        notification_recipient=os.getenv("NOTIFICATION_RECIPIENT"),
        api_prefix=os.getenv("API_PREFIX", "/api/v1"),
        cache_path=os.getenv("NEGOTIATION_CACHE_PATH", os.path.expanduser("~/.twilio-negotiation/cache.json")),
        fallback_currency=os.getenv("NEGOTIATION_CURRENCY", "USD"),
    )


__all__ = ["Settings", "get_settings"]
