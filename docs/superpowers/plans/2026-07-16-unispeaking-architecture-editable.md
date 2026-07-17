# UniSpeaking Architecture Editable PPT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Subagent delegation is out of scope because the user did not request it.

**Goal:** Rebuild the supplied UniSpeaking architecture screenshot as a one-slide, fully native-editable PowerPoint.

**Architecture:** Use `@oai/artifact-tool` in a plain JavaScript ES module. Recreate every container, connector, icon, and text block as a native PowerPoint object; create connectors before nodes; export and verify against a full-size render.

**Tech Stack:** Node.js, `@oai/artifact-tool`, bundled presentation render/test tools, Python read-only PPTX inspection for QA.

## Global Constraints
- Source image: `/Users/mac/Library/Containers/com.tencent.WeWorkMac/Data/Documents/Profiles/64F9B470408B8140099AC82A2CFAA0E2/Caches/Images/2026-07/553a22328b9e9b32075e9f549be319f5_HD/ChatGPT Image 2026年7月16日 15_10_36.png`.
- RUN_ROOT: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-unispeaking-architecture-native-Ji7w6m`.
- Scratch workspace: `/var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable`.
- Final PPTX: `/Users/mac/Documents/七牛云/7.16/UniSpeaking_系统架构图_可编辑版.pptx`.
- Preserve the supplied 1672×941 composition and visible wording.
- Final deck must contain no picture shapes and at least 180 native shapes.

---

### Task 1: Isolate source and establish geometry

**Files:**
- Create: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-unispeaking-architecture-native-Ji7w6m/editable/01/slide-01.png`
- Create: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-unispeaking-architecture-native-Ji7w6m/editable/01/source-geometry.txt`

**Interfaces:**
- Consumes: supplied screenshot.
- Produces: immutable task-local source and measured anchors for the builder.

- [ ] Copy the source image into RUN_ROOT.
- [ ] Verify dimensions are 1672×941.
- [ ] Record the six layer bands, left labels, node x positions, and connector y positions.

### Task 2: Initialize artifact-tool workspace and builder

**Files:**
- Create: `/var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable/tmp/build-unispeaking-architecture.mjs`
- Create: `/var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable/tmp/source-notes.txt`

**Interfaces:**
- Consumes: Task 1 geometry.
- Produces: one-slide Artifact Tool presentation and PNG preview.

- [ ] Run `setup_artifact_tool_workspace.mjs --workspace /var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable/tmp`.
- [ ] Implement helpers for shapes, positive-extents lines, polylines, text, cards, layer labels, and icons.
- [ ] Use pixel-to-point font conversion and preserve the 1672×941 slide size.

### Task 3: Build connectors and containers

**Files:**
- Modify: `/var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable/tmp/build-unispeaking-architecture.mjs`

**Interfaces:**
- Consumes: helper API from Task 2.
- Produces: title chrome, six layer containers, bottom legend, and all connector paths.

- [ ] Add all large containers and left labels.
- [ ] Add black client/access and business flow connectors first.
- [ ] Add orange AI flow, teal model calls, and gray cache/event connectors.
- [ ] Add bottom legend line samples and labels.

### Task 4: Build nodes, icons, and text

**Files:**
- Modify: `/var/folders/qs/p4f1r23s70g58lfryg_v1kz80000gn/T/codex-presentations/019f697c-2abc-7b03-8831-452466208a2d/unispeaking-architecture-editable/tmp/build-unispeaking-architecture.mjs`

**Interfaces:**
- Consumes: connector/container layer from Task 3.
- Produces: all client, Nginx, service, AI, model, and infrastructure nodes.

- [ ] Add 29 node cards at source-aligned positions.
- [ ] Add simplified native line icons for each node.
- [ ] Add every visible heading, label, and description as real text.
- [ ] Export preview, layout, inspect data, and final PPTX candidate.

### Task 5: Calibrate and verify

**Files:**
- Create: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-unispeaking-architecture-native-Ji7w6m/verification/rendered/slide-1.png`
- Create: `/Users/mac/Documents/七牛云/7.16/image2pptx_runs/20260716-unispeaking-architecture-native-Ji7w6m/verification/visual-qa/report.json`
- Create: `/Users/mac/Documents/七牛云/7.16/UniSpeaking_系统架构图_可编辑版.pptx`

**Interfaces:**
- Consumes: candidate PPTX.
- Produces: verified final deliverable.

- [ ] Render the actual PPTX at 1672×941 and inspect full size.
- [ ] Compare source and render with `visual_compare_qa.py`.
- [ ] Calibrate positions, font sizes, wrapping, and connector anchors at least once.
- [ ] Run `slides_test.py`, `unzip -t`, and object assertions: one slide, no pictures, at least 180 shapes, all key text present.
- [ ] Copy the verified PPTX to the requested 7.16 destination.

