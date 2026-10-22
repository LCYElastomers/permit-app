# Permit modules

Classification, modules, and lifecycle status are different facts.

## Classification

`PermitType` says what kind of permit this is:

`GENERAL_WORK`, `HOT_WORK`, `CONFINED_SPACE`, `OPENING_BLINDING`, `EXCAVATION`, `LIVE_ELECTRICAL`.

The human number (`PTW-2026-00142`) does not encode the type. The type is a column.

## Modules

A permit can carry several modules. `permit_modules.kind` is one of:

`CORE`, `JSA`, `PROCEDURE`, `HAZARD_ASSESSMENT`, `PPE`, `LOTO_ISOLATION`, `ATMOSPHERIC_MONITORING`, `HOT_WORK`, `FIRE_WATCH`, `CONFINED_SPACE`, `RESCUE`, `EXCAVATION`, `OPENING_BLINDING`, `LIVE_ELECTRICAL`, `WORKING_AT_HEIGHT`.

`required` records whether that module was required for this permit. The row does not contain the module's whole body as one JSON document.

Queryable or historical details are their own tables:

- hazards, controls, and PPE: `permit_hazards`, `permit_controls`, `permit_ppe`
- atmosphere: `atmospheric_tests`, one row per test, no numbered test columns
- isolation: `isolations`
- the permit header stays on `permits`

`jsonb` is reserved for event payloads and, later, versioned rule configuration. It is not the store for readings or approvals.

## Lifecycle

`PermitStatus` is the current state: `DRAFT`, `PENDING_REVIEW`, `AUTHORIZED`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `CANCELLED`, `EXPIRED`, `SUPERSEDED`.

Events such as `SUBMITTED`, `AUTHORIZED`, `ACCEPTED`, `ACTIVATED`, `SUSPENDED`, `REAUTHORIZED`, `EXTENDED`, `WORK_COMPLETED`, and `CLOSED` are history. They are not a second copy of the status column. See `docs/SYNC.md` for which events are allowed to change a hold or a closed permit.

## Future rules

The intended flow is:

```
scope answers
  -> rule evaluation
  -> classification
  -> required modules
  -> required controls
  -> required authorization roles
```

That evaluator does not live in React. The domain seam is `IPermitModuleAdvisor`.

`GeneralWorkModuleAdvisor` is the only implementation. It is a recommendation, not a block. If the selected type is `GENERAL_WORK` and the scope includes process opening, a containment break, or energy isolation, it recommends `OPENING_BLINDING`. Confined-space entry recommends `CONFINED_SPACE`. Hot work recommends `HOT_WORK`. Other selected types are unchanged.

No other production safety rules are encoded in this pass. Do not add pass/fail limits, role matrices, or issuance blocks here until those rules are written down as requirements.

The React mock still has its own recommendation copy for the visual workflow. It is not wired to `IPermitModuleAdvisor`.
