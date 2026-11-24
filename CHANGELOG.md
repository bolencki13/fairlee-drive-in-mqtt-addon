# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 11/23/2026

### Changed

- **Breaking:** the single `sensor.fairlee_drive_in` entity is replaced by a "Fairlee Drive-In" device with
  Status, Feature 1, Feature 2, Show dates, Start time and Last refreshed entities. The old entity is removed automatically.
- The MQTT broker is discovered from Home Assistant (e.g. the Mosquitto add-on) when `mqtt_host` is left empty.
  `mqtt_port` option added. Requires the MQTT service only if no broker is configured (`mqtt:want`).
- Page parsing rewritten to read each feature box individually, with fixture-based tests.

### Fixed

- Movies were only refreshed once, an hour after startup (`setTimeout` instead of `setInterval`).
- Theater notices (e.g. "closed for the 2025 season") were reported as movie titles, including raw HTML.
- Show dates were garbled when listed on a single line.
- Entities disappeared or became unavailable after Home Assistant restarted: discovery, state and availability are now
  retained and republished when Home Assistant comes online.
- The device is now marked unavailable when the add-on stops or loses its connection (MQTT last will).
- A failed first fetch crashed the add-on; failures are now logged and the last good data is kept.

## [1.0.5] - 07/26/2024

### Fixed

- Fix build script for options from HA

## [1.0.4] - 07/26/2024

### Fixed

- Fix path reference for config.json

## [1.0.3] - 07/26/2024

### Added

- Read in config file from HA

## [1.0.2] - 07/26/2024

### Fixed

- Build app as part of docker file

## [1.0.1] - 07/26/2024

### Added

- Config options to ingest env vars to the HA addon

## [1.0.0] - 07/26/2024

### Added

- Service to scrape and parse the fairlee drive-in website retrieving latest movies and showing times
- Service to publish data to the mqtt network following the Home Assistant (HA) documentation
