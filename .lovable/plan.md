
# Workforce & Project Management — Build Plan

A mobile-first responsive web app for civil/interior contractors to manage workers, attendance, wages, projects, and monthly reports. Single contractor (admin) per account, secured with email/password login.

## Design

- Black & white foundation, deep blue accent (e.g. `oklch(0.45 0.18 260)`).
- Clean, minimal, high contrast — Notion/Linear/Stripe inspired.
- Subtle glassmorphism only on bottom nav, dashboard cards, and modals.
- Large touch targets (min 44px), mobile-first layout, persistent bottom nav.
- Inter/system font stack, generous spacing, rounded-xl cards.

## App Structure (TanStack Start routes)

```
/auth                    Login / sign up
/_authenticated/
  index                  Dashboard
  attendance             Today's attendance roster (one-tap marking)
  workers                Worker list + add/edit
  workers/$id            Worker profile + wage + attendance history
  projects               Project list + add
  projects/$id           Project detail + progress + assigned workers
  reports                Monthly Excel export with filters
```

Bottom nav (mobile): Dashboard · Attendance · Workers · Projects · Reports.

## Data Model (Lovable Cloud / Supabase)

All tables RLS-scoped to `auth.uid()` via owner_id. Grants per Lovable rules.

- `workers` — id, owner_id, full_name, mobile, address, worker_type, joining_date, daily_wage, status
- `attendance` — id, owner_id, worker_id, date, type (absent/half/full/overtime), project_id?
- `payments` — id, owner_id, worker_id, amount, paid_on, note
- `projects` — id, owner_id, name, client, location, start_date, expected_end, contract_value, status, progress_pct
- `project_workers` — project_id, worker_id (assignment)
- `project_updates` — id, project_id, note, created_at (daily notes/milestones)

Wage logic (computed in server fns):
- absent = 0, half = 0.5×daily, full = 1×daily, overtime = 1×daily + OT bonus (configurable, default 0.33×daily for the extra 3h).

## Features

1. **Auth** — email/password via Lovable Cloud. `/auth` page with sign in/up tabs. Protected subtree under `_authenticated/`.
2. **Dashboard** — KPI cards (Active Workers, Present Today, Absent Today, Overtime Today, Active Projects, Pending Wages, Month Labour Cost), Quick Actions, Recent Activity feed.
3. **Workers** — list (search + filter active/inactive), add/edit modal, profile page with attendance history & monthly summary, wage dashboard, payment records.
4. **Attendance** — date picker (defaults today), full worker roster with one-tap chips (Absent / Half / Full / OT). Bulk save.
5. **Wages** — auto-calculated per worker per month; "Record payment" modal; payment history; pending balance.
6. **Projects** — list with status pills, detail page with progress slider, daily notes timeline, milestone log, worker assignment picker.
7. **Reports** — Filters (month, project, worker). One-click XLSX download generated server-side with `xlsx` package via `createServerFn`.

## Technical

- Stack: TanStack Start (already set up), Tailwind v4, shadcn/ui components, Lovable Cloud (Supabase) for DB/Auth.
- All DB access through `createServerFn` with `requireSupabaseAuth` middleware — RLS enforced as the user.
- TanStack Query for fetching (loader prime + `useSuspenseQuery`).
- XLSX export via `xlsx` (SheetJS) inside a server fn returning a base64 buffer the client downloads as a Blob.
- Date utils via `date-fns`.
- Forms via `react-hook-form` + `zod`.
- Design tokens in `src/styles.css` (deep blue accent, glass surface tokens).

## Build Order

1. Enable Lovable Cloud + email/password auth, build `/auth` page and protected layout.
2. Create DB schema + RLS + grants migration.
3. Design system tokens, app shell with bottom nav.
4. Workers CRUD.
5. Attendance marking flow.
6. Wages calculation + payments.
7. Projects + progress + assignment.
8. Dashboard KPIs + activity feed.
9. Reports + XLSX export.

After step 1 you'll be able to log in; each subsequent step ships a usable feature.
