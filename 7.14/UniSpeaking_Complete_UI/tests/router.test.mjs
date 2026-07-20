import test from "node:test";
import assert from "node:assert/strict";

import { globalSection, parseRoute, routeHref } from "../src/router.mjs";

test("parses the four global destinations", () => {
  assert.deepEqual(parseRoute("#/conversation"), { name: "conversation", params: {}, invalid: false });
  assert.equal(parseRoute("#/scenes").name, "scenes");
  assert.equal(parseRoute("#/review").name, "review");
  assert.deepEqual(parseRoute("#/profile/overview"), {
    name: "profile",
    params: { section: "overview" },
    invalid: false,
  });
});

test("parses every cafe training stage", () => {
  assert.deepEqual(parseRoute("#/training/cafe/sentences"), {
    name: "training",
    params: { scene: "cafe", stage: "sentences" },
    invalid: false,
  });
  assert.equal(routeHref("training", { scene: "cafe", stage: "diagnostic" }), "#/training/cafe/diagnostic");
});

test("falls back safely for an unknown route", () => {
  assert.deepEqual(parseRoute("#/unknown"), { name: "conversation", params: {}, invalid: true });
});

test("parses the IELTS feature route inside the scene section", () => {
  const route = parseRoute("#/ielts");
  assert.deepEqual(route, { name: "ielts", params: {}, invalid: false });
  assert.equal(routeHref("ielts"), "#/ielts");
  assert.equal(globalSection(route), "scenes");
});
