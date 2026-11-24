# Spec Delta

## Purpose

Lets the desktop app and support tooling see whether the hub backend is running
and which version it is, through the published API contract.

## ADDED Requirements

### Requirement: Status endpoint
The backend SHALL expose a status endpoint that returns the backend's state and
its version, as defined in the API contract (`api/openapi.yaml`).

#### Scenario: Status of a running backend
- **WHEN** an authorized client requests the backend status
- **THEN** the response reports the state as running
- **AND** includes the backend version

### Requirement: Responses match the API contract
Every response the backend returns for an operation in the API contract SHALL
match the schema the contract defines for that operation and status code.

#### Scenario: Status response conforms to the contract
- **WHEN** the status endpoint returns a response
- **THEN** the response body is valid against the contract's schema for it

#### Scenario: Unauthorized response conforms to the contract
- **WHEN** the status endpoint rejects a request without a valid session secret
- **THEN** the error response is valid against the contract's error schema

### Requirement: UI shows backend status
The desktop app SHALL show the backend's current status (starting, running, or
stopped) and, when running, its version.

#### Scenario: Backend running
- **GIVEN** the backend is running
- **WHEN** the user looks at the app window
- **THEN** the app shows the backend as running with its version

#### Scenario: Backend unreachable
- **GIVEN** the app was showing the backend as running
- **WHEN** status requests to the backend fail
- **THEN** the app shows the backend as stopped
