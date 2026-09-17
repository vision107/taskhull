# Taskhull — Build Plan

Taskhull is a task management tool for series production: planners plan each
unit as a project with tasks on the web, save a good plan as a template and reuse
it for the next unit, assign the resulting tasks to workers, and workers complete
them from a phone‑first PWA.

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

- **Project** — one manufactured unit, with a serial number. Starts blank or from
  a template; when linked to a template it is pinned to a specific version.
  (Code and tables still say `build`; the UI says project.)
- **Template** — a reusable task plan for one unit. Stable identity. Usually
  created by saving a project as a template; can also be built by hand.
- **Template version** — an immutable, numbered snapshot of a template's tasks.
  Editing happens on a _draft_; publishing freezes it. "Update template from
  project" publishes a new version directly.
- **Project task** (`build_task`) — a task on a project, copied from a template
  task or added ad hoc. Has assignees, checklist, comments, attachments, status.
- **Product** — legacy grouping (table + router kept, no UI). Projects are
  grouped by template now.
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

- `product` (org, name, description, templateId) — legacy, unused by the UI
- `build` (org, productId?, templateVersionId?, serialNumber — unique per org,
  name, status planned|active|blocked|completed|archived, plannedStartDate,
  plannedEndDate, actualStartedAt, actualCompletedAt)
- `build_task` (buildId, sourceTemplateTaskId, title, instructions, phase,
  sortOrder, plannedDurationDays, startDate, endDate, status
  todo|in_progress|blocked|review|done, requiresPhoto, requiresComment,
  actualStartedAt, actualCompletedAt)
- `build_task_assignment` (buildTaskId, userId, role owner|helper|reviewer)
- `build_task_dependency`
- `build_task_checklist_item` (buildTaskId, title, sortOrder, status
  open|done|skipped, completedById, completedAt)
- `build_task_comment` (buildTaskId, authorId, body)
- `build_task_attachment` (buildTaskId, kind document|photo, templateDocumentId?,
  uploadedById, storageKey, fileName, ...)
- `build_task_activity` (org, buildId, buildTaskId, actorId, action, metadata)
- `revision` — generic before/after audit snapshots for template and build changes

### Versioning rules

1. A template always has at most one `draft` version. Edits go to the draft.
2. **Publish** marks the draft `published`, stamps `publishedAt`, and it becomes
   immutable. Creating a build defaults to the latest published version.
3. Editing a template with no draft creates a new draft as a deep copy of the
   latest published version (tasks, checklist, dependencies, documents).
4. Projects pin `templateVersionId`; publishing a new version never changes
   existing projects.
5. "Upgrade project to version N" merges the diff by task lineage, keeping work
   already done.
6. Project → template: **Save as template** turns an unlinked project into a new
   template with a published v1 and links the project to it. **Update template
   from project** compares a linked project with the template's latest version
   (by lineage), publishes the result as the next version (refused while a
   draft is open) and re‑points the project. `lib/manufacturing/promote.ts`.

### Cross‑build assignment

The same unit is built several times a month; every project from the template
gets the same task set. Planners select the same task across multiple projects
(e.g. all open "Wire control cabinet" tasks) on the template's _Assignments_ tab
and assign them to one worker in one action. This is plain multi‑assignment — no
batch entity. The worker just sees N items in their list, each labeled with
template name and serial number.

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
  (`/organization/products`), builds list/detail (`/organization/builds`) —
  superseded by Phase 7 (projects at `/organization/projects`, no product UI).
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
     (Folded into `/dashboard` itself in Phase 9.)
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

- **Phase 7 — Projects first** ✅ Rethink after using the app: the
  template → product → build chain forced planners to design a template before
  they could plan a single unit. Now the flow matches ordinary project tools.
  1. _Projects._ `/organization/projects` replaces `/builds` and `/products`
     in the UI. "New project" starts **blank** (add tasks by hand) or **from a
     template** (latest published version by default, older selectable).
     `build.product_id` is nullable, serial numbers are unique per
     organization, `createBuildFromVersion` accepts `templateId` or
     `templateVersionId` (migration `projects_first`).
  2. _Save as template._ Project menu → "Save as template…" creates a template
     with a published v1 from the project's tasks (title, instructions, phase,
     order, duration, flags, checklist, dependencies, documents) and links the
     project + its tasks to it. Progress, comments and photos stay on the
     project.
  3. _Update template from project._ For linked projects the same menu shows
     "Update <template> from this project…" with a preview diff (added /
     changed with fields / removed, vs. the latest published version, matched
     by task lineage). Publishing writes the next version, keeps lineage so
     other projects can upgrade, and re‑points this project. Refused while the
     template has an open draft or when nothing changed.
     `build.templateDiff`, `build.saveAsTemplate`, `build.updateTemplate`.
  4. _Templates._ Template page gained tabs: **Task plan** (versions + editor,
     unchanged), **Projects** (list) and **Assignments across projects** (the
     grid, now keyed by `templateId` instead of product). "New project" button
     on the template.
  5. _Documents on project tasks._ `build_task_attachment.kind`
     (`document|photo`) replaces the implicit "has templateDocumentId" split.
     Planners attach documents (drawings, PDFs) from the task sheet
     (`build.taskDocumentUploadUrl` / `addTaskDocument` / `removeTaskDocument`);
     they travel into templates on save/update. Photo requirement counts
     `kind = photo` only.
  6. _Worker labels_ show template name · serial (or the project label for
     ad‑hoc projects). Activity timeline knows `build.saved_as_template` and
     `build.pushed_to_template`.

- **Phase 8a — Faster planning** ✅ Small things that got in the way while
  typing up a plan.
  1. _Quick add._ Every phase group on the project page and in the template
     draft editor ends with a "type a title, press Enter" row
     (`QuickAddTask`). Only the title (and the phase it was typed into) is
     sent; duration defaults to 1 day, everything else is added later via
     Edit. Focus stays in the row so a whole plan can be typed in one go.
     New tasks are inserted **after the last task of the same phase**
     (`nextSortOrderForPhase`) instead of the end of the list, so the grouped
     list never shows a phase twice. Empty projects/drafts show the same row
     plus an "Add with details" button.
  2. _Effort in hours._ `planned_hours` (nullable real) on `template_task` and
     `build_task`, next to the calendar duration in days. Travels through
     create‑from‑template, upgrades, save‑as / update‑template (and shows up
     in the diff as `hours`). Lists render `2d · 4h`, the template header
     sums effort, the worker task view shows it next to the date.
  3. _Edit dialog layout._ Phase | Start and Duration (days) | Effort (hours)
     in a 2×2 grid; the date picker truncates its label (`dateFormat="PP"`)
     instead of spilling into the next field.
  4. _Checklist on project tasks._ Checklist items used to come only from a
     template, so hand‑made tasks could never get one. The task sheet now
     always shows the Checklist section for planners with a
     "type + Enter" row (`build.addChecklistItem`) and a remove button per
     item (`build.removeChecklistItem`). Items typed on a project task travel
     into the template on save‑as / update‑template like everything else.
  5. _Subtasks (Asana‑style)._ `parent_task_id` (self reference, cascade
     delete, one level deep) on `template_task` and `build_task`. A subtask is
     a full task: own status, assignees, dates, hours, checklist, comments,
     photos and dependencies — a worker sees it in _My tasks_ as
     "Parent › Subtask" and works it like any other. Rules: a subtask inherits
     the parent's phase (and follows it when the parent's phase changes);
     `sortOrder` is per sibling group; a parent **is not** finished
     automatically — it is confirmed by hand, but `work.updateStatus` refuses
     `done` while a subtask is open ("Finish all subtasks first."); deleting a
     parent is refused when a subtask has been started. Planner UI: project
     page and draft editor render subtasks indented under a collapsible
     parent row with an `n/m` count, a hover "Add subtask" button and an
     "Add a subtask and press Enter" row; the task sheet has a "Subtasks n/m"
     section with quick add and a parent breadcrumb. Worker UI: parent link
     above the title, a "Subtasks" card with progress, "Mark done" disabled
     with a hint until every subtask is done. Structure travels through
     create‑from‑template, draft copies, upgrades and save‑as /
     update‑template (diff field `parent`); the assignment grid labels
     subtask rows "Parent › Subtask" and sorts them behind the parent.
  6. _Task pane edits in place (Asana layout)._ Clicking a task row opens the
     sheet and everything on it is editable without an Edit dialog:
     toolbar with **Mark complete** (disabled with a tooltip while a
     dependency or subtask is open) + status menu + overflow (Delete); big
     inline title; field rows Assignee · Due date · Start date · Duration
     (days · hours) · Phase (datalist of the project's phases) · Depends on
     (chips + checkbox popover) · Requires (photo/comment switches); an inline
     Description textarea; Subtasks `n/m`, Checklist, Attachments (planner
     documents and floor photos in one list); a **Comments | All activity**
     toggle above the pinned reply box. Text fields save on blur/Enter and
     revert on Escape, all through `build.updateTask`. Dates: the model stays
     start + duration, but the pane leads with the **due date** like Asana
     and shows the start date second so a planner picks whichever they
     think in — changing the due date keeps the start and resizes the
     duration (a due date before the start moves the task there as a
     one‑day task), changing the start date keeps the duration and shifts
     the task. `DatePicker` now closes on pick. `BuildTaskModal` remains only
     for "Add with details".

- **Phase 8b — My tasks in the web view** (proposal, not started)
  Today `/dashboard/work` is the phone layout stretched to a 32rem column;
  on a desktop it wastes the screen and every task is a round trip. Goals:
  a planner or a worker at a workstation PC should be able to work a day's
  list without leaving the page, and the phone PWA must not change.
  1. _Two‑pane layout ≥ `lg`._ Same route. Left: the task list (as now, but
     denser rows). Right: the task detail (`WorkTaskDetail`) for the selected
     task, driven by `?task=<id>` so links from notifications/e‑mails still
     open the right task and the phone keeps navigating to
     `/work/tasks/[id]`. Below `lg` nothing changes. The work layout widens
     `max-w-lg` → `max-w-6xl` only when the two‑pane mode is active.
  2. _Grouping and filters._ Segmented control **Ready · Waiting · Done** plus
     chips for project (serial), phase and "due": _Overdue_, _Today_, _This
     week_, _Later_. State in the URL (`?status=&project=&phase=&due=`) so a
     filtered view can be bookmarked. Server: `work.myTasks` gains optional
     `projectId`, `phase`, `dueBefore/After` and returns `plannedHours` and
     `endDate` so the list can show "due Thu · 4h left".
  3. _Sort and density._ Sort by start date (default), project, phase or
     effort. A compact table mode on desktop (one line per task: status dot,
     title, project, phase, dates, effort, blockers) with the same row
     component underneath so phone and desktop stay in sync.
  4. _Act from the list._ Status change directly on the row (To do → In
     progress → Done; Blocked opens the reason sheet), checklist ticks in the
     right pane, comment box in the right pane. Everything reuses the
     existing `work.*` mutations and the offline queue, so nothing is
     duplicated.
  5. _Keyboard._ `j`/`k` move selection, `Enter` opens, `s` cycles status,
     `c` focuses the comment box, `/` focuses the filter. Cheap to add once
     selection lives in the URL.
  6. _Today at a glance._ Header line: "5 ready · 2 waiting · 14h planned
     today" computed client‑side from the list. Overdue tasks get the amber
     date colour already used on the phone.
  7. _For planners only._ A "Team" toggle on the same page that switches
     `work.myTasks` → a new `work.teamTasks` (planner‑only, same shape, plus
     assignee) so a planner can see everyone's list grouped by worker and
     re‑assign from the row (`build.assign/unassign`). This is the first step
     towards a workload view; the assignment grid stays per template.
  8. _Not in this phase:_ drag‑and‑drop re‑scheduling, time tracking against
     `plannedHours`, a calendar view.

  Order of work: 1 → 2 → 4 (this is the useful core), then 3, 6, 5, 7.
  Tests: extend `organization-manufacturing.test.ts` for the new `myTasks`
  filters and `teamTasks` permissions; a Playwright smoke for the two‑pane
  route with `?task=`.

- **Phase 9 — No personal area** ✅ People reach the app through their
  employer, so the starter's "Personal" account space (own sidebar with
  Home / Profile / Security / Sessions, organizations grid as home page) only
  made the sidebar change shape when switching. Removed:
  - `/dashboard` is now the landing resolver (the former `/dashboard/start`):
    active organization → planner dashboard or worker list, single
    membership → activate it, worker everywhere → `/work`, otherwise a
    sidebar‑less organization picker (also the empty state for users without
    any organization, with sign‑out). `authConfig.redirectAfterSignIn` is
    `/dashboard` again.
  - One sidebar. `app/(saas)/dashboard/(sidebar)/(workspace)/layout.tsx`
    (the former organization layout) now wraps both `/organization/*` and the
    account settings at `/dashboard/settings`, so the navigation never
    changes; account settings are reached from the user menu (⇧⌘P) and the
    command menu. The switcher lists organizations (and the admin panel for
    platform admins) only; breadcrumbs drop the "Home" crumb.
  - _Private to‑dos live inside the organization._ What people still want
    from a personal space is a scratch list; that is now the "My notes"
    section at the bottom of My tasks (`/dashboard/work`, phone and desktop).
    Table `private_task` scoped to `(organization_id, user_id)` with title,
    notes, due date, done flag and an optional link to a `build_task`
    (`ON DELETE SET NULL`). Router `organization.privateTask.{list, create,
update, delete}` — every query filters by org **and** caller, so owners
    cannot read a member's list; a linked task must belong to the same
    organization. The list dies with the membership: `afterRemoveMember`
    (also fired when someone leaves) deletes the rows. Quick add, tick off
    and delete work offline through the write queue (`createPrivateTask`,
    `updatePrivateTask`, `deletePrivateTask`; offline creates show as
    read‑only "waiting to sync" rows); editing a note in the bottom sheet
    needs a connection. Tests: `tests/trpc/routers/organization-private-task.test.ts`.

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

- Bulk "upgrade all open projects of this template" (currently per project).
- Drop the legacy `product` table/router once nothing references it (tests
  still exercise `organization.product`).
- Template documents and project documents share storage keys by reference;
  deleting one side never removes the object.
- Pre‑existing starter flake: `tests/lib/proxy-session.test.ts` fails only
  when run together with the DB suite (`RUN_DB_TESTS=true`).
- Dev server (Next 16 / Turbopack): server‑side tRPC changes are sometimes
  not hot‑reloaded — a new procedure answers 404, a changed zod schema keeps
  stripping the new field — while the client bundle updates fine. Restart
  `npm run dev` when a mutation "does nothing" after a router/schema edit.
