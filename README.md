# Support Agent Mobile App 🎧

A resilient, offline-first React Native (Expo) mobile application designed for customer support agents managing urgent tickets on the move (in lifts, subways, and places with weak or no internet connection).

Built with **Expo SDK 57**, **Redux Toolkit**, **AsyncStorage**, and **Expo Router**.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the App (Expo Go / Emulator)
```bash
npx expo start
```
- **Android Emulator**: Press `a` in the terminal or run `npm run android`
- **Physical Phone (Expo Go)**: Scan the QR code using the Expo Go app (on Android) or Camera (on iOS).

### 3. Run the Automated Test Suites
```bash
npm test
```
Runs 25 automated tests across 4 test suites:
1. `__tests__/sla.test.ts`: SLA deadline calculations, countdown tickers, P0–P3 SLAs, edge cases (future dates, non-standard dates, P5 priority fallback).
2. `__tests__/sanitizer.test.ts`: XSS prevention, HTML body sanitization, blocking dangerous `javascript:` and arbitrary `intent:` schemes.
3. `__tests__/apiRules.test.ts`: Server-side policy checks (enterprise minimum P1 rule, allowed status transition state machine, 409 claim conflict).
4. `__tests__/offlineSync.test.ts`: Offline outbox queueing, sequential synchronization, and optimistic rollback when the server returns 409 conflict ("The server is always right").

### 4. Run Lint & Typecheck
```bash
npm run lint
npx tsc --noEmit
```

---

## 📱 Features & Highlights

### 1. Offline-First Resilience Engine
- **Persistent Outbox Queue**: Claims and status changes made while offline are saved immediately to `AsyncStorage`.
- **Automatic Sync**: Flushes mutations sequentially when connection returns.
- **Conflict Rollback ("The Server Is Always Right")**: If a claim conflicts on the server (409) or violates policy (400), the app rolls back optimistic UI state and notifies the agent via a toast.
- **Top Offline Banner**: Shows clear offline status and the exact count of pending changes waiting to sync.

### 2. High-Performance SLA Live Countdown
- Each ticket displays an isolated live countdown updating every second (`CountdownBadge`).
- **Decoupled from list re-renders**: Utilizes `React.memo` and leaf timer subscriptions to ensure 60fps smooth scrolling with 5,000+ tickets even on budget 360px Android devices.
- Dynamic color coding:
  - 🟢 **On Track** (>20% time left)
  - 🟠 **At Risk** (<20% time left)
  - 🔴 **Late** (overdue)
  - 🔵 **Future / Scheduled**

### 3. Security & Anti-XSS Sanitization
- Handles all tricky test tickets (`T-2001` through `T-2012`).
- Renders customer HTML safely (`<b>`, `<i>`, links) while stripping malicious `<script>` tags and `onerror` handlers (`T-2002`, `T-2011`).
- URL scheme whitelisting strictly blocks `javascript:alert(document.cookie)` (`T-2003`) and dangerous arbitrary OS `intent:` schemes (`T-2009`).

### 4. AI Triage Review Screen
- Dedicated tab for tickets flagged for human verification (`manual_review`).
- Agents can Accept AI's answer or modify category/priority with a written explanation (>= 10 characters).
- Enforces the **Enterprise Policy Rule**: Enterprise tickets can never be downgraded below P1.
- `KeyboardAvoidingView` ensures input fields are never covered while typing.

### 5. Evaluation Simulation Controls (Settings Tab)
Easily test all required scenarios for your screen recording:
- Toggle 10% server error simulation.
- Toggle 25% claim conflict (409) simulation.
- Toggle 5–10s background activity simulation.
- One-tap button to reset and re-seed the 5,000 mock tickets database.

---

## 📋 Evaluation Screen Recording Guide (3–5 Minutes)

When recording your video walk-through, you can follow this structured flow:
1. **Sign In**: Select an agent (e.g. Priya `agent-1`), enter PIN `1234`, and sign in.
2. **Ticket List & Virtualization**:
   - Scroll through the 5,000 tickets to demonstrate 60fps smooth scrolling.
   - Observe live 1-second countdown badges (`On Track`, `At Risk`, `Late`).
   - Use the filter bar to filter by Status, Priority, Search Query, and "My tickets".
3. **Successful Claim**:
   - Open an unassigned open ticket and tap **Claim This Ticket**.
   - Notice the instant optimistic update to "in_progress" assigned to Priya.
4. **Failing Claim (409 Conflict)**:
   - Attempt to claim a ticket that is already claimed by someone else or triggers the simulated 409 conflict.
   - Notice the optimistic rollback and the clear error toast explaining what happened.
5. **Airplane Mode / Offline Workflow**:
   - Enable Airplane Mode (or toggle offline).
   - Observe the red top banner: *"Offline • 0 changes waiting to sync"*.
   - Claim a ticket or change status while offline.
   - Notice the banner updates to *"Offline • 1 change waiting to sync"* and the ticket card shows *"Syncing..."*.
   - Disable Airplane Mode (reconnect).
   - Notice the outbox flushes automatically, the banner clears, and a success toast confirms synchronization.
6. **AI Review**:
   - Navigate to the AI Review tab.
   - Accept a recommendation or change priority with a written explanation. Show that Enterprise tickets prevent downgrade to P2/P3.
7. **Sign Out**:
   - Navigate to Settings and tap **Sign Out & Clear Local Data**, proving session and cached data are wiped.

---

## 📖 Key Documentation
See [`DECISIONS.md`](./DECISIONS.md) for the complete engineering rationale, answers to all brief questions, edge-case breakdown, and architecture trade-offs.
