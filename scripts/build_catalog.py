"""Generate a normalized Twilio SKU catalog with computed discount data."""
from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Iterable, List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PUBLIC_DIR = BASE_DIR / "apps" / "pro-dashboard" / "public"
DOCS_DIR = BASE_DIR / "docs"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Block:
    """Template data for generating a group of related SKUs."""

    category: str
    theme: str
    prefix: str
    unit: str
    rack_start: Decimal
    rack_step: Decimal
    contract_discount: Decimal
    ladder_discount: Decimal
    count: int
    locked_every: int = 0


def quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


def expand(block: Block, offset: int) -> Iterable[dict]:
    for index in range(block.count):
        sku_index = offset + index + 1
        rack = block.rack_start + block.rack_step * index
        rack = quantize(rack)
        contract_rate = quantize(rack * (Decimal(1) - block.contract_discount))
        discount_rate = block.ladder_discount
        price_after_discount = quantize(rack * (Decimal(1) - discount_rate))
        locked = block.locked_every > 0 and (index + 1) % block.locked_every == 0
        yield {
            "sku_id": f"{block.prefix}-{sku_index:03d}",
            "name": f"{block.theme} Tier {index + 1}",
            "category": block.category,
            "theme": block.theme,
            "unit": block.unit,
            "rack_rate": float(rack),
            "contract_rate": float(contract_rate),
            "discount_rate": float(discount_rate),
            "price_after_discount": float(price_after_discount),
            "ladder": {
                "tier_a": float(block.ladder_discount),
                "tier_b": float(block.ladder_discount + Decimal("0.05")),
                "tier_c": float(block.ladder_discount + Decimal("0.09")),
            },
            "locked": locked,
            "notes": (
                f"{block.theme} negotiated unit for portfolio ladder at {discount_rate:.0%} discount."
            ),
        }


def generate_catalog() -> List[dict]:
    blocks: List[Block] = [
        Block(
            category="Messaging",
            theme="SMS Standard",
            prefix="SMSSTD",
            unit="message",
            rack_start=Decimal("0.0072"),
            rack_step=Decimal("0.00005"),
            contract_discount=Decimal("0.34"),
            ladder_discount=Decimal("0.32"),
            count=10,
            locked_every=5,
        ),
        Block(
            category="Messaging",
            theme="SMS Toll-Free",
            prefix="SMSTF",
            unit="message",
            rack_start=Decimal("0.0089"),
            rack_step=Decimal("0.00004"),
            contract_discount=Decimal("0.36"),
            ladder_discount=Decimal("0.33"),
            count=10,
            locked_every=5,
        ),
        Block(
            category="Messaging",
            theme="SMS Short Code",
            prefix="SMSSC",
            unit="message",
            rack_start=Decimal("0.0095"),
            rack_step=Decimal("0.00008"),
            contract_discount=Decimal("0.4"),
            ladder_discount=Decimal("0.35"),
            count=10,
            locked_every=5,
        ),
        Block(
            category="Messaging",
            theme="MMS",
            prefix="MMS",
            unit="message",
            rack_start=Decimal("0.015"),
            rack_step=Decimal("0.00012"),
            contract_discount=Decimal("0.33"),
            ladder_discount=Decimal("0.3"),
            count=10,
            locked_every=5,
        ),
        Block(
            category="Messaging",
            theme="RCS",
            prefix="RCS",
            unit="session",
            rack_start=Decimal("0.035"),
            rack_step=Decimal("0.0003"),
            contract_discount=Decimal("0.38"),
            ladder_discount=Decimal("0.34"),
            count=10,
        ),
        Block(
            category="Messaging",
            theme="WhatsApp",
            prefix="WA",
            unit="conversation",
            rack_start=Decimal("0.043"),
            rack_step=Decimal("0.00035"),
            contract_discount=Decimal("0.31"),
            ladder_discount=Decimal("0.29"),
            count=10,
        ),
        Block(
            category="Voice",
            theme="PSTN Outbound",
            prefix="VOIPSTN",
            unit="minute",
            rack_start=Decimal("0.018"),
            rack_step=Decimal("0.0001"),
            contract_discount=Decimal("0.37"),
            ladder_discount=Decimal("0.33"),
            count=10,
        ),
        Block(
            category="Voice",
            theme="Elastic SIP",
            prefix="VOISIP",
            unit="minute",
            rack_start=Decimal("0.014"),
            rack_step=Decimal("0.00008"),
            contract_discount=Decimal("0.35"),
            ladder_discount=Decimal("0.31"),
            count=10,
        ),
        Block(
            category="Trust & Safety",
            theme="Verify",
            prefix="VERIFY",
            unit="verification",
            rack_start=Decimal("0.045"),
            rack_step=Decimal("0.0004"),
            contract_discount=Decimal("0.3"),
            ladder_discount=Decimal("0.27"),
            count=10,
        ),
        Block(
            category="Data & AI",
            theme="Twilio Segment",
            prefix="SEG",
            unit="mtu",
            rack_start=Decimal("0.035"),
            rack_step=Decimal("0.00025"),
            contract_discount=Decimal("0.28"),
            ladder_discount=Decimal("0.26"),
            count=10,
        ),
        Block(
            category="Engagement",
            theme="Flex Seats",
            prefix="FLEX",
            unit="agent",
            rack_start=Decimal("150"),
            rack_step=Decimal("1.6"),
            contract_discount=Decimal("0.22"),
            ladder_discount=Decimal("0.2"),
            count=10,
            locked_every=5,
        ),
        Block(
            category="Email",
            theme="SendGrid",
            prefix="EMAIL",
            unit="thousand-emails",
            rack_start=Decimal("1.12"),
            rack_step=Decimal("0.008"),
            contract_discount=Decimal("0.25"),
            ladder_discount=Decimal("0.22"),
            count=10,
        ),
    ]

    items: List[dict] = []
    offset = 0
    for block in blocks:
        block_items = list(expand(block, offset))
        items.extend(block_items)
        offset += block.count

    if len(items) != 120:
        raise RuntimeError(f"Expected 120 SKUs, generated {len(items)}")

    return items


def write_targets(catalog: List[dict]) -> None:
    payload = {"generated_at": "auto", "skus": catalog}
    targets = [
        DATA_DIR / "twilio_sku_catalog.json",
        PUBLIC_DIR / "twilio_sku_catalog.json",
        DOCS_DIR / "twilio_sku_catalog.json",
    ]
    for path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2))


if __name__ == "__main__":
    catalog = generate_catalog()
    write_targets(catalog)
    print(f"Catalog generated with {len(catalog)} SKUs")
