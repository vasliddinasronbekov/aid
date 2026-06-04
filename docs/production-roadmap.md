# Production Healthcare CRM Roadmap

This repository is now being developed as a production healthcare CRM. The platform has to handle ePHI/PHI with explicit tenancy, role-based access, audit evidence, clinical workflow integrity, operational reliability, and future interoperability.

## Standards Baseline

- HHS HIPAA Security Rule: use administrative, physical, and technical safeguards to protect the confidentiality, integrity, and availability of ePHI. Source: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- NIST SP 800-66 Rev. 2: use risk management, HIPAA-to-NIST control mappings, and practical safeguards for ePHI. Source: https://csrc.nist.gov/pubs/sp/800/66/r2/final
- ONC API direction: plan interoperability around standardized APIs, HL7 FHIR, OAuth 2.0, and OpenID Connect. Source: https://healthit.gov/blog/21st-century-cures-act/application-programming-interfaces-in-health-it/
- OWASP ASVS: target Level 2 by default and Level 3 for high-value or high-safety clinical functions. Source: https://devguide.owasp.org/en/08-culture-process/04-asvs/

This is not a legal compliance claim. It is an engineering baseline that makes later formal compliance work realistic.

## Product Phases

### Phase 1: Platform Foundation

Goal: establish the non-negotiable backend foundation for a real hospital CRM.

Scope:
- Multi-tenant organization, hospital, department, room, and staff profile model.
- Role taxonomy for hospital admins, head physicians, physicians, nurses, registrars, compliance staff, researchers, and read-only auditors.
- Scoped access grants for temporary or department-specific access.
- Append-only audit event model for PHI access and safety-relevant operations.
- DRF serializers, viewsets, URL registration, admin registration, and migrations.
- Request context middleware so audit evidence can include actor, request ID, IP address, and user agent.

Completion criteria:
- Every clinical object can be tied to an organization and facility context.
- Staff access can be scoped by tenant and role.
- Patient and medical record access emits audit events.
- Audit event APIs are read-only.
- Source syntax and frontend build continue to pass.

### Phase 2: Clinical CRM Workflows

Goal: make the CRM operationally complete for hospital daily work.

Scope:
- Master patient index, duplicate detection, consent preferences, emergency contacts, allergies, care teams.
- Encounters, appointments, admissions, discharges, transfers, tasks, nursing rounds, referrals, lab/imaging orders.
- Perinatal high-risk registry as a first-class module, not a color label.
- Regional patronage nurse offline sync with conflict resolution and server-side idempotency.

### Phase 3: Clinical Safety And AI Governance

Goal: make AI review safe, explainable, auditable, and non-punitive.

Scope:
- Versioned clinical protocol library.
- Rule engine for omissions, prescription mismatches, imaging safety, ethics review, and discharge safety.
- Blameless RCA lifecycle with assignments, due dates, corrective actions, review boards, and trend analytics.
- Model registry for digital twin predictions, model cards, feature provenance, drift monitoring, and clinical override capture.

### Phase 4: Patient Feedback And Experience

Goal: make QR feedback production-grade and privacy-preserving.

Scope:
- Managed QR codes for rooms, departments, doctors, and visit contexts.
- Abuse prevention without identity capture.
- Multilingual patient forms.
- Escalation workflows for low ratings, safety complaints, and patient rights concerns.
- Aggregated reporting with small-cell suppression.

### Phase 5: Interoperability And Data Platform

Goal: connect the CRM to real health data ecosystems.

Scope:
- FHIR-aligned resources for Patient, Encounter, Observation, MedicationRequest, DiagnosticReport, CarePlan, and QuestionnaireResponse.
- OAuth/OIDC integration.
- Export jobs, data retention policies, immutable audit exports, and research de-identification pipelines.
- Event streaming for downstream analytics and hospital operations.

### Phase 6: Production Operations

Goal: make the product operable at hospital scale.

Scope:
- Deployment hardening, secrets management, backup and restore, disaster recovery, health checks, metrics, tracing, log redaction.
- Automated security checks, dependency policy, SAST, dependency scanning, migration safety, load testing, and incident response runbooks.
- Accessibility, browser/device support, localization, and formal acceptance testing.
