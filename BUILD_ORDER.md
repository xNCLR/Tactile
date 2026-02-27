# Tactile — Build Order (MVP → Deployment)

Ordered by dependency chain. Each item assumes everything above it is done.

---

## Phase 1: Foundation

These touch everything downstream. No point building features on shaky plumbing.

### 1. Database migration (sql.js → better-sqlite3)
**Why first:** sql.js is in-memory, crashes lose data, no concurrent writes, no indexes. Every query, every new table, every feature depends on a real database. Migrating to better-sqlite3 (synchronous, file-backed, WAL mode, proper indexes) is the least disruptive path — same SQL dialect, no Postgres setup needed yet. Postgres migration can happen at deployment time.
**Touches:** `server/db/schema.js`, all route files (async → sync), seed.js
**Adds:** Indexes on all foreign keys, email, booking_date, created_at

### 2. Environment validation + secret management
**Why here:** Before hardening security, ensure the app actually fails loudly when config is wrong instead of silently running with defaults.
**Touches:** New `server/config.js`, removes hardcoded JWT fallback, validates all env vars on startup
**Adds:** Startup crash on missing STRIPE_SECRET_KEY, JWT_SECRET, etc.

### 3. Input validation (zod)
**Why here:** Every route after this benefits. Retrofitting validation later means touching everything twice.
**Touches:** All route files get request schema validation
**Adds:** Max lengths on strings, format checks on email/postcode, numeric bounds on lat/lng/radius/price

### 4. Security hardening
**Why here:** Before adding more endpoints and attack surface.
**Touches:** `server/index.js` (middleware), `server/middleware/auth.js`
**Adds:** helmet (security headers), express-rate-limit (login/register: 5/min, API: 100/min), CORS tightening

### 5. JWT → httpOnly cookies + token refresh
**Why here:** Auth is touched by every protected route and the notification system later. Fix the foundation.
**Touches:** Auth routes, middleware, client AuthContext, API client
**Adds:** httpOnly secure cookie, /auth/refresh endpoint, token rotation on refresh, logout revocation

### 6. Structured logging
**Why here:** Before adding complex features, need the ability to debug them.
**Touches:** `server/index.js`, all route files (replace console.log/error)
**Adds:** pino with request IDs, log levels, request/response logging middleware

### 7. Error boundary + 404 page
**Why here:** Quick win, client stability. 30 lines total.
**Touches:** New `ErrorBoundary.jsx`, `NotFound.jsx`, App.jsx (catch-all route)

### 8. Self-booking prevention
**Why here:** 2-line fix, should've been there from day one.
**Touches:** `server/routes/teachers.js` (search excludes current user)

---

## Phase 2: Core Flow Improvements

These change the fundamental booking lifecycle. Must be done before building UI polish on top.

### 9. Photography categories/tags
**Why here:** Schema change that affects search, teacher profiles, and discovery. Adding it after building calendar view etc. means retrofitting.
**Touches:** New `categories` table, `teacher_categories` junction table, teacher profile routes, EditProfile, Search (filter by category), TeacherCard, TeacherProfile
**Adds:** Portrait, Street, Landscape, Product, Fashion, Wedding, Wildlife, Macro, Architectural, etc.

### 10. Teacher booking acceptance step
**Why here:** Fundamentally changes the booking state machine. Currently: payment → confirmed. New: payment → awaiting_teacher → confirmed/declined. Everything downstream (cancellation, calendar, notifications) depends on this state machine being finalized.
**Touches:** Booking routes (new states), Dashboard (accept/decline UI for teachers), booking confirmation flow, email notifications
**New states:** `pending` → `awaiting_teacher` → `confirmed` / `declined` → `completed` / `cancelled`

### 11. Cancellation policy (tiered)
**Why here:** Depends on booking states being finalized. Affects payment flow and dispute resolution.
**Touches:** Booking cancel route, new `cancellation_policies` logic, teacher profile (custom policy option), booking UI
**Adds:** Free cancellation >24h, 50% refund 2-24h, no refund <2h (configurable per teacher)

### 12. Stripe webhooks
**Why here:** Depends on booking states and cancellation policy being defined. The webhook handler needs to know every possible state transition.
**Touches:** New webhook endpoint, booking routes, stripe service
**Adds:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`, idempotency keys

### 13. Pre-booking inquiry messaging
**Why here:** Currently messages are booking-scoped. Students need to ask questions before committing money. Depends on knowing whether teachers accept bookings (they do, per step 10).
**Touches:** Messages schema (optional booking_id), message routes, TeacherProfile (inquiry button), Messages page
**Adds:** Direct messages to teachers without a booking, conversation → booking flow

---

## Phase 3: Engagement & UX

Booking flow is now solid. These make the experience good.

### 14. In-app notifications
**Why here:** Depends on ALL events existing (bookings, acceptance, messages, reviews, disputes). Building it earlier means adding notification triggers piecemeal.
**Touches:** New `notifications` table, notification routes, Layout (bell icon + unread count), new NotificationsPanel
**Events:** New booking, booking accepted/declined, new message, new review, dispute raised, dispute resolved
**Polling or SSE:** Start with polling (30s), upgrade to SSE later

### 15. Calendar/availability view
**Why here:** Depends on booking acceptance being in place. The calendar needs to show pending-acceptance vs confirmed slots.
**Touches:** New CalendarView component, TeacherProfile (replaces time slot list), BookingModal (date picker with availability)
**Adds:** Week view for teachers, date-slot picker for students, visual availability

### 16. Location negotiation
**Why here:** Part of the booking/messaging flow. Depends on pre-booking messaging being in place.
**Touches:** Booking schema (meeting_point field), messaging (location sharing), BookingModal
**Adds:** Suggested meeting point from teacher, student can propose alternative, agreed location shown in booking

### 17. Email improvements
**Why here:** All the events worth emailing about now exist.
**Touches:** `server/services/email.js`, new email templates
**Adds:** Dispute raised notification, review received notification, booking acceptance notification, inquiry received notification, async email queue with retry

### 18. Teacher earnings dashboard
**Why here:** Depends on booking/payment flow being finalized (cancellation tiers, refund logic, acceptance).
**Touches:** New earnings route, Dashboard (teacher earnings section)
**Adds:** This month's earnings, total earned, pending payouts, per-booking breakdown

---

## Phase 4: Growth Features

Platform works well. These make it grow.

### 19. Recurring bookings
**Why here:** Depends on calendar view and booking acceptance flow.
**Touches:** Booking routes (recurring flag), calendar UI (repeat option), payment flow (multi-session)
**Adds:** "Book weekly" option, series management, cancel-one vs cancel-all

### 20. Teacher verification
**Why here:** Independent but better after categories exist (verify expertise in specific areas).
**Touches:** New `verification_status` on teacher_profiles, admin review flow (or portfolio link check), TeacherCard/Profile (verified badge)
**Adds:** Submitted → pending → verified pipeline, "Verified" badge on profiles

### 21. SEO
**Why here:** Before public launch but after features stabilize (page structure won't change).
**Touches:** index.html, new meta component per route, robots.txt, sitemap generation
**Adds:** Dynamic title/description per page, Open Graph tags, JSON-LD structured data, canonical URLs

---

## Phase 5: Ship It

### 22. Tests
**Why here:** Should be written alongside features (and some will be), but a dedicated coverage pass before deployment catches gaps.
**Adds:** API route tests (supertest), auth flow tests, booking lifecycle tests, critical path integration tests
**Target:** Not 100% coverage. Cover: registration, login, search, book, pay, review, cancel, dispute.

### 23. Deployment infrastructure
**Why here:** Last. Everything above is done and tested.
**Touches:** New Dockerfile, docker-compose, GitHub Actions CI/CD, hosting config
**Stack:** Vercel (frontend) + Railway (backend) + managed Postgres (if migrated from better-sqlite3)
**Adds:** Auto-deploy on push, lint + test in CI, environment-specific configs, health check monitoring

---

## Summary

| Phase | Items | What it achieves |
|-------|-------|-----------------|
| 1. Foundation (1-8) | Database, validation, security, auth, logging, errors | App won't fall over or get hacked |
| 2. Core Flow (9-13) | Categories, acceptance, cancellation, webhooks, inquiries | Booking lifecycle is production-real |
| 3. Engagement (14-18) | Notifications, calendar, location, emails, earnings | Users actually want to come back |
| 4. Growth (19-21) | Recurring, verification, SEO | Platform scales and is discoverable |
| 5. Ship (22-23) | Tests, deployment | It's live |
