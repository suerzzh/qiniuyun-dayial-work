# Scenes Daily Recommendation Scroll Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all three daily recommendation cards reachable through one natural page scroll on desktop and mobile.

**Architecture:** Keep the existing React markup and card styling. Fix the CSS ownership of scrolling by making `.scene-page` the single desktop scroll container and removing the nested 200px scroll region from `.scene-grid-compact`.

**Tech Stack:** Vite, React, CSS, Node.js test runner, Vercel

## Global Constraints

- Do not change scene data, card order, routes, copy, Supabase, realtime chat, prompts, or database code.
- Keep `allScenes.slice(0, 3)` as the source of the three daily cards.
- Preserve the existing desktop vertical card layout and mobile single-column card layout.
- Do not add dependencies.

---

### Task 1: Lock the desired scrolling contract

**Files:**
- Modify: `tests/static-ui.test.mjs`
- Test: `tests/static-ui.test.mjs`

**Interfaces:**
- Consumes: `styles.css` and `src/views/ScenesView.jsx` as static assets.
- Produces: a regression contract for a single reachable page scroll.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/static-ui.test.mjs`:

```js
test("daily recommendations use the scene page as the single vertical scroll container", async () => {
  const css = await read("styles.css");
  const scenes = await read("src/views/ScenesView.jsx");

  assert.match(css, /\.scene-page\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto/);
  assert.match(css, /\.scene-directory-compact \.scene-grid-compact\{[^}]*max-height:none!important;[^}]*overflow-y:visible!important/);
  assert.match(scenes, /allScenes\.slice\(0, 3\)\.map/);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test --test-name-pattern="daily recommendations" tests/static-ui.test.mjs
```

Expected: FAIL because `.scene-page` is `overflow:hidden` and the recommendation list uses `max-height:200px` plus `overflow-y:auto`.

### Task 2: Implement the minimal CSS fix

**Files:**
- Modify: `styles.css`
- Test: `tests/static-ui.test.mjs`

**Interfaces:**
- Consumes: the existing `.standard-page`, `.scene-page`, `.scene-directory-compact .scene-grid-compact`, and mobile rules.
- Produces: one vertical page scroll with all three recommendation cards in normal flow.

- [ ] **Step 1: Restore scene page scrolling**

Replace:

```css
.scene-page{overflow:hidden}
```

with:

```css
.scene-page{overflow-x:hidden;overflow-y:auto}
```

- [ ] **Step 2: Remove the nested list height and scroll limit**

In `.scene-directory-compact .scene-grid-compact`, replace:

```css
max-height: 200px !important;
overflow-y: auto !important;
```

with:

```css
max-height: none !important;
overflow-y: visible !important;
```

- [ ] **Step 3: Run the targeted test to verify GREEN**

Run:

```bash
node --test --test-name-pattern="daily recommendations" tests/static-ui.test.mjs
```

Expected: PASS.

### Task 3: Verify locally and in browsers

**Files:**
- Verify: `styles.css`
- Verify: `tests/static-ui.test.mjs`

**Interfaces:**
- Consumes: the corrected local production build.
- Produces: test and layout evidence suitable for deployment.

- [ ] **Step 1: Run the full checks**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0 and all Node tests pass.

- [ ] **Step 2: Verify desktop at 1280×720**

Open `#/scenes`, scroll `.scene-page` to its maximum, and verify:

- `scrollHeight > clientHeight`;
- computed `overflowY` is `auto`;
- the recommendation list computed `overflowY` is `visible`;
- the third card bottom is within the viewport after scrolling;
- no horizontal overflow is introduced.

- [ ] **Step 3: Verify mobile**

At a 390×844 viewport, verify the three cards appear in order, the document scroll reaches the third card, and `scrollWidth <= clientWidth`.

### Task 4: Commit, deploy, and verify production

**Files:**
- Commit: `styles.css`
- Commit: `tests/static-ui.test.mjs`
- Commit: this plan

**Interfaces:**
- Consumes: the verified production build and existing Vercel project link.
- Produces: a new READY Production deployment serving the fixed scene page.

- [ ] **Step 1: Commit only the fix files**

```bash
git add 7.16/UniSpeaking_React/styles.css 7.16/UniSpeaking_React/tests/static-ui.test.mjs 7.16/UniSpeaking_React/docs/superpowers/plans/2026-07-16-scenes-daily-recommendation-scroll.md
git commit -m "fix: make daily scene recommendations reachable"
```

- [ ] **Step 2: Push the current branch**

```bash
git push origin codex/integrate-free-chat-v2
```

- [ ] **Step 3: Deploy the verified frontend to the existing Vercel project**

Use the existing `unispeaking-web` project and current Production/Preview public environment variables. Do not create a new Vercel or Supabase project and do not change secrets.

- [ ] **Step 4: Verify production**

Open `https://app.unispeaking.cn/#/scenes` at 1280×720, scroll to the bottom, and confirm the third recommendation card is fully visible and clickable.
