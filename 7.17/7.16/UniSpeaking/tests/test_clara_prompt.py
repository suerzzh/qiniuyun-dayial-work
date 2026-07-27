from __future__ import annotations

import re
import unittest
from pathlib import Path

from backend.business_logic import (
    ENGLISH_COACH_SYSTEM_PROMPT,
    RealtimeBusinessLogic,
    SessionState,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
PROMPT_REVIEW_FILE = ROOT_DIR / "Clara_当前英文提示词中英对照版.md"


def reviewed_english_prompt() -> str:
    markdown = PROMPT_REVIEW_FILE.read_text(encoding="utf-8")
    section = markdown.split("## 4.", 1)[1].split("## 5.", 1)[0]
    match = re.search(r"```text\n(.*?)\n```", section, re.DOTALL)
    if not match:
        raise AssertionError("Section 4 English prompt block was not found")
    return match.group(1).strip()


class ClaraPromptTests(unittest.TestCase):
    def test_runtime_prompt_exactly_matches_reviewed_section_four(self) -> None:
        expected = reviewed_english_prompt()

        self.assertEqual(ENGLISH_COACH_SYSTEM_PROMPT, expected)
        self.assertIn("Clara Chen", ENGLISH_COACH_SYSTEM_PROMPT)
        self.assertIn(
            "Emotion -> Need -> Scene -> Response move",
            ENGLISH_COACH_SYSTEM_PROMPT,
        )
        self.assertIn("Layer 7: Safety and Boundaries", ENGLISH_COACH_SYSTEM_PROMPT)

    def test_dynamic_sections_are_appended_after_the_new_fixed_prompt(self) -> None:
        session = SessionState(
            session_id="test-session",
            conversation_id="test-conversation",
            user_id="test-user",
            user_prompt="Practice a short conversation about commuting.",
        )
        instructions = RealtimeBusinessLogic(
            "Keep the application-specific safety rule."
        ).build_instructions(session)

        self.assertTrue(instructions.startswith(reviewed_english_prompt()))
        self.assertIn("Adaptive language level:", instructions)
        self.assertIn("Application rules:\nKeep the application-specific safety rule.", instructions)
        self.assertIn(
            "Lesson focus:\nPractice a short conversation about commuting.",
            instructions,
        )


if __name__ == "__main__":
    unittest.main()
