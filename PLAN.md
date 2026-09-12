# Taskhull — Build Plan

Taskhull is a task management tool for series production: planners create task
templates on the web, instantiate them for every unit that gets built, assign the
resulting tasks to workers, and workers complete them from a phone‑first PWA.

This repo is based on the Achromatic `pro-nextjs-drizzle` starter (v2.7.0). The
starter remote is kept as `upstream` so framework updates can be merged in.

## Origins

Three earlier attempts live next to this repo and were mined for reusable ideas:

- `../Taskhull` — full MES/ERP attempt. Reused: `revision` audit logger,
  `app/manifest.ts` + PWA icons, mobile route‑group shell, CPM scheduler idea.
- `../taskhull2` — focused template → project → task model with comments,
  attachments, checklist, assignments, gantt. Reused: the domain model and most
  router logic (ported to the new names below).
- `../taskhull3` — roster/skills attempt with a real template editor and vitest
  router tests. Reused: editor structure, test style.

None of them implemented template versioning; that is designed fresh here. All
three used Radix UI / Biome / Better Auth 1.4; this base uses Base UI / Oxlint /
Better Auth 1.7, so UI is rebuilt rather than copied.

## Vocabulary

- **Template** — a reusable task plan for a product. Stable identity.
- **Template version** — an immutable, numbered snapshot of a template's tasks.
  Editing happens on a _draft_; publishing freezes it.
- **Product** — a product type that is manufactured repeatedly (e.g. "Machine XY").
  Linked to one template.
- **Build** — one manufactured unit of a product, with a serial number. Created
  from a specific template version and pinned to it.
- **Build task** — a task on a build, copied from a template task at creation.
  Has assignees, checklist, comments, attachments, status.
- **Planner** — org `owner`/`admin`; works in the web dashboard.
- **Worker** — org `member`; works in the PWA under `/work`.

## Domain model

Template side

- `template` (org, name, description, archived)
- `template_version` (templateId, versionNumber, status draft|published|archived,
  publishedAt, publishedById, changeNote)
- `template_task` (versionId, title, instructions, phase, sortOrder, durationDays,
  requiresPhoto, requiresComment)
- `template_task_checklist_item` (templateTaskId, title, sortOrder)
- `template_task_dependency` (templateTaskId, dependsOnTemplateTaskId)
- `template_task_document` (templateTaskId, storageKey, fileName, contentType,
  sizeBytes) — drawings/PDFs workers download

Execution side

- `product` (org, name, description, templateId)
- `build` (org, productId, templateVersionId, serialNumber, name, status
  planned|active|blocked|completed|archived, plannedStartDate, plannedEndDate,
  actualStartedAt, actualCompletedAt)
- `build_task` (buildId, sourceTemplateTaskId, title, instructions, phase,
  sortOrder, plannedDurationDays, startDate, endDate, status
  todo|in_progress|blocked|review|done, requiresPhoto, requiresComment,
  actualStartedAt, actualCompletedAt)
- `build_task_assignment` (buildTaskId, userId, role owner|helper|reviewer)
- `build_task_dependency`
- `build_task_checklist_item` (buildTaskId, title, sortOrder, status
  open|done|skipped, completedById, completedAt)
- `build_task_comment` (buildTaskId, authorId, body)
- `build_task_attachment` (buildTaskId, uploadedById, storageKey, fileName, ...)
- `build_task_activity` (org, buildId, buildTaskId, actorId, action, metadata)
- `revision` — generic before/after audit snapshots for template and build changes

### Versioning rules

1. A template always has at most one `draft` version. Edits go to the draft.
2. **Publish** marks the draft `published`, stamps `publishedAt`, and it becomes
   immutable. Creating a build defaults to the latest published version.
3. Editing a template with no draft creates a new draft as a deep copy of the
   latest published version (tasks, checklist, dependencies, documents).
4. Builds pin `templateVersionId`; publishing a new version never changes
   existing builds.
5. Later: "upgrade build to version N" applies the diff to not‑yet‑started tasks.

### Cross‑build assignment

A product is built several times a month; every build gets the same task set.
Planners must be able to select the same task across multiple builds (e.g. all
open "Wire control cabinet" tasks) and assign them to one worker in one action.
This is plain multi‑assignment — no batch entity. The worker just sees N items in
their list, each labeled with the build's serial number.

## Phases

- **Phase 0 — Bootstrap** ✅ Rename to Taskhull, `.env`, local Postgres db
  `taskhull4`, `upstream` remote, this plan.
- **Phase 1 — Schema + API + tests** ✅ Tables/relations/enums above, Zod schemas in
  `schemas/manufacturing-schemas.ts`, tRPC routers under
  `trpc/routers/organization/`: `template`, `product`, `build`, `work`
  (worker‑facing). Vitest tests incl. tenant isolation.
- **Phase 2 — Web planner: templates** ✅ List → detail with version history →
  draft editor (sortable tasks, checklist, dependencies, document uploads) →
  publish with change note. Pages under
  `app/(saas)/dashboard/(sidebar)/organization/templates/`, components in
  `components/manufacturing/`.
- **Phase 3 — Web planner: products & builds** Products → builds. New build
  picks version (default latest published), serial, start date. Build detail:
  task list + gantt, reassign, reschedule. Cross‑build assignment grid
  (template task × build).
- **Phase 4 — Worker PWA** `app/(saas)/work/*` without sidebar. My tasks
  (today / upcoming / blocked), task detail (instructions, checklist, downloads,
  photo upload, comments, start/done). `app/manifest.ts`, icons, service worker.
- **Phase 5 — Polish** Notifications on assign/comment, activity timeline,
  upgrade‑build‑to‑version, offline write queue, web push.

## Local setup

```bash
npm install
npm run db:migrate      # uses DATABASE_URL from .env (local Postgres, db taskhull4)
npm run dev
```

Storage (R2/S3) credentials in `.env` are required for document/photo uploads.
