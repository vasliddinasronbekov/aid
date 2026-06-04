# Phase 2: Clinical CRM Workflows

Phase 2 turns the platform foundation into daily hospital workflow software. It is being delivered in production-sized slices so each part has durable backend state, audited APIs, and a corresponding CRM surface.

## Phase 2A Delivered

- Patient profile route with chart tabs.
- Appointment lifecycle: scheduled, checked in, in progress, completed, cancelled, no-show, rescheduled.
- Encounter lifecycle with signing.
- Patient vitals and allergy records.
- Patient chart payload combining appointments, encounters, vitals, allergies, and medical records.

## Phase 2B Delivered

- Care team memberships with active/primary assignment support.
- Clinical tasks with assignment, due dates, priorities, and start/complete/cancel actions.
- Referrals with accept/complete/cancel actions.
- Diagnostic orders with collect/result/cancel actions.
- Admissions with waitlist, admit, transfer, discharge, and cancel actions.
- Patient chart payload now includes care team, tasks, referrals, diagnostic orders, and admissions.
- CRM screens now expose admission queue actions, care coordination tasks, referral queues, and patient-level workflow tabs.

## Phase 2C Delivered

- Perinatal high-risk registry with gestational age, gravida/para, EDD, risk level, risk factors, next visit, closure, and outcome tracking.
- Patronage visits with offline client references, idempotency keys, server versioning, sync timestamps, conflict payloads, and conflict resolution actions.
- Master patient index duplicate-candidate review with match score, reasons, confirmation, dismissal, and merged markers.
- Patient chart payload now includes perinatal registry entries, patronage visits, and duplicate candidates.
- CRM screens now expose perinatal risk worklists, patronage offline sync/conflict handling, and MPI duplicate review from registry and patient profile surfaces.

## Product Boundary

Phase 2C finishes the core perinatal, patronage sync, and duplicate-review boundary. It does not yet implement full legal-record patient merge, device-level offline storage encryption, or automated FHIR import/export; those belong to later clinical safety and interoperability phases.

## Operational Notes

- All new clinical workflow objects are tenant-scoped.
- Patient-linked reads and writes are audited as PHI access.
- Status changes are modeled as explicit actions instead of ambiguous free-form updates.
- Patient location is synchronized when an admission is admitted or transferred, and the room is cleared when discharged.
- Offline patronage writes use idempotency keys and server versions so repeated submissions do not create duplicate visits and stale updates become conflicts.
- Duplicate-candidate review records do not merge clinical records by themselves; they create auditable review decisions for a future merge workflow.
