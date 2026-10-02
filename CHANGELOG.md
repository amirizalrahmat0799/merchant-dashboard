# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Dependabot: weekly, grouped minor and patch updates for npm, the Docker base images and GitHub Actions, so CI checks them together. Major upgrades are left
  for deliberate, hand-made changes.

## [1.0.0] - 2026-09-30

### Added
- React 19 + TypeScript dashboard for the payment gateway: overview, payments with capture, void and refund, a virtual
  terminal, settlements and settings with API key rotation.
- AI assistant chat page backed by the payment assistant, with tools used and documentation sources under each reply.
- A demo mode that runs the whole gateway in the browser, published as a live demo on GitHub Pages.
- Blue theme with dark and light modes.
- Docker image serving the app from unprivileged nginx on port 8080.

[Unreleased]: https://github.com/amirizalrahmat0799/merchant-dashboard/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/amirizalrahmat0799/merchant-dashboard/releases/tag/v1.0.0
