# Spec Delta

## Purpose

Defines how the desktop app runs the local hub backend as a separate process:
starting it, knowing when it is ready, stopping it, and telling the user when it
fails.

## ADDED Requirements

### Requirement: Backend runs as a separate process
The desktop app SHALL start the hub backend in its own operating-system process
when the app launches, separate from the app's window and main process.

#### Scenario: App launch starts the backend
- **WHEN** the user launches the desktop app
- **THEN** a separate backend process is started
- **AND** the app window shows a "starting" state until the backend is ready

#### Scenario: Backend crash does not close the UI
- **GIVEN** the app and backend are running
- **WHEN** the backend process exits unexpectedly
- **THEN** the app window stays open and responsive

### Requirement: App waits for backend readiness
The desktop app SHALL treat the backend as ready only after the backend reports
that it accepts API requests, and SHALL report a failure if that does not happen
within the startup timeout.

#### Scenario: Backend becomes ready
- **WHEN** the backend reports that it is ready
- **THEN** the app leaves the "starting" state and shows the backend as running

#### Scenario: Backend does not start in time
- **WHEN** the backend has not reported ready within the startup timeout
- **THEN** the app shows a startup error with a retry action
- **AND** the backend process, if any, is stopped

### Requirement: Backend API is local and protected
The backend SHALL accept API connections only on the loopback interface and SHALL
reject requests that do not carry the session secret issued by the desktop app
for that run.

#### Scenario: Request from the desktop app
- **WHEN** the desktop app calls the backend with the current session secret
- **THEN** the backend handles the request

#### Scenario: Request without the session secret
- **WHEN** a local process calls the backend without a valid session secret
- **THEN** the backend rejects the request as unauthorized

#### Scenario: Request from another machine
- **WHEN** a process on another machine tries to connect to the backend
- **THEN** the connection is not accepted

### Requirement: Backend port is chosen at runtime
The backend SHALL listen on a free port chosen at startup, and the desktop app
SHALL learn that port from the backend instead of using a fixed port.

#### Scenario: Default port already in use
- **GIVEN** another program already uses a port the backend might choose
- **WHEN** the app launches
- **THEN** the backend starts on a different free port and the app connects to it

### Requirement: Backend stops with the app
The desktop app SHALL stop the backend process when the app quits, and no
backend process SHALL keep running after the app has exited.

#### Scenario: User quits the app
- **WHEN** the user quits the desktop app
- **THEN** the backend process is stopped before the app exits

#### Scenario: App is killed
- **WHEN** the desktop app process is terminated without a normal quit
- **THEN** the backend process detects it and exits on its own

### Requirement: User can restart a stopped backend
The desktop app SHALL show when the backend has stopped unexpectedly and SHALL
let the user restart it without restarting the app.

#### Scenario: Restart after a crash
- **GIVEN** the backend has stopped unexpectedly
- **WHEN** the user chooses restart
- **THEN** a new backend process starts and the app shows it as running once ready
