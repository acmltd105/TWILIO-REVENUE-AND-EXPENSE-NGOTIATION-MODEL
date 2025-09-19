"""Core negotiation model primitives."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_EVEN, getcontext
from types import MappingProxyType
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple, Union

getcontext().prec = 28

MoneyLike = Union[int, float, str, Decimal]
StreamLike = Union[MoneyLike, Mapping[str, Any], Sequence[Any], Any]

_CURRENCY_SYMBOLS = "€£¥₽₹₩₺₴₦₱₪฿₫₭₲₵₡$"
_CURRENCY_SYMBOL_TRANSLATION = str.maketrans("", "", _CURRENCY_SYMBOLS)
_MULTI_CHAR_CURRENCY_SYMBOLS = (
    "R$",
    "A$",
    "C$",
    "CA$",
    "HK$",
    "NZ$",
    "S$",
    "US$",
    "CN¥",
    "JP¥",
    "NT$",
    "AU$",
)

CURRENCY_MINOR_UNITS: Mapping[str, int] = MappingProxyType(
    {
        "USD": 2,
        "EUR": 2,
        "GBP": 2,
        "AUD": 2,
        "CAD": 2,
        "CHF": 2,
        "NOK": 2,
        "SEK": 2,
        "DKK": 2,
        "PLN": 2,
        "CZK": 2,
        "MXN": 2,
        "BRL": 2,
        "ILS": 2,
        "SGD": 2,
        "HKD": 2,
        "TWD": 2,
        "CNY": 2,
        "INR": 2,
        "ZAR": 2,
        "RUB": 2,
        "KRW": 0,
        "JPY": 0,
        "VND": 0,
        "IDR": 0,
        "HUF": 0,
        "CLP": 0,
        "ISK": 0,
        "KWD": 3,
        "BHD": 3,
        "OMR": 3,
        "TND": 3,
    }
)

DEFAULT_MARGIN_BAND = Decimal("0.01")
MAX_MARGIN = Decimal("0.99")
PERCENT_QUANT = Decimal("0.0001")


def _canonicalise_currency(value: Optional[str]) -> Optional[str]:
    """Normalise a currency code to a canonical uppercase representation."""

    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.upper()


@dataclass(frozen=True)
class StreamTotals:
    """Aggregated totals for a revenue or expense collection."""

    total: Decimal
    list_total: Decimal
    currency: str
    breakdown: Tuple[Mapping[str, Any], ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class NegotiationEnvelope:
    """Outcome of the revenue/expense negotiation model."""

    currency: str
    expense: Decimal
    revenue: Decimal
    list_revenue: Decimal
    current_margin: Decimal
    target_margin: Decimal
    floor_margin: Decimal
    ceiling_margin: Decimal
    target_revenue: Decimal
    floor_revenue: Decimal
    ceiling_revenue: Decimal
    target_discount: Decimal
    floor_discount: Decimal
    ceiling_discount: Decimal
    metadata: Mapping[str, Any] = field(default_factory=dict)
    audit_trail: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self, numeric_type: Callable[[Decimal], Any] = float) -> Dict[str, Any]:
        """Serialise the envelope into basic Python data structures."""

        def convert(value: Any) -> Any:
            if isinstance(value, Decimal):
                return numeric_type(value)
            if isinstance(value, Mapping):
                return {key: convert(sub_value) for key, sub_value in value.items()}
            if isinstance(value, (list, tuple)):
                return [convert(sub_value) for sub_value in value]
            return value

        return {
            "currency": self.currency,
            "expense": convert(self.expense),
            "revenue": convert(self.revenue),
            "list_revenue": convert(self.list_revenue),
            "current_margin": convert(self.current_margin),
            "target_margin": convert(self.target_margin),
            "floor_margin": convert(self.floor_margin),
            "ceiling_margin": convert(self.ceiling_margin),
            "target_revenue": convert(self.target_revenue),
            "floor_revenue": convert(self.floor_revenue),
            "ceiling_revenue": convert(self.ceiling_revenue),
            "target_discount": convert(self.target_discount),
            "floor_discount": convert(self.floor_discount),
            "ceiling_discount": convert(self.ceiling_discount),
            "metadata": convert(dict(self.metadata)),
            "audit_trail": convert(dict(self.audit_trail)),
        }


def calculate_negotiation_envelope(
    revenue_streams: StreamLike,
    expense_streams: Optional[StreamLike],
    target_margin: MoneyLike,
    floor_margin: Optional[MoneyLike] = None,
    ceiling_margin: Optional[MoneyLike] = None,
    *,
    currency: Optional[str] = None,
    list_revenue: Optional[MoneyLike] = None,
    reserve_band: Optional[MoneyLike] = DEFAULT_MARGIN_BAND,
    metadata: Optional[Mapping[str, Any]] = None,
    numeric_type: Callable[[Decimal], Any] = float,
    return_dataclass: bool = False,
) -> Union[NegotiationEnvelope, Dict[str, Any]]:
    """Compute the negotiation envelope given revenue and expense inputs."""

    revenue_totals = _normalise_streams(
        revenue_streams,
        currency_hint=currency,
        list_hint=list_revenue,
        default_name_prefix="revenue",
    )

    expense_totals = (
        _normalise_streams(
            expense_streams,
            currency_hint=revenue_totals.currency,
            default_name_prefix="expense",
        )
        if expense_streams is not None
        else StreamTotals(
            total=Decimal("0"),
            list_total=Decimal("0"),
            currency=revenue_totals.currency,
            breakdown=tuple(),
        )
    )

    resolved_currency = revenue_totals.currency or expense_totals.currency or (currency or "USD")

    if revenue_totals.currency and expense_totals.currency:
        if revenue_totals.currency != expense_totals.currency:
            raise ValueError(
                "Revenue and expense streams must use the same currency; "
                f"got {revenue_totals.currency} and {expense_totals.currency}."
            )

    reserve_value = _coerce_ratio(reserve_band, "reserve_band", DEFAULT_MARGIN_BAND)
    target_margin_value = _coerce_margin(target_margin, "target_margin")

    if floor_margin is None:
        floor_margin_value = target_margin_value - reserve_value
    else:
        floor_margin_value = _coerce_margin(floor_margin, "floor_margin")

    if ceiling_margin is None:
        ceiling_margin_value = target_margin_value + reserve_value
    else:
        ceiling_margin_value = _coerce_margin(ceiling_margin, "ceiling_margin")

    floor_margin_value = max(Decimal("0"), floor_margin_value)
    ceiling_margin_value = min(MAX_MARGIN, ceiling_margin_value)

    if floor_margin_value > ceiling_margin_value:
        floor_margin_value, ceiling_margin_value = ceiling_margin_value, floor_margin_value

    if target_margin_value < floor_margin_value:
        target_margin_value = floor_margin_value
    if target_margin_value > ceiling_margin_value:
        target_margin_value = ceiling_margin_value

    current_margin_value = _compute_margin(
        revenue_totals.total,
        expense_totals.total,
    )

    target_revenue = _required_revenue(
        expense_totals.total,
        target_margin_value,
        resolved_currency,
    )
    floor_revenue = _required_revenue(
        expense_totals.total,
        floor_margin_value,
        resolved_currency,
    )
    ceiling_revenue = _required_revenue(
        expense_totals.total,
        ceiling_margin_value,
        resolved_currency,
    )

    list_total = revenue_totals.list_total if revenue_totals.list_total > 0 else revenue_totals.total

    target_discount = _compute_discount(list_total, target_revenue)
    floor_discount = _compute_discount(list_total, floor_revenue)
    ceiling_discount = _compute_discount(list_total, ceiling_revenue)

    metadata_proxy = MappingProxyType(dict(metadata or {}))
    audit_trail = _build_audit_trail(
        resolved_currency,
        revenue_totals,
        expense_totals,
        current_margin_value,
        target_margin_value,
        floor_margin_value,
        ceiling_margin_value,
        reserve_value,
        target_revenue,
        floor_revenue,
        ceiling_revenue,
        target_discount,
        floor_discount,
        ceiling_discount,
    )

    envelope = NegotiationEnvelope(
        currency=resolved_currency,
        expense=_quantize_currency(expense_totals.total, resolved_currency),
        revenue=_quantize_currency(revenue_totals.total, resolved_currency),
        list_revenue=_quantize_currency(list_total, resolved_currency),
        current_margin=_quantize_percentage(current_margin_value),
        target_margin=_quantize_percentage(target_margin_value),
        floor_margin=_quantize_percentage(floor_margin_value),
        ceiling_margin=_quantize_percentage(ceiling_margin_value),
        target_revenue=_quantize_currency(target_revenue, resolved_currency),
        floor_revenue=_quantize_currency(floor_revenue, resolved_currency),
        ceiling_revenue=_quantize_currency(ceiling_revenue, resolved_currency),
        target_discount=_quantize_percentage(target_discount),
        floor_discount=_quantize_percentage(floor_discount),
        ceiling_discount=_quantize_percentage(ceiling_discount),
        metadata=metadata_proxy,
        audit_trail=audit_trail,
    )

    if return_dataclass:
        return envelope
    return envelope.to_dict(numeric_type=numeric_type)


def determine_margin_envelope(
    revenue_streams: StreamLike,
    expense_streams: Optional[StreamLike],
    target_margin: MoneyLike,
    floor_margin: Optional[MoneyLike] = None,
    ceiling_margin: Optional[MoneyLike] = None,
    *,
    currency: Optional[str] = None,
    list_revenue: Optional[MoneyLike] = None,
    reserve_band: Optional[MoneyLike] = DEFAULT_MARGIN_BAND,
) -> Mapping[str, Decimal]:
    """Return only the margin boundaries for callers that do not need the full envelope."""

    envelope = calculate_negotiation_envelope(
        revenue_streams,
        expense_streams,
        target_margin,
        floor_margin,
        ceiling_margin,
        currency=currency,
        list_revenue=list_revenue,
        reserve_band=reserve_band,
        return_dataclass=True,
    )

    return MappingProxyType(
        {
            "floor_margin": envelope.floor_margin,
            "target_margin": envelope.target_margin,
            "ceiling_margin": envelope.ceiling_margin,
        }
    )


def _normalise_streams(
    streams: Optional[StreamLike],
    *,
    currency_hint: Optional[str],
    list_hint: Optional[MoneyLike] = None,
    default_name_prefix: str,
) -> StreamTotals:
    if streams is None:
        raise ValueError("At least one stream must be provided.")

    iterable = _ensure_iterable(streams)
    if not iterable:
        raise ValueError("Stream collection cannot be empty.")

    total = Decimal("0")
    list_total = Decimal("0")
    breakdown: List[Mapping[str, Any]] = []
    canonical_currency_hint = _canonicalise_currency(currency_hint)
    resolved_currency = canonical_currency_hint

    for index, item in enumerate(iterable):
        name, amount, list_amount, item_currency = _normalise_stream_item(
            item,
            resolved_currency,
            default_name=f"{default_name_prefix}_{index + 1}",
        )
        if resolved_currency is None:
            resolved_currency = item_currency
        elif item_currency is not None and resolved_currency != item_currency:
            raise ValueError(
                f"Mixed currencies detected: {resolved_currency} and {item_currency}."
            )

        total += amount
        list_total += list_amount
        breakdown.append(
            {
                "name": name,
                "amount": amount,
                "list_amount": list_amount,
            }
        )

    if resolved_currency is None:
        resolved_currency = canonical_currency_hint or "USD"

    if list_hint is not None:
        list_total = _to_decimal_money(list_hint, resolved_currency)

    if list_total == Decimal("0"):
        list_total = total

    return StreamTotals(
        total=total,
        list_total=list_total,
        currency=resolved_currency,
        breakdown=tuple(
            MappingProxyType(
                {
                    "name": entry["name"],
                    "amount": entry["amount"],
                    "list_amount": entry["list_amount"],
                }
            )
            for entry in breakdown
        ),
    )


def _normalise_stream_item(
    item: Any,
    currency_hint: Optional[str],
    *,
    default_name: str,
) -> Tuple[str, Decimal, Decimal, str]:
    canonical_hint = _canonicalise_currency(currency_hint)

    if isinstance(item, StreamTotals):
        item_currency = (
            _canonicalise_currency(item.currency)
            or canonical_hint
            or "USD"
        )
        return (
            default_name,
            Decimal(item.total),
            Decimal(item.list_total),
            item_currency,
        )

    if hasattr(item, "__dict__") and not isinstance(item, Mapping):
        return _normalise_stream_item(
            {key: value for key, value in vars(item).items() if not key.startswith("_")},
            canonical_hint,
            default_name=default_name,
        )

    if isinstance(item, Mapping):
        mapping_item = dict(item)
        name = str(
            mapping_item.get("name")
            or mapping_item.get("id")
            or mapping_item.get("category")
            or mapping_item.get("product")
            or default_name
        )
        currency_value = mapping_item.get("currency")
        currency = (
            _canonicalise_currency(currency_value)
            or canonical_hint
            or "USD"
        )
        volume = _to_decimal_number(
            mapping_item.get("volume")
            or mapping_item.get("units")
            or mapping_item.get("quantity"),
            default=1,
        )
        amount = mapping_item.get("total")
        if amount is None:
            amount = (
                mapping_item.get("amount")
                or mapping_item.get("value")
                or mapping_item.get("revenue")
                or mapping_item.get("price_total")
            )
        if amount is None:
            unit_price = (
                mapping_item.get("unit_price")
                or mapping_item.get("price")
                or mapping_item.get("rate")
                or mapping_item.get("unit_cost")
                or mapping_item.get("cost")
            )
            if unit_price is None:
                raise ValueError(
                    f"Stream item '{name}' is missing a unit or total amount."
                )
            amount_decimal = _to_decimal_money(unit_price, currency) * volume
        else:
            amount_decimal = _to_decimal_money(amount, currency)

        list_amount_value = (
            mapping_item.get("list_total")
            or mapping_item.get("rack_total")
            or mapping_item.get("list_amount")
        )
        if list_amount_value is None:
            list_unit_price = (
                mapping_item.get("list_unit_price")
                or mapping_item.get("rack_rate")
                or mapping_item.get("list_price")
            )
            if list_unit_price is None:
                list_amount_decimal = amount_decimal
            else:
                list_amount_decimal = _to_decimal_money(list_unit_price, currency) * volume
        else:
            list_amount_decimal = _to_decimal_money(list_amount_value, currency)

        return name, amount_decimal, list_amount_decimal, currency

    if isinstance(item, (list, tuple)):
        seq = list(item)
        if not seq:
            raise ValueError("Empty stream entry is not allowed.")
        sequence_currency = canonical_hint or "USD"
        if len(seq) == 3:
            maybe_name, maybe_price, maybe_volume = seq
            if isinstance(maybe_name, str):
                name = maybe_name
                price = maybe_price
                volume = maybe_volume
            else:
                name = default_name
                price = maybe_name
                volume = maybe_price
        elif len(seq) == 2:
            first, second = seq
            if isinstance(first, str):
                name = first
                price = second
                volume = 1
                amount_decimal = _to_decimal_money(price, sequence_currency)
                return name, amount_decimal, amount_decimal, sequence_currency
            else:
                name = default_name
                price = first
                volume = second
        elif len(seq) == 1:
            name = default_name
            price = seq[0]
            volume = 1
        else:
            raise ValueError(
                "Sequence stream entries must contain between one and three values."
            )
        price_decimal = _to_decimal_money(price, sequence_currency)
        volume_decimal = _to_decimal_number(volume, default=1)
        amount_decimal = price_decimal * volume_decimal
        return name, amount_decimal, amount_decimal, sequence_currency

    try:
        amount_decimal = _to_decimal_money(item, canonical_hint or "USD")
    except (TypeError, ValueError):
        raise TypeError(
            "Unsupported stream item type; expected mapping, sequence, or numeric value."
        ) from None

    final_currency = canonical_hint or "USD"
    return default_name, amount_decimal, amount_decimal, final_currency


def _ensure_iterable(value: StreamLike) -> List[Any]:
    if isinstance(value, Mapping):
        return [value]
    if isinstance(value, (str, bytes)):
        return [value]
    try:
        return list(value)  # type: ignore[arg-type]
    except TypeError:
        return [value]


def _to_decimal_money(value: MoneyLike, currency: str) -> Decimal:
    if currency is None:
        currency = "USD"
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, (int, float)):
        result = Decimal(str(value))
    elif isinstance(value, str):
        cleaned = value.strip()

        def strip_currency_indicators(text: str) -> str:
            upper_currency = currency.upper()
            if upper_currency:
                while True:
                    trimmed = text.lstrip()
                    if trimmed.upper().startswith(upper_currency):
                        text = trimmed[len(upper_currency) :]
                        continue
                    break
                while True:
                    trimmed = text.rstrip()
                    if trimmed.upper().endswith(upper_currency):
                        text = trimmed[: -len(upper_currency)]
                        continue
                    break
                pattern = re.compile(
                    rf"(?<![A-Za-z]){re.escape(upper_currency)}(?![A-Za-z])",
                    flags=re.IGNORECASE,
                )
                text = pattern.sub(" ", text)
            for token in _MULTI_CHAR_CURRENCY_SYMBOLS:
                text = re.sub(re.escape(token), " ", text, flags=re.IGNORECASE)
            if _CURRENCY_SYMBOLS:
                text = text.translate(_CURRENCY_SYMBOL_TRANSLATION)
            return text

        cleaned = strip_currency_indicators(cleaned)
        cleaned = cleaned.replace(",", "")
        cleaned = cleaned.strip()

        negative = False

        def strip_parentheses(text: str, allow_flip: bool) -> str:
            nonlocal negative
            while len(text) >= 2 and text[0] == "(" and text[-1] == ")":
                inner = text[1:-1].strip()
                if not inner:
                    break
                if inner[0] in "+-":
                    text = inner
                    continue
                if allow_flip:
                    negative = True
                text = inner
            return text

        cleaned = strip_parentheses(cleaned, allow_flip=True)

        while cleaned and cleaned[0] in "+-":
            if cleaned[0] == "-":
                negative = not negative
            cleaned = cleaned[1:].strip()
            cleaned = strip_parentheses(cleaned, allow_flip=False)

        while cleaned and cleaned[-1] in "+-":
            if cleaned[-1] == "-":
                negative = not negative
            cleaned = cleaned[:-1].strip()
            cleaned = strip_parentheses(cleaned, allow_flip=False)

        cleaned = cleaned.strip()
        cleaned = strip_parentheses(cleaned, allow_flip=not negative)
        cleaned = cleaned.replace(" ", "")

        if cleaned.startswith("-"):
            if negative:
                cleaned = cleaned[1:]
            else:
                negative = True
                cleaned = cleaned[1:]
        elif cleaned.startswith("+"):
            cleaned = cleaned[1:]

        cleaned = cleaned.strip()

        if not cleaned:
            raise ValueError("Unable to parse monetary string into Decimal.")

        if negative:
            cleaned = "-" + cleaned

        result = Decimal(cleaned)
    else:
        raise TypeError(f"Unsupported monetary type: {type(value)!r}")
    return result


def _to_decimal_number(value: Any, *, default: Union[int, float, Decimal]) -> Decimal:
    if value is None:
        return Decimal(str(default))
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        stripped = value.strip().replace(",", "")
        return Decimal(stripped)
    raise TypeError(f"Unable to coerce value {value!r} into a numeric quantity.")


def _coerce_margin(value: MoneyLike, name: str) -> Decimal:
    if value is None:
        raise ValueError(f"{name} must be provided.")
    if isinstance(value, Decimal):
        margin = value
    elif isinstance(value, (int, float)):
        margin = Decimal(str(value))
        if margin >= 1:
            margin = margin / Decimal("100")
    elif isinstance(value, str):
        stripped = value.strip().replace(",", "")
        if stripped.endswith("%"):
            margin = Decimal(stripped[:-1]) / Decimal("100")
        elif stripped.lower().endswith("bp"):
            margin = Decimal(stripped[:-2]) / Decimal("10000")
        else:
            margin = Decimal(stripped)
            if margin >= 1:
                margin = margin / Decimal("100")
    else:
        raise TypeError(f"Unsupported margin type for {name}: {type(value)!r}")

    if margin < Decimal("0"):
        raise ValueError(f"{name} must be a positive ratio.")
    if margin >= Decimal("1"):
        raise ValueError(f"{name} must be less than 1 (100%).")
    return margin


def _coerce_ratio(
    value: Optional[MoneyLike],
    name: str,
    default: Decimal,
) -> Decimal:
    if value is None:
        return default
    if isinstance(value, Decimal):
        ratio = value
    elif isinstance(value, (int, float)):
        ratio = Decimal(str(value))
        if ratio > 1:
            ratio = ratio / Decimal("100")
    elif isinstance(value, str):
        stripped = value.strip().replace(",", "")
        if stripped.endswith("%"):
            ratio = Decimal(stripped[:-1]) / Decimal("100")
        elif stripped.lower().endswith("bp"):
            ratio = Decimal(stripped[:-2]) / Decimal("10000")
        else:
            ratio = Decimal(stripped)
            if ratio > 1:
                ratio = ratio / Decimal("100")
    else:
        raise TypeError(f"Unsupported ratio type for {name}: {type(value)!r}")

    if ratio < Decimal("0"):
        raise ValueError(f"{name} must not be negative.")
    if ratio >= Decimal("1"):
        raise ValueError(f"{name} must be less than 1 (100%).")
    return ratio


def _compute_margin(revenue: Decimal, expense: Decimal) -> Decimal:
    if revenue <= Decimal("0"):
        return Decimal("0")
    margin = (revenue - expense) / revenue
    return margin


def _required_revenue(expense: Decimal, margin: Decimal, currency: str) -> Decimal:
    if margin >= Decimal("1"):
        raise ValueError("Margin must be strictly less than 1 (100%).")
    denominator = Decimal("1") - margin
    if denominator <= Decimal("0"):
        raise ValueError("Margin leads to non-positive denominator.")
    if expense <= Decimal("0"):
        return Decimal("0")
    revenue = expense / denominator
    return revenue


def _compute_discount(list_revenue: Decimal, required_revenue: Decimal) -> Decimal:
    if list_revenue == Decimal("0"):
        return Decimal("0")
    discount = Decimal("1") - (required_revenue / list_revenue)
    return discount


def _currency_quant(currency: str, *, extra_decimals: int = 0) -> Decimal:
    minor_units = CURRENCY_MINOR_UNITS.get(currency.upper(), 2)
    power = -(minor_units + extra_decimals)
    return Decimal("1").scaleb(power)


def _quantize_currency(value: Decimal, currency: str) -> Decimal:
    return value.quantize(_currency_quant(currency), rounding=ROUND_HALF_EVEN)


def _quantize_percentage(value: Decimal) -> Decimal:
    return value.quantize(PERCENT_QUANT, rounding=ROUND_HALF_EVEN)


def _build_audit_trail(
    currency: str,
    revenue_totals: StreamTotals,
    expense_totals: StreamTotals,
    current_margin: Decimal,
    target_margin: Decimal,
    floor_margin: Decimal,
    ceiling_margin: Decimal,
    reserve_band: Decimal,
    target_revenue: Decimal,
    floor_revenue: Decimal,
    ceiling_revenue: Decimal,
    target_discount: Decimal,
    floor_discount: Decimal,
    ceiling_discount: Decimal,
) -> Mapping[str, Any]:
    def serialise_breakdown(entries: Tuple[Mapping[str, Any], ...]) -> List[Mapping[str, Any]]:
        serialised: List[Mapping[str, Any]] = []
        for entry in entries:
            serialised.append(
                {
                    "name": entry["name"],
                    "amount": str(entry["amount"]),
                    "list_amount": str(entry["list_amount"]),
                }
            )
        return serialised

    audit: Dict[str, Any] = {
        "currency": currency,
        "inputs": {
            "revenue_total": str(revenue_totals.total),
            "expense_total": str(expense_totals.total),
            "list_revenue_total": str(revenue_totals.list_total),
            "reserve_band": str(reserve_band),
        },
        "margins": {
            "current": str(current_margin),
            "target": str(target_margin),
            "floor": str(floor_margin),
            "ceiling": str(ceiling_margin),
        },
        "revenues": {
            "target": str(target_revenue),
            "floor": str(floor_revenue),
            "ceiling": str(ceiling_revenue),
            "list_total": str(revenue_totals.list_total),
        },
        "discounts": {
            "target": str(target_discount),
            "floor": str(floor_discount),
            "ceiling": str(ceiling_discount),
        },
        "breakdown": {
            "revenue": serialise_breakdown(revenue_totals.breakdown),
            "expense": serialise_breakdown(expense_totals.breakdown),
        },
    }

    return MappingProxyType(audit)
