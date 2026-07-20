#!/usr/bin/env python3
"""
Batch-extract IELTS Part 1 topic/question PDFs into reviewable JSON.

Designed for PDFs whose layout resembles:
- category headings: large Chinese text (e.g. 必考题 / 人物类 / 事物类)
- freshness headings: 新题 / 老题
- topic headings: bold English text (e.g. 1.Hometown)
- questions: numbered regular text

The extractor preserves raw text and only performs mechanical normalization.
It does NOT silently rewrite grammar or meaning.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

try:
    import fitz  # PyMuPDF
except ImportError as exc:
    raise SystemExit(
        "PyMuPDF is required. Install it with: python -m pip install pymupdf"
    ) from exc


HEADER_MARKERS = ("雅思口语题库", "IELTS Speaking")
FRESHNESS_VALUES = {"新题": "new", "老题": "old"}
QUESTION_RE = re.compile(r"^\s*(\d{1,3})\s*[.．、)]\s*(.+?)\s*$")
TOPIC_NUMBER_RE = re.compile(r"^\s*(\d{1,3})\s*[.．、)]?\s*(.+?)\s*$")
CHINESE_CATEGORY_PREFIX_RE = re.compile(r"^[一二三四五六七八九十]+[、.．]\s*")
CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")
MULTISPACE_RE = re.compile(r"[ \t]+")
SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.;:?!])")
MISSING_SPACE_AFTER_PUNCT_RE = re.compile(r"([,;:?!])(?=[A-Za-z])")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value or "untitled"


def mechanical_normalize(value: str) -> str:
    """Normalize spacing/punctuation without correcting grammar or content."""
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("？", "?").replace("，", ",").replace("；", ";")
    value = value.replace("：", ":").replace("。", ".")
    value = value.replace("’", "'").replace("‘", "'")
    value = value.replace("“", '"').replace("”", '"')
    value = MULTISPACE_RE.sub(" ", value).strip()
    value = SPACE_BEFORE_PUNCT_RE.sub(r"\1", value)
    value = MISSING_SPACE_AFTER_PUNCT_RE.sub(r"\1 ", value)
    return value


def clean_category(value: str) -> str:
    return CHINESE_CATEGORY_PREFIX_RE.sub("", value).strip()


def extract_lines(page: fitz.Page) -> list[dict[str, Any]]:
    data = page.get_text("dict", sort=True)
    result: list[dict[str, Any]] = []
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text:
                continue
            bbox = tuple(line.get("bbox", (0, 0, 0, 0)))
            result.append(
                {
                    "text": text,
                    "size": max(float(span.get("size", 0)) for span in spans),
                    "bold": any(
                        "bold" in str(span.get("font", "")).lower()
                        or (int(span.get("flags", 0)) & 16)
                        for span in spans
                    ),
                    "x0": float(bbox[0]),
                    "y0": float(bbox[1]),
                    "y1": float(bbox[3]),
                }
            )
    result.sort(key=lambda item: (round(item["y0"], 1), item["x0"]))
    return result


def is_header_or_footer(line: dict[str, Any], page_height: float) -> bool:
    text = line["text"].strip()
    if any(marker in text for marker in HEADER_MARKERS):
        return True
    if line["y0"] > page_height - 55 and re.fullmatch(r"\d{1,3}", text):
        return True
    return False


def classify_large_heading(text: str) -> tuple[str, str] | None:
    stripped = text.strip()
    if stripped in FRESHNESS_VALUES:
        return ("freshness", FRESHNESS_VALUES[stripped])
    category = clean_category(stripped)
    if (
        "必考题" in category
        or category.endswith("类")
        or category in {"人物", "事物", "事件", "地点"}
    ):
        return ("category", category)
    return None


def question_warnings(text: str, raw_text: str) -> list[str]:
    warnings: list[str] = []
    if not text.endswith("?"):
        warnings.append("question_missing_question_mark")
    if CHINESE_RE.search(text):
        warnings.append("question_contains_chinese")
    if "待补充" in raw_text:
        warnings.append("source_marks_question_incomplete")
    if len(text) < 8:
        warnings.append("question_too_short")
    return warnings


def parse_p1_pdf(path: Path, season: str, part: int = 1) -> dict[str, Any]:
    doc = fitz.open(path)
    topics: list[dict[str, Any]] = []
    document_warnings: list[dict[str, Any]] = []

    current_category = ""
    current_freshness = "unspecified"
    current_topic: dict[str, Any] | None = None
    current_question: dict[str, Any] | None = None
    active_content = False
    sequence_by_group: dict[tuple[str, str], int] = {}

    def close_question() -> None:
        nonlocal current_question
        if current_question is None or current_topic is None:
            current_question = None
            return
        normalized = mechanical_normalize(current_question["raw_text"])
        current_question["text"] = normalized
        current_question["warnings"] = question_warnings(
            normalized, current_question["raw_text"]
        )
        current_question["needs_review"] = bool(current_question["warnings"])
        current_topic["questions"].append(current_question)
        current_question = None

    def close_topic() -> None:
        nonlocal current_topic
        close_question()
        if current_topic is None:
            return
        current_topic["source_page_end"] = current_topic.get(
            "source_page_end", current_topic["source_page_start"]
        )
        if not current_topic["questions"]:
            current_topic["warnings"].append("topic_has_no_questions")
        if current_topic["source_topic_number"] is None:
            current_topic["warnings"].append("topic_heading_missing_number")
        current_topic["needs_review"] = bool(
            current_topic["warnings"]
            or any(q["needs_review"] for q in current_topic["questions"])
        )
        topics.append(current_topic)
        current_topic = None

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_number = page_index + 1
        for line in extract_lines(page):
            raw = line["text"].strip()
            if is_header_or_footer(line, page.rect.height):
                continue

            if line["size"] >= 14:
                heading = classify_large_heading(raw)
                if heading:
                    kind, value = heading
                    active_content = True
                    if kind == "category":
                        close_topic()
                        current_category = value
                        current_freshness = "unspecified"
                    else:
                        close_topic()
                        current_freshness = value
                    continue
                # Ignore title/contents headings before the first real category.
                if not active_content:
                    continue

            if not active_content:
                continue

            # Topic headings are visually bold and around 12 pt in this source.
            if line["bold"] and 11.0 <= line["size"] <= 13.5:
                close_topic()
                match = TOPIC_NUMBER_RE.match(raw)
                source_number: int | None = None
                title_raw = raw
                if match:
                    source_number = int(match.group(1))
                    title_raw = match.group(2).strip()
                title = mechanical_normalize(title_raw)
                group_key = (current_category or "uncategorized", current_freshness)
                sequence_by_group[group_key] = sequence_by_group.get(group_key, 0) + 1
                sequence = sequence_by_group[group_key]
                topic_id = (
                    f"p{part}_{slugify(title)}_"
                    f"{slugify(season or 'undated')}_{sequence:03d}"
                )
                current_topic = {
                    "id": topic_id,
                    "part": part,
                    "season": season or None,
                    "category": current_category or "uncategorized",
                    "freshness": current_freshness,
                    "sequence": sequence,
                    "source_topic_number": source_number,
                    "topic": title,
                    "raw_topic_heading": raw,
                    "questions": [],
                    "source_page_start": page_number,
                    "source_page_end": page_number,
                    "status": "draft",
                    "version": 1,
                    "warnings": [],
                }
                continue

            q_match = QUESTION_RE.match(raw)
            if q_match and current_topic is not None:
                close_question()
                current_question = {
                    "id": "",
                    "order": int(q_match.group(1)),
                    "text": "",
                    "raw_text": q_match.group(2).strip(),
                    "source_page_start": page_number,
                    "source_page_end": page_number,
                    "warnings": [],
                    "needs_review": False,
                }
                current_topic["source_page_end"] = page_number
                continue

            # A regular line after a question is treated as a wrapped continuation.
            if current_question is not None and current_topic is not None:
                current_question["raw_text"] += " " + raw
                current_question["source_page_end"] = page_number
                current_topic["source_page_end"] = page_number
                continue

            # Keep unexpected content as a review warning, but do not invent data.
            if raw and current_topic is not None:
                document_warnings.append(
                    {
                        "page": page_number,
                        "type": "unclassified_line",
                        "text": raw,
                    }
                )

    close_topic()
    doc.close()

    # Assign stable question IDs after all wrapping is complete.
    for topic in topics:
        seen_orders: set[int] = set()
        for index, question in enumerate(topic["questions"], start=1):
            order = int(question["order"])
            question["id"] = f"{topic['id']}_q{index:02d}"
            if order in seen_orders:
                question["warnings"].append("duplicate_question_number_in_topic")
                question["needs_review"] = True
            seen_orders.add(order)

    # Detect duplicate normalized questions across the document.
    occurrences: dict[str, list[tuple[str, str]]] = {}
    for topic in topics:
        for question in topic["questions"]:
            key = re.sub(r"[^a-z0-9]+", "", question["text"].lower())
            if key:
                occurrences.setdefault(key, []).append((topic["id"], question["id"]))
    duplicate_keys = {key for key, values in occurrences.items() if len(values) > 1}
    for topic in topics:
        for question in topic["questions"]:
            key = re.sub(r"[^a-z0-9]+", "", question["text"].lower())
            if key in duplicate_keys:
                question["warnings"].append("duplicate_question_text_in_document")
                question["needs_review"] = True

    review_question_count = sum(
        1 for topic in topics for q in topic["questions"] if q["needs_review"]
    )
    review_topic_count = sum(1 for topic in topics if topic["needs_review"])

    return {
        "schema_version": "1.0",
        "source": {
            "file_name": path.name,
            "sha256": sha256_file(path),
            "page_count": len(fitz.open(path)),
            "extractor": "pymupdf_layout_p1_v1",
        },
        "part": part,
        "season": season or None,
        "topics": topics,
        "summary": {
            "topic_count": len(topics),
            "question_count": sum(len(topic["questions"]) for topic in topics),
            "topics_needing_review": review_topic_count,
            "questions_needing_review": review_question_count,
            "document_warning_count": len(document_warnings),
        },
        "document_warnings": document_warnings,
    }


def collect_pdfs(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() != ".pdf":
            raise ValueError(f"Input file is not a PDF: {input_path}")
        return [input_path]
    if input_path.is_dir():
        return sorted(input_path.glob("*.pdf"))
    raise FileNotFoundError(input_path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        required=True,
        help="A PDF file or a directory containing PDF files.",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory for generated JSON files.",
    )
    parser.add_argument("--season", default="", help="e.g. 2026-01_04")
    parser.add_argument("--part", type=int, default=1)
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    pdfs = collect_pdfs(input_path)
    if not pdfs:
        print(f"No PDFs found in {input_path}", file=sys.stderr)
        return 2

    failed = 0
    for pdf in pdfs:
        try:
            result = parse_p1_pdf(pdf, season=args.season, part=args.part)
            output_path = output_dir / f"{pdf.stem}.json"
            output_path.write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            summary = result["summary"]
            print(
                f"[OK] {pdf.name} -> {output_path.name}: "
                f"{summary['topic_count']} topics, "
                f"{summary['question_count']} questions, "
                f"{summary['questions_needing_review']} questions need review"
            )
        except Exception as exc:
            failed += 1
            print(f"[ERROR] {pdf}: {exc}", file=sys.stderr)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
