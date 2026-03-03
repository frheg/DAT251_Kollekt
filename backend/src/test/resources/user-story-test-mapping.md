# User Story → Test Traceability (Backend)

This file documents how the **initial user stories (Section 3.2)** are covered by backend unit tests.

Legend:
- **Covered**: Implemented in backend and has at least one unit test.
- **Partially covered**: Some aspects implemented/tested; other parts are not implemented.
- **Not implemented**: No backend feature exists yet (so no meaningful unit test exists).

## 3.2.1 Task Management and Responsibility

1) *"See a clear overview of all shared tasks and who is responsible"*
- Status: **Covered**
- Backend: `KollektService.getTasks(memberName)` returns task list including `title`, `assignee`, `dueDate`, `completed`.
- Tests:
  - `com.kollekt.service.KollektServiceTest` → `getTasks sorts by dueDate`

2) *"Tasks rotate automatically over time"*
- Status: **Not implemented**
- Note: No rotation/scheduling logic exists in `KollektService`.

3) *"Mark tasks as completed so contribution is visible"*
- Status: **Covered**
- Backend: `KollektService.toggleTask(taskId)` flips `completed`.
- Tests:
  - `KollektServiceTest` → `toggleTask flips completed, clears caches, and publishes event`
  - `KollektServiceTest` → `toggleTask throws when task not found`

4) *"See when tasks have been left undone"*
- Status: **Covered**
- Backend: `getDashboard(memberName)` exposes `upcomingTasks` (filters `!completed`).
- Tests:
  - `KollektServiceTest` → `getDashboard returns cached value when present`
  - `KollektServiceTest` → `getDashboard falls back to first member if name not found`
  - `KollektServiceTest` → `getDashboard aggregates upcoming tasks and events and recent expenses`

## 3.2.2 Reminders and Notifications

1) *"Receive reminders when responsible for a task"*
- Status: **Not implemented**

2) *"Be notified when tasks remain incomplete"*
- Status: **Not implemented**

3) *"Receive notifications about changes to routines/shared plans"*
- Status: **Not implemented**

Note: The backend publishes integration events via `IntegrationEventPublisher` (Kafka), but there is no implemented user-facing reminder/notification scheduling feature.

## 3.2.3 Planning and Coordination

1) *"View a shared calendar of house-related events"*
- Status: **Covered**
- Backend: `KollektService.getEvents(memberName)` returns events.
- Tests:
  - `KollektServiceTest` → `getEvents sorts by date`

2) *"Add events to a shared timeline"*
- Status: **Covered**
- Backend: `KollektService.createEvent(...)` saves an event.
- Tests:
  - `KollektServiceTest` → `createEvent clears dashboard cache and publishes chat event`

3) *"See upcoming tasks and events in one place"*
- Status: **Covered**
- Backend: `KollektService.getDashboard(memberName)` returns upcoming tasks + upcoming events.
- Tests:
  - `KollektServiceTest` → `getDashboard returns cached value when present`
  - `KollektServiceTest` → `getDashboard falls back to first member if name not found`
  - `KollektServiceTest` → `getDashboard aggregates upcoming tasks and events and recent expenses`

## 3.2.4 Decision-Making and Communication

1) *"Participate in simple votes on shared decisions"*
- Status: **Not implemented**

2) *"Distinguish important announcements from casual messages"*
- Status: **Not implemented**

3) *"Dedicated space for discussing shared issues"*
- Status: **Partially covered**
- Backend: `KollektService.createMessage/getMessages` supports a shared message stream.
- Tests:
  - `KollektServiceTest` → `createMessage saves and publishes chat event`
  - `KollektServiceTest` → `getMessages sorts by timestamp`

## 3.2.5 Shared Resources and Economy

1) *"Track shared purchases so costs are distributed fairly"*
- Status: **Covered**
- Backend: `createExpense/getExpenses/getBalances`.
- Tests:
  - `KollektServiceTest` → `createExpense clears caches and publishes economy event`
  - `KollektServiceTest` → `getExpenses sorts by date descending`
  - `KollektServiceTest` → `getBalances computes per member amounts`

2) *"See what shared resources are running low"*
- Status: **Partially covered**
- Backend: Shopping list exists (`getShoppingItems/createShoppingItem/toggleShoppingItem/deleteShoppingItem`) but no explicit "low" threshold logic.
- Tests:
  - `KollektServiceTest` → `getShoppingItems maps all items`
  - `KollektServiceTest` → `shopping item create publishes task event`
  - `KollektServiceTest` → `shopping item toggle flips completed and publishes`
  - `KollektServiceTest` → `shopping item delete deletes and publishes`

3) *"Log when I paid for shared items"*
- Status: **Covered**
- Backend: `Expense.paidBy` is stored and used in balances.
- Tests:
  - `KollektServiceTest` → `createExpense clears caches and publishes economy event`
  - `KollektServiceTest` → `getBalances computes per member amounts`

## 3.2.6 Gamification

1) *"Earn points/recognition for completing tasks"*
- Status: **Partially covered**
- Backend: Leaderboard + achievements exist, but XP updates on task completion are not implemented in `toggleTask`.
- Tests:
  - `KollektServiceTest` → `getLeaderboard computes ranks, badges, and caches`
  - `KollektServiceTest` → `getAchievements maps all achievements`

2) *"See contribution compared to the group in a non-punitive way"*
- Status: **Covered**
- Backend: `getLeaderboard` returns ranks, stats, streak, badges.
- Tests:
  - `KollektServiceTest` → `getLeaderboard computes ranks, badges, and caches`

3) *"Collective goals/streaks"*
- Status: **Partially covered**
- Backend: `streak` is computed for leaderboard; pant has a `goalAmount` in `getPantSummary(goal)`.
- Tests:
  - `KollektServiceTest` → `getLeaderboard computes ranks, badges, and caches`
  - `KollektServiceTest` → `getPantSummary sums entries`

## Integration-event publishing (supporting automated updates)

Even where user-facing notifications are not implemented, the backend emits events which can be used by the frontend for real-time updates.
- Tests:
  - `com.kollekt.service.IntegrationEventPublisherTest`
  - `KollektServiceTest` (verifies `taskEvent/chatEvent/economyEvent` calls)
