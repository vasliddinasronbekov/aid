# Phase 1: Platform Foundation

Phase 1 turns the initial application into a production-oriented foundation. It does not attempt to finish every hospital workflow; it makes those workflows possible without reworking the core data and security model later.

## Architecture Decisions

- Use organization-level tenancy as the top-level boundary.
- Tie patients, records, feedback, and audit events to hospital context where available.
- Keep existing compatibility fields while adding normalized foreign keys.
- Store staff role and primary hospital in `StaffProfile`, linked one-to-one with Django users.
- Use scoped access grants for temporary department, room, patient group, or break-glass access patterns.
- Capture audit events in an append-only table. Updates and deletes are blocked at the model layer.
- Use request-scoped context middleware to capture actor and request metadata for audit events.

## Phase 1 Deliverables

- Models: `Organization`, `Hospital`, `Department`, `Room`, `StaffProfile`, `AccessGrant`, `AuditEvent`.
- Clinical object upgrades: `Patient`, `MedicalRecord`, `AIErrLog`, and `AnonymousFeedback` gain normalized organization/facility links.
- Permissions: reusable DRF permission classes for tenant and staff-role checks.
- Audit helpers: central `record_audit_event` function and audited viewset mixin.
- APIs: CRUD for organizations, hospitals, departments, rooms, staff profiles, access grants; read-only audit API.
- Admin: operational admin configuration for all foundation models.

## Next Boundary

Phase 2 should build the actual operational CRM workflows on top of this foundation: encounters, appointments, admissions, tasks, care teams, perinatal registry, and offline sync conflict resolution.
