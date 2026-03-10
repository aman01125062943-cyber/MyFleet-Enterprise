---
description: "Task list for Project Analytics implementation"
---

# Tasks: Project Analytics

**Input**: Design documents from `/specs/001-analyze-project/`
**Prerequisites**: plan.md (required), spec.md (required)

## Phase 1: Setup

- [x] T001 Install `recharts` library for data visualization

## Phase 2: User Story 1 - System Overview Dashboard (Priority: P1)

**Goal**: Display high-level metrics (Total Orgs, Users, Subscriptions) to the Super Admin.
**Independent Test**: Verify numbers match database counts.

### Implementation

- [x] T002 [US1] Create `lib/analytics.ts` service with `fetchSystemStats` function
- [x] T003 [US1] Create `components/AnalyticsDashboard.tsx` with basic layout
- [x] T004 [US1] Implement "Stat Cards" in `AnalyticsDashboard` using data from `lib/analytics.ts`
- [x] T005 [US1] Integrate `AnalyticsDashboard` as a new "Analytics" tab in `SuperAdminDashboard.tsx`

**Checkpoint**: Admin can see the Analytics tab and view accurate total counts.

## Phase 3: User Story 2 - User Growth Trends (Priority: P2)

**Goal**: Visualise growth trends over time.

### Implementation

- [x] T006 [US2] Update `lib/analytics.ts` to include `fetchGrowthData` (aggregating users/orgs by created_at)
- [x] T007 [US2] Implement `GrowthChart` component in `AnalyticsDashboard` using `recharts`
- [x] T008 [US2] Add loading states and error handling for chart data

**Checkpoint**: Admin can see a line chart showing growth trends.

## Phase 4: Polish

- [x] T009 Ensure responsive design for mobile views
- [x] T010 Verify "Refresh" behavior (auto-refresh or button)
