import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Vercel deployment keeps the Web app static and applies security headers", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const headers = config.headers.flatMap((entry) => entry.headers || []);
  assert.equal(config.cleanUrls, true);
  for (const name of ["Content-Security-Policy", "Permissions-Policy", "X-Content-Type-Options"])
    assert.equal(headers.some((header) => header.key === name), true, `missing ${name}`);
});

test("package exposes repeatable local run and test commands", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts.test, "node --test tests/*.test.mjs");
  assert.match(pkg.scripts.dev, /http\.server 8080/);
});

test("secret-bearing local files are ignored", async () => {
  const ignored = await read(".gitignore");
  assert.match(ignored, /^\.env\.\*$/m);
  assert.match(ignored, /^\.vercel\/$/m);
});
