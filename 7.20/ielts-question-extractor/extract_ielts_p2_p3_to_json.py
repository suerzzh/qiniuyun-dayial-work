#!/usr/bin/env python3
"""
Batch-extract IELTS Speaking Part 2 cue cards and their related Part 3
questions from layout-based PDFs into one reviewable JSON file per PDF.

Expected source pattern:
- category heading: 一、人物类 / 二、事物类 / 三、事件类 / 四、地点类
- freshness heading: 新题 / 老题保留
- topic heading: bold numbered Chinese heading, e.g. 1.想见的名人
- optional marker: Part 2
- Part 2 prompt, possibly wrapped across pages
- marker: You should say:
- cue points, possibly wrapped across pages
- marker: Part 3, sometimes appended to the final cue-point line
- numbered Part 3 questions, possibly wrapped across pages

The extractor preserves source text and only applies mechanical Unicode,
spacing, and punctuation normalization. It does not silently correct grammar
or rewrite question meaning.
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
        "PyMuPDF is required. Install it inside your virtual environment with: "
        "python -m pip install pymupdf"
    ) from exc


HEADER_MARKERS = ("口语题库P2&P3", "口语题库 P2&P3", "IELTS Speaking")
FRESHNESS_VALUES = {
    "新题": "new",
    "老题": "old",
    "老题保留": "old",
}

TOPIC_RE = re.compile(r"^\s*(\d{1,3})\s*[.．、)]\s*(.+?)\s*$")
P3_QUESTION_RE = re.compile(r"^\s*(\d{1,3})\s*[.．、)]\s*(.+?)\s*$")
CATEGORY_PREFIX_RE = re.compile(r"^[一二三四五六七八九十]+[、.．]\s*")
PART2_MARKER_RE = re.compile(r"^\s*Part\s*2\s*$", re.I)
PART3_MARKER_RE = re.compile(r"^\s*Part\s*3\s*$", re.I)
YOU_SHOULD_SAY_RE = re.compile(r"^\s*You\s+should\s+say\s*:?\s*$", re.I)
INLINE_PART3_RE = re.compile(r"^(.*?)(?:\s+Part\s*3)\s*$", re.I)
CUE_START_RE = re.compile(
    r"^(?:Who|Whom|Whose|What|When|Where|Why|How|Which|Whether|To\s+whom|"
    r"With\s+whom|And\b|and\b)",
    re.I,
)
PREMARKER_CUE_START_RE = re.compile(
    r"^(?:Who|Whom|Whose|What|When|Where|Why|How|Which|Whether|"
    r"To\s+whom|With\s+whom|And\b)"
)
EMBEDDED_CUE_START_RE = re.compile(
    r"\s+(?=(?:Who|Whom|Whose|What|When|Where|Why|How|Which|Whether|"
    r"To\s+whom|With\s+whom|And\s+(?:explain|how|why))\b)"
)
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
    return value or "undated"


def mechanical_normalize(value: str) -> str:
    """Normalize typography and spacing without changing grammar or meaning."""
    value = unicodedata.normalize("NFKC", value)
    replacements = {
        "？": "?",
        "，": ",",
        "；": ";",
        "：": ":",
        "。": ".",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "（": "(",
        "）": ")",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    value = MULTISPACE_RE.sub(" ", value).strip()
    value = SPACE_BEFORE_PUNCT_RE.sub(r"\1", value)
    value = MISSING_SPACE_AFTER_PUNCT_RE.sub(r"\1 ", value)
    return value


def extract_lines(page: fitz.Page) -> list[dict[str, Any]]:
    data = page.get_text("dict", sort=True)
    lines: list[dict[str, Any]] = []
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            text = "".join(str(span.get("text", "")) for span in spans).strip()
            if not text:
                continue
            bbox = tuple(line.get("bbox", (0, 0, 0, 0)))
            lines.append(
                {
                    "text": text,
                    "size": max(float(span.get("size", 0)) for span in spans),
                    "bold": any(
                        "bold" in str(span.get("font", "")).lower()
                        or (int(span.get("flags", 0)) & 16)
                        for span in spans
                    ),
                    "colors": [int(span.get("color", 0)) for span in spans],
                    "x0": float(bbox[0]),
                    "y0": float(bbox[1]),
                    "y1": float(bbox[3]),
                }
            )
    lines.sort(key=lambda item: (round(item["y0"], 1), item["x0"]))
    return lines


def is_header_or_footer(line: dict[str, Any], page_height: float) -> bool:
    text = mechanical_normalize(line["text"])
    compact = text.replace(" ", "")
    if any(marker.replace(" ", "") in compact for marker in HEADER_MARKERS):
        return True
    if line["y0"] > page_height - 55 and re.fullmatch(r"\d{1,3}", text):
        return True
    return False


def normalize_heading_text(value: str) -> str:
    return mechanical_normalize(value).rstrip(":").strip()


def classify_large_heading(line: dict[str, Any]) -> tuple[str, str] | None:
    text = normalize_heading_text(line["text"])
    freshness = FRESHNESS_VALUES.get(text)
    if freshness:
        return ("freshness", freshness)

    category = CATEGORY_PREFIX_RE.sub("", text).strip()
    if line["size"] >= 15 and (
        category.endswith("类") or category in {"人物", "事物", "事件", "地点"}
    ):
        return ("category", category)
    return None


def is_topic_heading(line: dict[str, Any]) -> re.Match[str] | None:
    if not line["bold"] or not (10.5 <= line["size"] <= 13.5):
        return None
    match = TOPIC_RE.match(mechanical_normalize(line["text"]))
    if not match:
        return None
    title = match.group(2)
    # Topic headings in this source are Chinese labels. This also prevents bold
    # numbered English content from being mistaken for a new topic.
    return match if CHINESE_RE.search(title) else None



def split_cue_segments(value: str) -> list[str]:
    """Split cue points that the PDF text layer merged onto one line.

    The split only occurs before an uppercase IELTS cue-word token, so phrases
    such as ``How/where`` remain intact.
    """
    normalized = mechanical_normalize(value)
    parts = [part.strip() for part in EMBEDDED_CUE_START_RE.split(normalized)]
    return [part for part in parts if part]


def line_ref(raw: str, page_number: int) -> dict[str, Any]:
    return {
        "raw_text": raw,
        "text": mechanical_normalize(raw),
        "source_page_start": page_number,
        "source_page_end": page_number,
    }


def append_wrapped(target: dict[str, Any], raw: str, page_number: int) -> None:
    target["raw_text"] = f"{target['raw_text']} {raw}".strip()
    target["text"] = mechanical_normalize(target["raw_text"])
    target["source_page_end"] = page_number


def question_warnings(text: str, raw_text: str) -> list[str]:
    warnings: list[str] = []
    if not text.endswith("?"):
        warnings.append("question_missing_question_mark")
    if CHINESE_RE.search(text):
        warnings.append("question_contains_chinese")
    if len(text) < 8:
        warnings.append("question_too_short")
    if "待补充" in raw_text:
        warnings.append("source_marks_question_incomplete")
    return warnings


def cue_warnings(text: str) -> list[str]:
    warnings: list[str] = []
    if CHINESE_RE.search(text):
        warnings.append("cue_point_contains_chinese")
    if len(text) < 3:
        warnings.append("cue_point_too_short")
    return warnings


def parse_p2_p3_pdf(path: Path, season: str) -> dict[str, Any]:
    doc = fitz.open(path)
    topics: list[dict[str, Any]] = []
    document_warnings: list[dict[str, Any]] = []

    current_category = ""
    current_freshness = "unspecified"
    current_topic: dict[str, Any] | None = None
    current_section: str | None = None
    current_p3_question: dict[str, Any] | None = None
    current_cue: dict[str, Any] | None = None
    active_content = False
    global_sequence = 0

    def touch_part(part_key: str, page_number: int) -> None:
        if current_topic is None:
            return
        part = current_topic[part_key]
        if part["source_page_start"] is None:
            part["source_page_start"] = page_number
        part["source_page_end"] = page_number
        current_topic["source_page_end"] = page_number

    def close_cue() -> None:
        nonlocal current_cue
        if current_cue is None or current_topic is None:
            current_cue = None
            return
        current_cue["text"] = mechanical_normalize(current_cue["raw_text"])
        current_cue["warnings"] = cue_warnings(current_cue["text"])
        current_cue["needs_review"] = bool(current_cue["warnings"])
        current_topic["part2"]["cue_points"].append(current_cue)
        current_cue = None

    def close_p3_question() -> None:
        nonlocal current_p3_question
        if current_p3_question is None or current_topic is None:
            current_p3_question = None
            return
        current_p3_question["text"] = mechanical_normalize(
            current_p3_question["raw_text"]
        )
        current_p3_question["warnings"] = question_warnings(
            current_p3_question["text"], current_p3_question["raw_text"]
        )
        current_p3_question["needs_review"] = bool(
            current_p3_question["warnings"]
        )
        current_topic["part3"]["questions"].append(current_p3_question)
        current_p3_question = None

    def switch_to_part3(page_number: int) -> None:
        nonlocal current_section
        close_cue()
        current_section = "part3"
        if current_topic is not None:
            current_topic["part3"]["marker_found"] = True
            touch_part("part3", page_number)

    def add_cue_text(raw: str, page_number: int) -> None:
        nonlocal current_cue
        if current_topic is None:
            return
        for segment in split_cue_segments(raw):
            if current_cue is None:
                current_cue = line_ref(segment, page_number)
                current_cue["order"] = len(current_topic["part2"]["cue_points"]) + 1
            elif CUE_START_RE.match(segment):
                close_cue()
                current_cue = line_ref(segment, page_number)
                current_cue["order"] = len(current_topic["part2"]["cue_points"]) + 1
            else:
                append_wrapped(current_cue, segment, page_number)

    def process_content_line(raw: str, page_number: int) -> None:
        nonlocal current_section, current_cue, current_p3_question
        if current_topic is None:
            return

        normalized = mechanical_normalize(raw)

        if PART2_MARKER_RE.fullmatch(normalized):
            close_cue()
            close_p3_question()
            current_topic["part2"]["marker_found"] = True
            current_section = "part2_prompt"
            touch_part("part2", page_number)
            return

        if YOU_SHOULD_SAY_RE.fullmatch(normalized):
            close_cue()
            current_topic["part2"]["you_should_say_found"] = True
            current_section = "part2_cues"
            touch_part("part2", page_number)
            return

        if PART3_MARKER_RE.fullmatch(normalized):
            switch_to_part3(page_number)
            return

        inline_p3 = INLINE_PART3_RE.match(normalized)
        if inline_p3 and inline_p3.group(1).strip():
            prefix = inline_p3.group(1).strip()
            # Process the text before the appended marker as normal Part 2 content.
            process_content_line(prefix, page_number)
            switch_to_part3(page_number)
            current_topic["warnings"].append("part3_marker_appended_to_content")
            return

        if current_section is None:
            # Some source entries omit the literal "Part 2" marker. Text before
            # "You should say" is still the cue-card prompt.
            current_section = "part2_prompt"

        if current_section == "part2_prompt":
            touch_part("part2", page_number)
            prompt = current_topic["part2"]["prompt"]
            # A few source entries place the first cue point before the literal
            # "You should say" marker. Once a prompt already exists, a new line
            # beginning with a cue-word is treated as that misplaced cue point.
            if prompt["raw_text"] and PREMARKER_CUE_START_RE.match(normalized):
                current_topic["part2"]["warnings"].append(
                    "cue_point_before_you_should_say_marker"
                )
                current_section = "part2_cues_before_marker"
                add_cue_text(raw, page_number)
            elif prompt["raw_text"]:
                append_wrapped(prompt, raw, page_number)
            else:
                prompt.update(line_ref(raw, page_number))
            return

        if current_section in {"part2_cues", "part2_cues_before_marker"}:
            touch_part("part2", page_number)
            add_cue_text(raw, page_number)
            return

        if current_section == "part3":
            touch_part("part3", page_number)
            match = P3_QUESTION_RE.match(normalized)
            if match:
                close_p3_question()
                current_p3_question = {
                    "id": "",
                    "source_question_number": int(match.group(1)),
                    "order": len(current_topic["part3"]["questions"]) + 1,
                    "raw_text": match.group(2).strip(),
                    "text": "",
                    "source_page_start": page_number,
                    "source_page_end": page_number,
                    "warnings": [],
                    "needs_review": False,
                }
            elif current_p3_question is not None:
                append_wrapped(current_p3_question, raw, page_number)
            else:
                document_warnings.append(
                    {
                        "page": page_number,
                        "type": "part3_unclassified_line",
                        "topic_id": current_topic["id"],
                        "text": raw,
                    }
                )
            return

    def close_topic() -> None:
        nonlocal current_topic, current_section
        if current_topic is None:
            return
        close_cue()
        close_p3_question()

        part2 = current_topic["part2"]
        part3 = current_topic["part3"]
        part2["prompt"]["text"] = mechanical_normalize(
            part2["prompt"]["raw_text"]
        )

        if not part2["marker_found"]:
            part2["warnings"].append("part2_marker_missing")
        if not part2["prompt"]["text"]:
            part2["warnings"].append("part2_prompt_missing")
        if not part2["you_should_say_found"]:
            part2["warnings"].append("you_should_say_marker_missing")
        if len(part2["cue_points"]) < 3:
            part2["warnings"].append("part2_has_fewer_than_3_cue_points")

        if not part3["marker_found"]:
            part3["warnings"].append("part3_marker_missing")
        if not part3["questions"]:
            part3["warnings"].append("part3_has_no_questions")

        # Assign IDs and inspect source numbering.
        seen_numbers: set[int] = set()
        expected_number = 1
        for index, question in enumerate(part3["questions"], start=1):
            question["id"] = f"{current_topic['id']}_p3_q{index:02d}"
            number = int(question["source_question_number"])
            if number in seen_numbers:
                question["warnings"].append("duplicate_question_number_in_topic")
            if number != expected_number:
                question["warnings"].append(
                    f"unexpected_question_number_expected_{expected_number}"
                )
            seen_numbers.add(number)
            expected_number = number + 1
            question["needs_review"] = bool(question["warnings"])

        for index, cue in enumerate(part2["cue_points"], start=1):
            cue["id"] = f"{current_topic['id']}_p2_cue{index:02d}"
            cue["order"] = index

        part2["needs_review"] = bool(
            part2["warnings"]
            or any(cue["needs_review"] for cue in part2["cue_points"])
        )
        part3["needs_review"] = bool(
            part3["warnings"]
            or any(q["needs_review"] for q in part3["questions"])
        )
        current_topic["needs_review"] = bool(
            current_topic["warnings"]
            or part2["needs_review"]
            or part3["needs_review"]
        )
        topics.append(current_topic)
        current_topic = None
        current_section = None

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_number = page_index + 1
        for line in extract_lines(page):
            raw = line["text"].strip()
            if is_header_or_footer(line, page.rect.height):
                continue

            heading = classify_large_heading(line)
            if heading:
                kind, value = heading
                active_content = True
                close_topic()
                if kind == "category":
                    current_category = value
                    current_freshness = "unspecified"
                else:
                    current_freshness = value
                continue

            if not active_content:
                # Skip title and table-of-contents pages before the first category.
                continue

            topic_match = is_topic_heading(line)
            if topic_match:
                close_topic()
                global_sequence += 1
                source_number = int(topic_match.group(1))
                title = mechanical_normalize(topic_match.group(2))
                topic_id = (
                    f"p23_{slugify(season or 'undated')}_{global_sequence:03d}"
                )
                current_topic = {
                    "id": topic_id,
                    "season": season or None,
                    "category": current_category or "uncategorized",
                    "freshness": current_freshness,
                    "sequence": global_sequence,
                    "source_topic_number": source_number,
                    "title": title,
                    "raw_topic_heading": raw,
                    "topic_cluster": None,
                    "source_page_start": page_number,
                    "source_page_end": page_number,
                    "status": "draft",
                    "version": 1,
                    "part2": {
                        "marker_found": False,
                        "you_should_say_found": False,
                        "prompt": {
                            "raw_text": "",
                            "text": "",
                            "source_page_start": None,
                            "source_page_end": None,
                        },
                        "cue_points": [],
                        "source_page_start": None,
                        "source_page_end": None,
                        "warnings": [],
                        "needs_review": False,
                    },
                    "part3": {
                        "marker_found": False,
                        "questions": [],
                        "source_page_start": None,
                        "source_page_end": None,
                        "warnings": [],
                        "needs_review": False,
                    },
                    "warnings": [],
                    "needs_review": False,
                }
                current_section = None
                continue

            if current_topic is not None:
                process_content_line(raw, page_number)
            elif raw:
                # Content after a category/freshness heading but before a topic is
                # typically decorative or malformed; retain it for review.
                document_warnings.append(
                    {
                        "page": page_number,
                        "type": "unclassified_line_outside_topic",
                        "text": raw,
                    }
                )

    close_topic()
    page_count = len(doc)
    doc.close()

    # Duplicate detection across Part 3 questions.
    occurrences: dict[str, list[str]] = {}
    for topic in topics:
        for question in topic["part3"]["questions"]:
            key = re.sub(r"[^a-z0-9]+", "", question["text"].lower())
            if key:
                occurrences.setdefault(key, []).append(question["id"])
    duplicate_keys = {key for key, ids in occurrences.items() if len(ids) > 1}
    for topic in topics:
        for question in topic["part3"]["questions"]:
            key = re.sub(r"[^a-z0-9]+", "", question["text"].lower())
            if key in duplicate_keys:
                question["warnings"].append("duplicate_question_text_in_document")
                question["needs_review"] = True
                topic["part3"]["needs_review"] = True
                topic["needs_review"] = True

    return {
        "schema_version": "1.0",
        "source": {
            "file_name": path.name,
            "sha256": sha256_file(path),
            "page_count": page_count,
            "extractor": "pymupdf_layout_p2_p3_v1",
        },
        "season": season or None,
        "topics": topics,
        "summary": {
            "topic_count": len(topics),
            "part2_prompt_count": sum(
                1 for topic in topics if topic["part2"]["prompt"]["text"]
            ),
            "part2_cue_point_count": sum(
                len(topic["part2"]["cue_points"]) for topic in topics
            ),
            "part3_question_count": sum(
                len(topic["part3"]["questions"]) for topic in topics
            ),
            "topics_needing_review": sum(
                1 for topic in topics if topic["needs_review"]
            ),
            "part2_sections_needing_review": sum(
                1 for topic in topics if topic["part2"]["needs_review"]
            ),
            "part3_sections_needing_review": sum(
                1 for topic in topics if topic["part3"]["needs_review"]
            ),
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
    parser = argparse.ArgumentParser(
        description="Extract combined IELTS Part 2 and Part 3 JSON from PDFs."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="A P2&P3 PDF file or a directory containing PDF files.",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory for generated JSON files.",
    )
    parser.add_argument("--season", default="", help="e.g. 2026-01_04")
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
            result = parse_p2_p3_pdf(pdf, season=args.season)
            output_path = output_dir / f"{pdf.stem}.json"
            output_path.write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            summary = result["summary"]
            print(
                f"[OK] {pdf.name} -> {output_path.name}: "
                f"{summary['topic_count']} topics, "
                f"{summary['part2_prompt_count']} Part 2 prompts, "
                f"{summary['part2_cue_point_count']} cue points, "
                f"{summary['part3_question_count']} Part 3 questions, "
                f"{summary['topics_needing_review']} topics need review"
            )
        except Exception as exc:
            failed += 1
            print(f"[ERROR] {pdf}: {exc}", file=sys.stderr)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
