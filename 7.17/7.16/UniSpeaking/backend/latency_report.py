from __future__ import annotations

import json
import math
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TURN_TARGETS = {
    "start_to_first_transcript_ms": 500,
    "end_to_first_audio_ms": 1200,
    "interruption_stop_ms": 300,
    "end_to_first_text_ms": 800,
}


def _text(value: Any, limit: int = 120) -> str:
    return (
        str(value or "")
        .replace("|", "\\|")
        .replace("\r", " ")
        .replace("\n", " ")
        .strip()[:limit]
    )


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def _duration(value: Any) -> str:
    number = _number(value)
    return "—" if number is None else str(round(number))


def _target(value: Any, target: float) -> str:
    number = _number(value)
    if number is None:
        return "—"
    return f"{round(number)} {'✅' if number <= target else '❌'}"


class MarkdownLatencyReport:
    def __init__(self, path: Path):
        self.path = path
        self.data_path = path.with_suffix(".json")
        self._lock = threading.RLock()
        self._data = self._load()
        self._render()

    def _load(self) -> dict[str, list[dict[str, Any]]]:
        if not self.data_path.exists():
            return {"turns": [], "sessions": []}
        try:
            data = json.loads(self.data_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"turns": [], "sessions": []}
        return {
            "turns": list(data.get("turns", []))[-2000:],
            "sessions": list(data.get("sessions", []))[-500:],
        }

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.data_path.with_suffix(".json.tmp")
        temp.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(temp, self.data_path)

    def _render(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Realtime Conversation Performance Report",
            "",
            "Durations are measured in the browser with `performance.now()`.",
            "",
            "## Acceptance targets",
            "",
            "| Metric | Target |",
            "|---|---:|",
            "| User speech start → first transcript text | ≤ 500 ms |",
            "| User speech end → first audible AI audio | ≤ 1200 ms |",
            "| User interruption → AI audio becomes silent | ≤ 300 ms |",
            "| User speech end → first AI text | ≤ 800 ms |",
            "| Continuous conversation on a normal network | 3–10 min without obvious stutter |",
            "",
            "## Per-turn measurements",
            "",
            "| Time | Conversation | Turn | Level | Start→transcript | End→audio | Interrupt→silent | End→text | Total turn | Learner | AI |",
            "|---|---|---:|---|---:|---:|---:|---:|---:|---|---|",
        ]
        for item in self._data["turns"]:
            lines.append(
                "| "
                + " | ".join(
                    [
                        _text(item.get("recorded_at"), 32),
                        _text(item.get("conversation_id"), 20),
                        _text(item.get("turn_index"), 8),
                        _text(item.get("learner_level_label"), 18),
                        _target(item.get("start_to_first_transcript_ms"), 500),
                        _target(item.get("end_to_first_audio_ms"), 1200),
                        _target(item.get("interruption_stop_ms"), 300),
                        _target(item.get("end_to_first_text_ms"), 800),
                        _duration(item.get("total_turn_ms")),
                        _text(item.get("user_text")),
                        _text(item.get("assistant_text")),
                    ]
                )
                + " |"
            )

        lines.extend(
            [
                "",
                "## Session continuity",
                "",
                "The continuity result is considered passing when duration is 3–10 minutes, there are no connection disruptions, packet loss is at most 3%, maximum jitter is at most 100 ms, and average RTT is at most 500 ms.",
                "",
                "| Time | Conversation | Duration min | Packets lost | Loss % | Max jitter ms | Avg RTT ms | Disruptions | Result |",
                "|---|---|---:|---:|---:|---:|---:|---:|---|",
            ]
        )
        for item in self._data["sessions"]:
            duration = _number(item.get("duration_minutes"))
            loss = _number(item.get("packet_loss_percent"))
            jitter = _number(item.get("max_jitter_ms"))
            rtt = _number(item.get("avg_rtt_ms"))
            disruptions = int(item.get("connection_disruptions") or 0)
            enough_duration = duration is not None and 3 <= duration <= 10
            pass_quality = (
                enough_duration
                and disruptions == 0
                and loss is not None
                and loss <= 3
                and jitter is not None
                and jitter <= 100
                and rtt is not None
                and rtt <= 500
            )
            result = (
                "✅ Pass"
                if pass_quality
                else ("⏳ Need 3–10 min" if not enough_duration else "❌ Review")
            )
            lines.append(
                "| "
                + " | ".join(
                    [
                        _text(item.get("recorded_at"), 32),
                        _text(item.get("conversation_id"), 20),
                        "—" if duration is None else f"{duration:.2f}",
                        _duration(item.get("packets_lost")),
                        "—" if loss is None else f"{loss:.2f}",
                        _duration(jitter),
                        _duration(rtt),
                        str(disruptions),
                        result,
                    ]
                )
                + " |"
            )
        self.path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    def append(
        self,
        *,
        conversation_id: str,
        session_id: str,
        learner_level_label: str,
        metric: dict[str, Any],
    ) -> None:
        item = dict(metric)
        item.update(
            {
                "conversation_id": conversation_id,
                "session_id": session_id,
                "learner_level_label": learner_level_label,
                "recorded_at": metric.get("recorded_at")
                or datetime.now(timezone.utc).isoformat(),
            }
        )
        with self._lock:
            self._data["turns"].append(item)
            self._data["turns"] = self._data["turns"][-2000:]
            self._save()
            self._render()

    def append_session(
        self, *, conversation_id: str, session_id: str, metric: dict[str, Any]
    ) -> None:
        item = dict(metric)
        item.update(
            {
                "conversation_id": conversation_id,
                "session_id": session_id,
                "recorded_at": metric.get("recorded_at")
                or datetime.now(timezone.utc).isoformat(),
            }
        )
        with self._lock:
            self._data["sessions"].append(item)
            self._data["sessions"] = self._data["sessions"][-500:]
            self._save()
            self._render()

    def read(self) -> str:
        with self._lock:
            self._render()
            return self.path.read_text(encoding="utf-8")
