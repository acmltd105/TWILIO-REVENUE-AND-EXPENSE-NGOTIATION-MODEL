"""Twilio integration with an in-memory queue fallback."""
from __future__ import annotations

import logging
import queue
import threading
from dataclasses import dataclass
from typing import Optional

from .config import Settings

logger = logging.getLogger(__name__)


@dataclass
class NotificationResult:
    delivered: bool
    sid: Optional[str]
    message: str


class TwilioGateway:
    """Safely interact with Twilio REST API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._queue: "queue.Queue[str]" = queue.Queue()
        self._lock = threading.Lock()
        self._client = None
        self._connect()

    def _connect(self) -> None:
        if not (self._settings.twilio_account_sid and self._settings.twilio_auth_token and self._settings.twilio_from_number):
            logger.warning("Twilio credentials incomplete; queuing notifications until configured.")
            return
        try:
            from twilio.rest import Client  # type: ignore

            self._client = Client(self._settings.twilio_account_sid, self._settings.twilio_auth_token)
            logger.info("Twilio client initialised.")
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to initialise Twilio client: %s", exc)
            self._client = None

    def send_notification(self, body: str, *, to: Optional[str] = None) -> NotificationResult:
        recipient = to or self._settings.notification_recipient
        if not recipient:
            logger.info("Notification recipient unavailable; queuing message only.")
            self._queue.put(body)
            return NotificationResult(delivered=False, sid=None, message="Recipient missing; queued locally.")

        if self._client is None:
            logger.info("Twilio client unavailable; queueing message for later delivery.")
            self._queue.put(body)
            return NotificationResult(delivered=False, sid=None, message="Twilio offline; message queued.")

        try:
            message = self._client.messages.create(
                body=body,
                from_=self._settings.twilio_from_number,
                to=recipient,
            )
            logger.info("Notification sent via Twilio: sid=%s", getattr(message, "sid", "unknown"))
            return NotificationResult(delivered=True, sid=getattr(message, "sid", None), message="Delivered via Twilio.")
        except Exception as exc:  # pragma: no cover
            logger.error("Twilio send failed: %s", exc)
            self._queue.put(body)
            return NotificationResult(delivered=False, sid=None, message=f"Twilio error: {exc}")

    def queued_notifications(self) -> int:
        return self._queue.qsize()


__all__ = ["TwilioGateway", "NotificationResult"]
