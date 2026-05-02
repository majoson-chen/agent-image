<!--
  ce-compound 沉淀：本仓库「人类向 Cursor Canvas」路径与 Git/Agent 协作约定。
  读者：在本仓库使用或维护 Canvas 文档的 Agent 与人类协作者。
-->

---

title: Repo-local Cursor Canvas under canvases/
date: 2026-05-03
category: conventions
module: agent-image documentation / Cursor Canvas
problem_type: convention
component: documentation
severity: low
applies_when:

- Editing or adding human-facing Cursor Canvas sources in this repo
- Onboarding a new machine or collaborator who uses Cursor Canvas with this workspace
- Resolving confusion between Cursor-managed paths and Git-tracked paths
  tags:
- cursor
- canvas
- canvases
- git
- symlink
- human-docs
  related_components:
- tooling

---

# Repo-local Cursor Canvas under `canvases/`

## Context

Superpowers / Compound Engineering / plans under `docs/` produce a lot of **agent-oriented** markdown. Those files are great as filesystem context for models but are often long and hard for humans to skim.

This repo adopted **Cursor Canvas** (`*.canvas.tsx`) as **human-facing** architecture and maintainer documentation—strong layout and visual hierarchy compared to scrolling markdown in chat.

By default, Cursor’s canvas tooling expects sources under `~/.cursor/projects/<workspace>/canvases/`, which is **outside the Git workspace**. That breaks **cloud backup**, **team sharing**, and makes **agent edits** fragile: tools may treat out-of-tree paths differently (e.g. rejected or rolled-back changes). The product gap is documented separately in user feedback; locally we standardize on **repo-local** sources.

## Guidance

1. **Canonical path**
   Keep human-oriented canvas sources in **repository root** `canvases/` (only `*.canvas.tsx` for sources; see ignore rules below).

2. **Do not author into Cursor-only paths**
   Agents and humans should **create and edit** canvases **only** under the repo `canvases/` directory. Avoid writing to `~/.cursor/projects/.../canvases` as the source of truth.

3. **Local IDE bridge (optional)**
   On a given machine, if Cursor still requires its managed path, replace that directory with a **symlink** to the repo folder (direction: `~/.cursor/projects/<workspace>/canvases` → `/path/to/repo/canvases`). Re-verify after Cursor upgrades or fresh installs; symlink is **local**, not portable as a team deliverable—the **repo path** is.

4. **Ignore build sidecars**
   Ignore `canvases/*.canvas.status.json` (or equivalent) in `.gitignore`. These are local IDE/toolchain status files, not source.

5. **Repo instruction authority**
   Global Cursor **canvas** skills may still describe the managed directory. For **this repo**, **`AGENTS.md`** (Cursor Canvas section) is the project-specific override.

## Why This Matters

- **Git** becomes the sync and review surface for human canvases.
- **Agents** stay inside the workspace, reducing permission and “rolled back” friction.
- **Onboarding** is: clone repo → `canvases/` exists; optional one-time symlink for Cursor UI on that host.

## When to Apply

- Any task that creates or updates architecture / maintainer canvases for **agent-image**.
- When someone asks “where do Canvas files live?” — answer: **`canvases/` at repo root**, not only under `~/.cursor`.

## Examples

**Correct (repo-relative):**

```text
agent-image/canvases/架构总览.canvas.tsx
```

**Symlink on macOS (after removing or replacing the managed `canvases` entry):**

```bash
ln -s /Users/you/CodeSpace/agent-image/canvases \
  /Users/you/.cursor/projects/Users-you-CodeSpace-agent-image/canvases
```

**Ignore pattern (already adopted in this repo):**

```gitignore
canvases/*.canvas.status.json
```

## Related

- `AGENTS.md` — **Cursor Canvas** section (repo rule: edit only in `canvases/`).
- Session work that motivated this convention: parent Cursor transcript “Doc-system 画布与工作流” (session history).
- Draft product feedback to Cursor (workspace-native canvases, tree navigation) was prepared in the same arc (session history).
