from decimal import Decimal

import pytest

from twilio_revenue_and_expense_ngotiation_model import (
    NegotiationEnvelope,
    calculate_negotiation_envelope,
    determine_margin_envelope,
)


def test_calculate_envelope_with_stream_breakdown():
    revenue_streams = [
        {
            "name": "sms",
            "unit_price": "0.0075",
            "volume": 100_000,
            "list_unit_price": "0.0100",
        },
        {
            "name": "voice",
            "unit_price": "0.012",
            "volume": 20_000,
            "list_unit_price": "0.015",
        },
    ]
    expense_streams = [
        {"name": "sms_cost", "unit_cost": "0.002", "volume": 100_000},
        {"name": "voice_cost", "unit_cost": "0.0035", "volume": 20_000},
    ]

    envelope = calculate_negotiation_envelope(
        revenue_streams,
        expense_streams,
        target_margin="70%",
        floor_margin="65%",
        ceiling_margin="75%",
    )

    assert envelope["currency"] == "USD"
    assert envelope["revenue"] == pytest.approx(990.0)
    assert envelope["expense"] == pytest.approx(270.0)
    assert envelope["current_margin"] == pytest.approx(0.7273, abs=1e-4)
    assert envelope["target_revenue"] == pytest.approx(900.0)
    assert envelope["floor_revenue"] == pytest.approx(771.43, abs=0.01)
    assert envelope["ceiling_revenue"] == pytest.approx(1080.0)
    assert envelope["target_discount"] == pytest.approx(0.3077, abs=1e-4)
    assert envelope["floor_discount"] == pytest.approx(0.4066, abs=1e-4)
    assert envelope["ceiling_discount"] == pytest.approx(0.1692, abs=1e-4)
    assert len(envelope["audit_trail"]["breakdown"]["revenue"]) == 2
    assert len(envelope["audit_trail"]["breakdown"]["expense"]) == 2


def test_determine_margin_envelope_with_basis_points():
    margins = determine_margin_envelope(
        {"total": "125000", "currency": "USD"},
        82_000,
        target_margin="38%",
        reserve_band="50bp",
    )

    assert margins["target_margin"] == Decimal("0.3800")
    assert margins["floor_margin"] == Decimal("0.3750")
    assert margins["ceiling_margin"] == Decimal("0.3850")


def test_calculate_envelope_dataclass_return():
    envelope = calculate_negotiation_envelope(
        1000,
        620,
        target_margin=0.35,
        reserve_band=Decimal("0.02"),
        currency="EUR",
        numeric_type=Decimal,
        return_dataclass=True,
    )

    assert isinstance(envelope, NegotiationEnvelope)
    assert envelope.currency == "EUR"
    assert envelope.target_margin == Decimal("0.3500")
    assert envelope.floor_margin == Decimal("0.3300")
    assert envelope.ceiling_margin == Decimal("0.3700")
    assert envelope.target_revenue == Decimal("953.85")
