"""Validate the generated catalog JSON structure."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "twilio_sku_catalog.json"


def test_catalog_file_exists():
    assert CATALOG_PATH.exists(), "Catalog JSON must exist"


def test_catalog_has_120_rows():
    payload = json.loads(CATALOG_PATH.read_text())
    skus = payload.get("skus", [])
    assert len(skus) == 120, "Catalog must contain exactly 120 SKUs"


@pytest.mark.parametrize("field", [
    "sku_id",
    "name",
    "category",
    "theme",
    "unit",
    "rack_rate",
    "contract_rate",
    "discount_rate",
    "price_after_discount",
])
def test_catalog_rows_contain_required_fields(field):
    payload = json.loads(CATALOG_PATH.read_text())
    for sku in payload.get("skus", []):
        assert field in sku, f"Missing field {field} in SKU {sku.get('sku_id')}"
        assert sku[field] is not None


def test_discount_rate_bounds():
    payload = json.loads(CATALOG_PATH.read_text())
    for sku in payload.get("skus", []):
        assert 0 <= sku["discount_rate"] <= 1
        assert sku["price_after_discount"] <= sku["rack_rate"]
        assert sku["contract_rate"] <= sku["rack_rate"]
