"""Offline fixtures to guarantee graceful degradation when Supabase is unavailable."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List

_SAMPLE_INVOICES: List[Dict[str, Any]] = [
    {
        "invoice_id": "INV-1001",
        "period_start": date(2024, 1, 1).isoformat(),
        "period_end": date(2024, 1, 31).isoformat(),
        "amount_usd": 15800.50,
        "status": "paid",
    },
    {
        "invoice_id": "INV-1002",
        "period_start": date(2024, 2, 1).isoformat(),
        "period_end": date(2024, 2, 29).isoformat(),
        "amount_usd": 16210.91,
        "status": "paid",
    },
    {
        "invoice_id": "INV-1003",
        "period_start": date(2024, 3, 1).isoformat(),
        "period_end": date(2024, 3, 31).isoformat(),
        "amount_usd": 15002.37,
        "status": "open",
    },
]

_SAMPLE_REVENUE_STREAMS: List[Dict[str, Any]] = [
    {
        "name": "sms",
        "unit_price": "0.0075",
        "list_unit_price": "0.0100",
        "volume": 120_000,
        "currency": "USD",
    },
    {
        "name": "voice",
        "unit_price": "0.0120",
        "list_unit_price": "0.0150",
        "volume": 25_000,
        "currency": "USD",
    },
]

_SAMPLE_EXPENSE_STREAMS: List[Dict[str, Any]] = [
    {
        "name": "sms_cost",
        "unit_cost": "0.0021",
        "volume": 120_000,
        "currency": "USD",
    },
    {
        "name": "voice_cost",
        "unit_cost": "0.0036",
        "volume": 25_000,
        "currency": "USD",
    },
]


def get_invoice_fixtures() -> List[Dict[str, Any]]:
    """Return deep copies to prevent mutation from leaking."""

    return [invoice.copy() for invoice in _SAMPLE_INVOICES]


def get_revenue_fixtures() -> List[Dict[str, Any]]:
    return [stream.copy() for stream in _SAMPLE_REVENUE_STREAMS]


def get_expense_fixtures() -> List[Dict[str, Any]]:
    return [stream.copy() for stream in _SAMPLE_EXPENSE_STREAMS]


def invoice_totals(invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = sum(Decimal(str(invoice["amount_usd"])) for invoice in invoices)
    return {
        "total": float(total),
        "currency": "USD",
        "count": len(invoices),
    }


__all__ = [
    "get_invoice_fixtures",
    "get_revenue_fixtures",
    "get_expense_fixtures",
    "invoice_totals",
]
