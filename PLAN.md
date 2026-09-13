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
- **Phase 3 — Web planner: products & builds** ✅ Products list/detail
  (`/organization/products`), builds list/detail (`/organization/builds`).
  New build picks version (default latest published), serial, start date.
  Build detail: task list grouped by phase with inline assign/unassign and
  status change, day‑scale gantt (`build-gantt.tsx`), build status/delete menu.
  Cross‑build assignment grid on the product page (`assignment-grid.tsx`):
  select a whole row (= same task on every open unit) or single cells, then
  "Assign selected to…" a member. Not yet: rescheduling dates from the UI and
  planner‑side add/edit of ad‑hoc build tasks (router exists).
- **Phase 4 — Worker PWA** ✅ `app/(saas)/dashboard/work/*` (protected by the
  existing proxy, no sidebar, phone‑width column, safe‑area padding). "My
  tasks" (`components/work/my-tasks-list.tsx`) groups ready / waiting on other
  tasks / finished, each card labelled with product · serial · phase. Task
  detail (`work-task-detail.tsx`): blockers, instructions, tap‑to‑tick
  checklist, template documents (download), photos (camera capture upload),
  comments, sticky Start / Mark done / Blocked / Reopen bar with the
  photo/comment requirements surfaced. Auto‑selects the organization for
  workers with a single membership (`work-org-picker.tsx`). `app/manifest.ts`
  - icons; "My tasks" link in the planner sidebar.
- **Phase 5 — Polish** ✅
  - _Notifications_ (`lib/manufacturing/notifications.ts`, reuses the
    starter's `notification` table + bell): worker gets one aggregated
    notification per `build.assign` call ("Mount frame on 4 builds"), planners
    (owner/admin) get comment / blocked / finished, other assignees get
    comments, and assignees of dependent tasks get "Ready to start: …" once
    all their blockers are done. Actor is never notified about their own
    action.
  - _Activity timeline_ (`components/manufacturing/activity-timeline.tsx`):
    "Activity" tab on the build page, collapsible "History" on the worker task
    page. Reads `work.activity`.
  - _Upgrade build to version_: `template_task.lineage_id` (inherited when a
    draft is copied) identifies the same task across versions.
    `build.upgradeToVersion` (`upgradeBuildToVersion` in
    `lib/manufacturing/builds.ts`) merges a newer published version into an
    open build: matching tasks are updated in place (finished ones untouched),
    new tasks added unassigned, dropped tasks deleted only if untouched
    (otherwise kept as ad‑hoc), checklists merged by title, template documents
    synced, template dependencies rebuilt, open tasks rescheduled. Banner on
    the build page when `build.get().availableUpgrades` is non‑empty. The
    assignment grid now merges rows by lineage instead of title.
  - _Offline write queue_ (`lib/offline/queue.ts`,
    `components/work/offline-provider.tsx`): status / checklist / comment
    writes made without connectivity (or that fail with a network error) are
    stored in `localStorage`, shown as "waiting to sync", and replayed in order
    on `online` / tab focus. Server rejections on replay are dropped with a
    toast. Header shows "Offline" / "N to sync".
  - _Service worker_ (`public/sw.js`, registered from the worker layout):
    network‑first with cache fallback for worker pages, RSC payloads and tRPC
    GET queries; `offline.html` fallback; cache‑first for hashed static assets
    in production only.
  - _Web push_: `push_subscription` table, `notification.pushConfig /
subscribePush / unsubscribePush`, `lib/notifications/push.ts` (web‑push,
    prunes 404/410 endpoints). Opt‑in lives in the worker account menu and
    only shows when VAPID keys are configured. Push is fire‑and‑forget after
    the in‑app notification is written.

- **Phase 6 — Beta hardening** (done; implemented in this order)
  1. _Role‑based landing after sign‑in._ New server page
     `app/(saas)/dashboard/start/page.tsx`: loads the session + memberships;
     if every membership is `member` → `redirect("/dashboard/work")`, if the
     user has exactly one org → that org's dashboard, otherwise the existing
     organizations grid. `authConfig.redirectAfterSignIn` becomes
     `/dashboard/start`; `?redirectTo=` and invitation links keep priority
     (`getAuthRedirectPath`). Sidebar "Home" stays on `/dashboard`.
  2. _Planner‑side task editing on the build page._ Router already has
     `build.createTask / updateTask / deleteTask`; add the UI:
     `components/manufacturing/build-task-modal.tsx` (NiceModal form: title,
     phase, instructions, start date, duration, requires photo/comment,
     optional "after" dependencies) opened from an "Add task" button per phase
     group and from an "Edit" item in the task detail sheet; "Delete task" in
     the same menu with confirmation (blocked if the task has progress).
     Ad‑hoc tasks show a small "ad‑hoc" badge (`sourceTemplateTaskId` is
     null) so it is clear they will not be touched by version upgrades.
  3. _Upload guardrails._ Shared constants in `lib/manufacturing/uploads.ts`:
     photos ≤ 15 MB, allowed types `image/jpeg|png|webp|heic`; template
     documents ≤ 50 MB, images + PDF + office formats. Enforced in the Zod
     schemas (`sizeBytes` and `contentType` become required) and again in
     `attachmentUploadUrl` / template upload before signing, with
     `ContentLength`/`ContentType` pinned in the presigned PUT. Client side:
     check before requesting the URL and show the limit in the error. Photos
     from the camera are downscaled to ≤ 2000 px on the longest edge with
     `canvas` before upload (keeps 4K phone photos under the cap).
  4. _Worker PWA in German (and English)._ No framework: `lib/i18n/work.ts`
     exports a typed dictionary `{ de, en }` for every string in
     `components/work/*` and the worker notifications; `useWorkT()` picks the
     language from `user.locale` (new nullable `locale` column on `user`,
     toggled from the worker account menu via `user.setLocale`) and falls
     back to `navigator.language`, default `en`. Dates via
     `date-fns/locale/de`. Notifications are rendered per recipient locale
     (`notifyUsers` groups recipients by `user.locale`). Planner UI stays
     English for now.
  5. _Blocked always needs a reason._ `updateBuildTaskStatusSchema` gets an
     optional `comment`; the server rejects `→ blocked` without a non‑empty
     comment (planners included) and writes comment + status change in one
     transaction so the "blocked" notification carries the reason. Worker UI:
     the Blocked button opens a bottom sheet with a textarea ("What is
     missing?") and quick chips (material missing, tool missing, waiting for
     colleague, drawing unclear). The offline queue's `updateStatus` item
     carries the comment too. Planner task sheet already shows the latest
     worker comment in the blocked callout.
  6. _Offline photos._ Queue kind `uploadPhoto` stores `{ taskId, fileName,
contentType }` in `localStorage` and the (downscaled) blob in IndexedDB
     (`lib/offline/photo-store.ts`, tiny wrapper, no dependency). Replay:
     `attachmentUploadUrl` → PUT → `addAttachment`, in order after status
     writes so a "done with photo" made offline lands correctly. Pending
     photos render as local thumbnails with "waiting to sync"; failures with a
     4xx are dropped with a toast, network failures stay queued. Same
     `isNetworkError` path as the other writes.

  Not in this phase: hiding the starter marketing/billing pages (separate
  decision), planner UI localisation, teammate visibility in the PWA.

## Local setup

```bash
npm install
npm run db:migrate      # uses DATABASE_URL from .env (local Postgres, db taskhull4)
npm run dev
```

Storage (R2/S3) credentials in `.env` are required for document/photo uploads.
Web push needs VAPID keys (`npx web-push generate-vapid-keys`) in
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; without
them the opt‑in button is hidden and only in‑app notifications are sent.

## Known gaps / next ideas

- Bulk "upgrade all open builds of this product" (currently per build).
- Pre‑existing starter flake: `tests/lib/proxy-session.test.ts` fails only
  when run together with the DB suite (`RUN_DB_TESTS=true`).
