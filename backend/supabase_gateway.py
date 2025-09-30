"""Supabase client wrapper with graceful degradation."""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional

from .config import Settings
from . import sample_data

logger = logging.getLogger(__name__)


class SupabaseGateway:
    """Facade around Supabase with local fixture fallback."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = None
        self._lock = threading.Lock()
        self._last_refresh = 0.0
        self._cache: Dict[str, Any] = {
            "invoices": sample_data.get_invoice_fixtures(),
            "revenue_streams": sample_data.get_revenue_fixtures(),
            "expense_streams": sample_data.get_expense_fixtures(),
        }
        self._connect()

    def _connect(self) -> None:
        if not self._settings.supabase_url or not self._settings.supabase_key:
            logger.warning("Supabase credentials missing; using offline fixtures.")
            return
        try:
            from supabase import Client, create_client  # type: ignore

            self._client = create_client(self._settings.supabase_url, self._settings.supabase_key)
            logger.info("Supabase client initialised.")
        except Exception as exc:  # pragma: no cover - exercised via tests by monkeypatching
            logger.error("Failed to initialise Supabase client: %s", exc)
            self._client = None

    # --- public API -----------------------------------------------------
    def fetch_invoices(self, *, force: bool = False) -> List[Dict[str, Any]]:
        return self._get_or_refresh(
            cache_key="invoices",
            fetcher=self._fetch_supabase_invoices,
            force=force,
        )

    def fetch_revenue_streams(self, *, force: bool = False) -> List[Dict[str, Any]]:
        return self._get_or_refresh(
            cache_key="revenue_streams",
            fetcher=self._fetch_supabase_revenue,
            force=force,
        )

    def fetch_expense_streams(self, *, force: bool = False) -> List[Dict[str, Any]]:
        return self._get_or_refresh(
            cache_key="expense_streams",
            fetcher=self._fetch_supabase_expense,
            force=force,
        )

    def _get_or_refresh(self, cache_key: str, fetcher, *, force: bool = False) -> List[Dict[str, Any]]:
        with self._lock:
            now = time.time()
            if not force and now - self._last_refresh < 60 and cache_key in self._cache:
                return [item.copy() for item in self._cache[cache_key]]

            data = None
            if self._client is not None:
                try:
                    data = fetcher()
                except Exception as exc:  # pragma: no cover - tested via monkeypatch
                    logger.error("Supabase fetch failed (%s): %s", cache_key, exc)
                    self._client = None

            if data is None:
                logger.info("Using cached fixtures for %s", cache_key)
                getter = getattr(sample_data, f"get_{cache_key}")
                data = getter()

            self._cache[cache_key] = data
            self._last_refresh = now
            return [item.copy() for item in data]

    # --- private fetchers ----------------------------------------------
    def _fetch_supabase_invoices(self) -> Optional[List[Dict[str, Any]]]:
        if self._client is None:
            return None
        table = self._settings.supabase_invoice_table
        response = self._client.table(table).select("*").execute()
        data = getattr(response, "data", None)
        if not data:
            return None
        return [self._normalise_invoice(item) for item in data]

    def _fetch_supabase_revenue(self) -> Optional[List[Dict[str, Any]]]:
        if self._client is None:
            return None
        table = self._settings.supabase_stream_table
        response = self._client.table(table).select("*").eq("type", "revenue").execute()
        data = getattr(response, "data", None)
        if not data:
            return None
        return [self._normalise_revenue(item) for item in data]

    def _fetch_supabase_expense(self) -> Optional[List[Dict[str, Any]]]:
        if self._client is None:
            return None
        table = self._settings.supabase_stream_table
        response = self._client.table(table).select("*").eq("type", "expense").execute()
        data = getattr(response, "data", None)
        if not data:
            return None
        return [self._normalise_expense(item) for item in data]

    # --- normalisers ----------------------------------------------------
    @staticmethod
    def _normalise_invoice(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "invoice_id": item.get("invoice_id") or item.get("id"),
            "period_start": item.get("period_start"),
            "period_end": item.get("period_end"),
            "amount_usd": float(item.get("amount_usd", 0.0)),
            "status": item.get("status", "unknown"),
        }

    @staticmethod
    def _normalise_revenue(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "name": item.get("name"),
            "unit_price": str(item.get("unit_price", "0")),
            "list_unit_price": str(item.get("list_unit_price", item.get("list_price", "0"))),
            "volume": int(item.get("volume", 0)),
            "currency": item.get("currency", "USD"),
        }

    @staticmethod
    def _normalise_expense(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "name": item.get("name"),
            "unit_cost": str(item.get("unit_cost", item.get("unit_price", "0"))),
            "volume": int(item.get("volume", 0)),
            "currency": item.get("currency", "USD"),
        }


__all__ = ["SupabaseGateway"]
