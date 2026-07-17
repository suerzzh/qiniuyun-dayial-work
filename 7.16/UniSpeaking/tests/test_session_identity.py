from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from aiohttp.test_utils import TestClient, TestServer

from backend.app import create_app
from backend.business_logic import JsonConversationStore
from backend.session_identity import (
    bind_provider_session_id,
    validate_provider_session_id,
    write_session_identity_record,
)


class SessionIdentityTests(unittest.TestCase):
    def make_session(self) -> SimpleNamespace:
        return SimpleNamespace(
            session_id="local-session-123",
            user_id="demo-user-001",
            provider_session_id=None,
            created_at="2026-07-15T01:00:00+00:00",
        )

    def test_provider_session_id_validation(self) -> None:
        value = "sess_0123456789abcdef"

        self.assertEqual(validate_provider_session_id(value), value)

        for invalid in (None, "", "task_12345678", "sess_short", "sess_bad value"):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(ValueError, "provider_session_id"):
                    validate_provider_session_id(invalid)

    def test_binding_is_idempotent_and_rejects_conflict(self) -> None:
        session = self.make_session()
        provider_id = "sess_0123456789abcdef"

        self.assertEqual(bind_provider_session_id(session, provider_id), provider_id)
        self.assertEqual(bind_provider_session_id(session, provider_id), provider_id)

        with self.assertRaisesRegex(ValueError, "already bound"):
            bind_provider_session_id(session, "sess_fedcba9876543210")

    def test_close_record_is_readable_and_marks_cloud_comparison_field(self) -> None:
        session = self.make_session()
        session.provider_session_id = "sess_0123456789abcdef"

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "last_session_identity.txt"
            record = write_session_identity_record(
                output_path,
                session,
                ended_at="2026-07-15T01:05:00+00:00",
            )
            text = output_path.read_text(encoding="utf-8")

        self.assertEqual(record["user_id"], "demo-user-001")
        self.assertEqual(record["provider_session_id"], "sess_0123456789abcdef")
        self.assertEqual(record["cloud_comparison_field"], "task_uuid")
        self.assertIn("user_id: demo-user-001", text)
        self.assertIn("provider_session_id: sess_0123456789abcdef", text)
        self.assertIn("cloud_comparison_field: task_uuid", text)

    def test_close_record_marks_missing_provider_session(self) -> None:
        session = self.make_session()

        with tempfile.TemporaryDirectory() as temp_dir:
            record = write_session_identity_record(
                Path(temp_dir) / "last_session_identity.txt",
                session,
                ended_at="2026-07-15T01:05:00+00:00",
            )

        self.assertEqual(record["provider_session_id"], "NOT_CAPTURED")
        self.assertEqual(record["capture_status"], "missing")

    def test_demo_captures_and_binds_provider_session_before_close(self) -> None:
        html_path = Path(__file__).resolve().parents[1] / "webrtc_demo.html"
        html = html_path.read_text(encoding="utf-8")

        self.assertIn("obj.session?.id", html)
        self.assertIn("/provider-session", html)
        self.assertIn("providerSessionBindingPromise", html)
        self.assertIn("identity_record_file", html)


class SessionIdentityLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        app = create_app()
        app["demo_user_id"] = "demo-user-test"
        app["profile_store"] = JsonConversationStore(
            temp_path / "conversations.json"
        )
        app["identity_output_file"] = (
            temp_path / "last_session_identity.txt"
        )
        self.output_path = app["identity_output_file"]
        self.client = TestClient(TestServer(app))
        await self.client.start_server()

    async def asyncTearDown(self) -> None:
        await self.client.close()
        self.temp_dir.cleanup()

    async def test_create_bind_and_close_writes_identity_file(self) -> None:
        create_response = await self.client.post(
            "/api/sessions",
            json={"prompt": "", "conversation_id": "conversation_test"},
        )
        self.assertEqual(create_response.status, 201)
        created = await create_response.json()
        self.assertEqual(created["user_id"], "demo-user-test")

        provider_id = "sess_0123456789abcdef"
        bind_response = await self.client.post(
            f"/api/sessions/{created['session_id']}/provider-session",
            json={"provider_session_id": provider_id},
        )
        self.assertEqual(bind_response.status, 200)
        bound = await bind_response.json()
        self.assertEqual(bound["provider_session_id"], provider_id)

        close_response = await self.client.delete(
            f"/api/sessions/{created['session_id']}"
        )
        self.assertEqual(close_response.status, 200)
        closed = await close_response.json()
        self.assertEqual(closed["identity_record"]["user_id"], "demo-user-test")
        self.assertEqual(
            closed["identity_record"]["provider_session_id"], provider_id
        )
        self.assertTrue(self.output_path.exists())
        self.assertIn(provider_id, self.output_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
