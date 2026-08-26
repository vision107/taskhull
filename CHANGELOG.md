# Changelog

All notable changes to the Achromatic Pro Next.js Drizzle starter kit are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release records before August 26, 2026 were backfilled from the shipped Git history; their dates below are the dates the code originally shipped.

## [Unreleased]

## [2.4.1] - 2026-08-25

### Security

- Upgraded Next.js to 16.3.3 for the August 2026 security release.

## [2.4.0] - 2026-08-18

### Changed

- Made organization settings permission-aware so restricted controls remain understandable without exposing unauthorized actions.
- Added server-side authorization coverage for organization deletion, billing, member management and logo updates.

## [2.3.0] - 2026-08-16

### Added

- Added passkey sign-in and passkey management with Better Auth.
- Added passkey setup guidance alongside connected accounts and password security.

## [2.2.0] - 2026-08-15

### Added

- Added in-app notifications, an admin notification workflow, unread state and bulk actions.
- Adopted the official shadcn chat components for the AI chat experience.

### Changed

- Improved billing authorization handling and Stripe webhook reliability.
- Added confirmations for destructive membership and session actions.
- Refined dashboard navigation, notification loading and responsive behavior.

## [2.1.0] - 2026-08-09

### Security

- Sanitized authentication redirects and restricted payment return URLs to safe internal destinations.
- Hardened organization authorization and owner-only operations.

### Fixed

- Refreshed affected query caches after organization, member, user, billing, AI chat and passkey mutations.
- Synchronized checkout and credit return pages with webhook-created billing records.
- Explained password prerequisites before enabling two-factor authentication.
- Added the Better Auth existing-email error mapping and removed the username authentication plugin.
- Stabilized Base UI interactions, avatar uploads and deployment behavior.

## [2.0.0] - 2026-08-08

### Changed

- Migrated the component system from Radix UI to Base UI.
- Updated forms, menus, dialogs, sheets, navigation and application surfaces for the new primitives.

## [1.4.0] - 2026-08-04

### Changed

- Upgraded to Next.js 16.3 and TypeScript 7.
- Updated Drizzle ORM and the associated application packages.

## [1.3.0] - 2026-07-28

### Added

- Added a local, read-only, repository-aware MCP server with documented capability boundaries.

### Fixed

- Improved email-change, authentication and two-factor flows.
- Corrected deployment, theme and interface regressions.
- Updated packages and completed lint cleanup.

## [1.2.0] - 2026-07-21

### Changed

- Upgraded Next.js to 16.2.11 and refreshed the core authentication stack.
- Replaced ESLint and Prettier with Oxlint and Oxfmt.

### Added

- Added authenticated browser coverage for critical application flows.
- Added safe user-facing errors for AI streaming failures.

## [1.1.0] - 2026-01-28

### Added

- Added multi-page table selection and Better Auth coding-agent skills.
- Enforced organization creation settings on the server.

### Fixed

- Improved organization membership errors and avatar and logo resizing.
- Removed runtime warnings and updated dependencies.

## [1.0.0] - 2026-01-01

### Added

- Initial release of the Achromatic Pro Next.js Drizzle starter kit.

[Unreleased]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.4.1...HEAD
[2.4.1]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v1.4.0...v2.0.0
[1.4.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/achromaticlabs/pro-nextjs-drizzle/releases/tag/v1.0.0
