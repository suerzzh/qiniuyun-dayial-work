#!/usr/bin/env python3
"""Build the browser IELTS bank from the approved 2026 extraction JSON files.

The builder performs schema conversion and validation only. It preserves source
question text, order, warnings and review flags; it never corrects or rewrites a
question. Part 2 and Part 3 remain nested in one atomic source-topic bundle.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_P1 = PROJECT / "data" / "2026年1-4月P1口语分类2.2.json"
DEFAULT_P23 = PROJECT / "data" / "2026年1-4月P2&P3口语分类2.27.json"
DEFAULT_OUTPUT = PROJECT.parents[1] / "7.14" / "UniSpeaking_Complete_UI" / "backend" / "ielts" / "question_bank"


def require_topics(source: dict[str, Any], label: str) -> list[dict[str, Any]]:
    topics = source.get("topics") if isinstance(source, dict) else None
    if not isinstance(topics, list) or not topics:
        raise ValueError(f"{label} source must contain a non-empty topics array")
    return topics


def unique_topic_ids(topics: list[dict[str, Any]], label: str) -> None:
    seen: set[str] = set()
    for topic in topics:
        topic_id = str(topic.get("id") or "").strip()
        if not topic_id:
            raise ValueError(f"{label} topic id is required")
        if topic_id in seen:
            raise ValueError(f"Duplicate {label} topic id: {topic_id}")
        seen.add(topic_id)


def source_fields(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_page_start": value.get("source_page_start"),
        "source_page_end": value.get("source_page_end"),
        "warnings": list(value.get("warnings") or []),
        "needs_review": bool(value.get("needs_review")),
    }


def ordered(values: list[dict[str, Any]], label: str) -> list[dict[str, Any]]:
    result = sorted(values, key=lambda item: int(item.get("order") or 0))
    orders = [int(item.get("order") or 0) for item in result]
    if not orders or any(order < 1 for order in orders) or len(set(orders)) != len(orders):
        raise ValueError(f"{label} must have unique positive order values")
    return result


def convert_part1(source: dict[str, Any]) -> dict[str, Any]:
    topics = require_topics(source, "Part 1")
    unique_topic_ids(topics, "Part 1")
    seen_questions: set[str] = set()
    groups: list[dict[str, Any]] = []
    for topic in sorted(topics, key=lambda item: int(item.get("sequence") or 0)):
        questions: list[dict[str, Any]] = []
        for question in ordered(list(topic.get("questions") or []), f"Part 1 {topic['id']} questions"):
            question_id = str(question.get("id") or "").strip()
            text = str(question.get("text") or "").strip()
            if not question_id or not text:
                raise ValueError(f"Part 1 {topic['id']} contains an incomplete question")
            if question_id in seen_questions:
                raise ValueError(f"Duplicate Part 1 question id: {question_id}")
            seen_questions.add(question_id)
            review = bool(question.get("needs_review"))
            questions.append({
                "question_id": question_id,
                "version": int(topic.get("version") or 1),
                "order": int(question["order"]),
                "text": text,
                "raw_text": str(question.get("raw_text") or text),
                "eligible": not review,
                **source_fields(question),
            })
        eligible = sum(1 for question in questions if question["eligible"]) >= 4
        groups.append({
            "group_id": str(topic["id"]),
            "version": int(topic.get("version") or 1),
            "status": "active" if eligible else "review",
            "eligible": eligible,
            "topic": str(topic.get("topic") or topic.get("raw_topic_heading") or topic["id"]),
            "sequence": int(topic.get("sequence") or 0),
            "category": topic.get("category"),
            "freshness": topic.get("freshness"),
            "training_level": "standard",
            "source_status": topic.get("status"),
            "questions": questions,
            **source_fields(topic),
        })
    return {
        "source": source.get("source"),
        "season": source.get("season"),
        "groups": groups,
    }


def convert_part2_part3(source: dict[str, Any]) -> dict[str, Any]:
    topics = require_topics(source, "Part 2/3")
    unique_topic_ids(topics, "Part 2/3")
    seen_questions: set[str] = set()
    bundles: list[dict[str, Any]] = []
    for topic in sorted(topics, key=lambda item: int(item.get("sequence") or 0)):
        topic_id = str(topic["id"])
        part2 = topic.get("part2") if isinstance(topic.get("part2"), dict) else {}
        prompt = part2.get("prompt") if isinstance(part2.get("prompt"), dict) else {}
        topic_sentence = str(prompt.get("text") or "").strip()
        cue_points = []
        for cue in ordered(list(part2.get("cue_points") or []), f"Part 2 {topic_id} cue points"):
            cue_id = str(cue.get("id") or "").strip()
            cue_text = str(cue.get("text") or "").strip()
            if not cue_id or not cue_text:
                raise ValueError(f"Part 2 {topic_id} contains an incomplete cue point")
            cue_points.append({
                "cue_id": cue_id,
                "order": int(cue["order"]),
                "text": cue_text,
                "raw_text": str(cue.get("raw_text") or cue_text),
                **source_fields(cue),
            })

        part3_source = topic.get("part3") if isinstance(topic.get("part3"), dict) else {}
        part3_questions = []
        for question in ordered(list(part3_source.get("questions") or []), f"Part 3 {topic_id} questions"):
            question_id = str(question.get("id") or "").strip()
            text = str(question.get("text") or "").strip()
            if not question_id or not text:
                raise ValueError(f"Part 3 {topic_id} contains an incomplete question")
            if not question_id.startswith(f"{topic_id}_p3_"):
                raise ValueError(f"Part 3 question {question_id} does not belong to source topic {topic_id}")
            if question_id in seen_questions:
                raise ValueError(f"Duplicate Part 3 question id: {question_id}")
            seen_questions.add(question_id)
            part3_questions.append({
                "question_id": question_id,
                "version": int(topic.get("version") or 1),
                "order": int(question["order"]),
                "text": text,
                "raw_text": str(question.get("raw_text") or text),
                **source_fields(question),
            })

        review = bool(topic.get("needs_review"))
        complete = bool(topic_sentence) and len(cue_points) >= 3 and bool(part3_questions)
        eligible = complete and not review
        bundles.append({
            "topic_id": topic_id,
            "version": int(topic.get("version") or 1),
            "status": "active" if eligible else "review",
            "eligible": eligible,
            "title": str(topic.get("title") or topic.get("raw_topic_heading") or topic_id),
            "sequence": int(topic.get("sequence") or 0),
            "category": topic.get("category"),
            "freshness": topic.get("freshness"),
            "source_topic_number": topic.get("source_topic_number"),
            "source_status": topic.get("status"),
            "part2": {
                "card_id": topic_id,
                "topic_sentence": topic_sentence,
                "raw_topic_sentence": str(prompt.get("raw_text") or topic_sentence),
                "cue_points": cue_points,
                "source_page_start": part2.get("source_page_start"),
                "source_page_end": part2.get("source_page_end"),
                "warnings": list(part2.get("warnings") or []),
                "needs_review": bool(part2.get("needs_review")),
            },
            "part3": {
                "questions": part3_questions,
                "source_page_start": part3_source.get("source_page_start"),
                "source_page_end": part3_source.get("source_page_end"),
                "warnings": list(part3_source.get("warnings") or []),
                "needs_review": bool(part3_source.get("needs_review")),
            },
            **source_fields(topic),
        })
    return {
        "source": source.get("source"),
        "season": source.get("season"),
        "bundles": bundles,
    }


def manifest() -> dict[str, Any]:
    return {
        "bank_version": "2026.01-04.2026-built.1",
        "schema_version": 2,
        "locale": "en-GB",
        "files": {"part1": "part1.json", "part2_part3": "part2_part3.json"},
        "defaults": {
            "recent_completed_sessions_to_avoid": 5,
            "real_exam": {
                "introduction_max_seconds": 60,
                "part1_answer_max_seconds": 60,
                "part2_prep_seconds": 60,
                "part2_answer_max_seconds": 120,
                "part3_answer_max_seconds": 60,
                "part3_soft_limit_seconds": 240,
                "part3_hard_limit_seconds": 300,
            },
            "accelerated_demo": {
                "introduction_max_seconds": 15,
                "part1_answer_max_seconds": 20,
                "part2_prep_seconds": 10,
                "part2_answer_max_seconds": 45,
                "part3_answer_max_seconds": 20,
                "part3_soft_limit_seconds": 60,
                "part3_hard_limit_seconds": 75,
            },
        },
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(p1_source: Path, p23_source: Path, output_dir: Path) -> dict[str, int]:
    part1 = convert_part1(json.loads(p1_source.read_text(encoding="utf-8")))
    part23 = convert_part2_part3(json.loads(p23_source.read_text(encoding="utf-8")))
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json(output_dir / "manifest.json", manifest())
    write_json(output_dir / "part1.json", part1)
    write_json(output_dir / "part2_part3.json", part23)
    return {
        "part1_topic_count": len(part1["groups"]),
        "part1_eligible_topic_count": sum(1 for group in part1["groups"] if group["eligible"]),
        "part2_part3_bundle_count": len(part23["bundles"]),
        "part2_part3_eligible_bundle_count": sum(1 for bundle in part23["bundles"] if bundle["eligible"]),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--p1-source", type=Path, default=DEFAULT_P1)
    parser.add_argument("--p23-source", type=Path, default=DEFAULT_P23)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = build(args.p1_source, args.p23_source, args.output_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
