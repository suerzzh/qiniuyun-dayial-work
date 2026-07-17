from __future__ import annotations

import unittest

import aiohttp
from aiohttp import web
from aiohttp.test_utils import TestServer

from backend.temporary_key import (
    TemporaryApiKeyError,
    issue_temporary_api_key,
    resolve_realtime_api_key,
)


class TemporaryApiKeyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.requests: list[dict[str, str]] = []

    async def _start_server(
        self, handler: web.RequestHandler
    ) -> TestServer:
        app = web.Application()
        app.router.add_post("/api/v1/tokens", handler)
        server = TestServer(app)
        await server.start_server()
        self.addAsyncCleanup(server.close)
        return server

    async def test_issues_600_second_key_with_parent_bearer(self) -> None:
        async def handler(request: web.Request) -> web.Response:
            self.requests.append(
                {
                    "authorization": request.headers.get(
                        "Authorization", ""
                    ),
                    "ttl": request.query.get("expire_in_seconds", ""),
                }
            )
            return web.json_response(
                {"token": "st-test-token", "expires_at": 1_800_000_000}
            )

        server = await self._start_server(handler)
        async with aiohttp.ClientSession() as client:
            temporary_key = await issue_temporary_api_key(
                client,
                permanent_api_key="sk-test-parent",
                ttl_seconds=600,
                token_endpoint=str(server.make_url("/api/v1/tokens")),
            )

        self.assertEqual(temporary_key.token, "st-test-token")
        self.assertEqual(temporary_key.expires_at, 1_800_000_000)
        self.assertEqual(
            self.requests,
            [
                {
                    "authorization": "Bearer sk-test-parent",
                    "ttl": "600",
                }
            ],
        )

    async def test_rejects_ttl_outside_official_range(self) -> None:
        async with aiohttp.ClientSession() as client:
            with self.assertRaisesRegex(
                ValueError, "between 1 and 1800 seconds"
            ):
                await issue_temporary_api_key(
                    client,
                    permanent_api_key="sk-test-parent",
                    ttl_seconds=1801,
                )

    async def test_rejects_non_success_without_exposing_response(self) -> None:
        async def handler(request: web.Request) -> web.Response:
            return web.json_response(
                {"message": "do-not-copy-upstream-details"}, status=401
            )

        server = await self._start_server(handler)
        async with aiohttp.ClientSession() as client:
            with self.assertRaisesRegex(
                TemporaryApiKeyError,
                "temporary API key request failed with status 401",
            ) as raised:
                await issue_temporary_api_key(
                    client,
                    permanent_api_key="sk-test-parent",
                    ttl_seconds=600,
                    token_endpoint=str(server.make_url("/api/v1/tokens")),
                )

        self.assertNotIn("do-not-copy", str(raised.exception))
        self.assertNotIn("sk-test-parent", str(raised.exception))

    async def test_rejects_success_response_without_token(self) -> None:
        async def handler(request: web.Request) -> web.Response:
            return web.json_response({"expires_at": 1_800_000_000})

        server = await self._start_server(handler)
        async with aiohttp.ClientSession() as client:
            with self.assertRaisesRegex(
                TemporaryApiKeyError,
                "temporary API key response is missing token",
            ):
                await issue_temporary_api_key(
                    client,
                    permanent_api_key="sk-test-parent",
                    ttl_seconds=600,
                    token_endpoint=str(server.make_url("/api/v1/tokens")),
                )

    async def test_resolves_temporary_key_when_enabled(self) -> None:
        async def handler(request: web.Request) -> web.Response:
            return web.json_response(
                {"token": "st-test-token", "expires_at": 1_800_000_000}
            )

        server = await self._start_server(handler)
        async with aiohttp.ClientSession() as client:
            credential = await resolve_realtime_api_key(
                client,
                permanent_api_key="sk-test-parent",
                use_temporary_key=True,
                ttl_seconds=600,
                token_endpoint=str(server.make_url("/api/v1/tokens")),
            )

        self.assertEqual(credential.token, "st-test-token")
        self.assertEqual(credential.mode, "temporary")
        self.assertEqual(credential.expires_at, 1_800_000_000)

    async def test_keeps_permanent_key_when_temporary_mode_disabled(self) -> None:
        async with aiohttp.ClientSession() as client:
            credential = await resolve_realtime_api_key(
                client,
                permanent_api_key="sk-test-parent",
                use_temporary_key=False,
                ttl_seconds=600,
            )

        self.assertEqual(credential.token, "sk-test-parent")
        self.assertEqual(credential.mode, "permanent")
        self.assertIsNone(credential.expires_at)


if __name__ == "__main__":
    unittest.main()
