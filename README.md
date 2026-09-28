# RobotForge

A device-local FRC robot project builder for the 2026 season. Java, C++, and Python only.

## Run the web app

Install Node.js 22.13 or newer, then run `npm install` and `npm run dev`.

## Features

- CAN hardware setup for brushless SPARK MAX / NEO, SPARK Flex / NEO Vortex, and Talon FX / Kraken X60
- Differential drivetrain with two motors per side, integrated encoders, ADXRS450 or Pigeon 2 gyro
- Mechanism subsystems, bounded open-loop commands, active-low forward DIO limits
- Xbox and joystick USB ports, raw axes, button mapping, deadband, and teleop output cap
- Bézier route editor, geometry playback, sequential autonomous, native PathPlanner 2026 files
- Java, C++, and Python source previews and real ZIP downloads, including dependency/build metadata
- Validation, commissioning checklist, local autosave, JSON backup/import, accessible responsive interface

Robot projects use pinned WPILib/GradleRIO 2026.2.1, RobotPy 2026.2.2, REVLib 2026.0.5 (Python binding 2026.0.4), Phoenix 6 26.3.0, and PathPlannerLib 2026.1.2. Versions were checked against upstream metadata on 2026-09-28.

## Validation

`node scripts/verify-generator.mjs` checks invalid configuration rejection, generates three language fixtures, and verifies path geometry. `node node_modules/typescript/bin/tsc --noEmit` checks the web application.

Generated fixtures are under ignored `.verification/`. Java compilation, C++ roboRIO compilation/linking, Python vendor-library startup, PathPlanner parsing, and command lifecycle checks are performed separately. No physical robot was connected or deployed.

## Scope and limitations

This is an initial functional generator for differential-drive robots. It is not an automatic competition-readiness certification. Swerve, vision fusion, arbitrary sensors, bidirectional position-limited mechanisms, mechanism PID/profiled setpoints, multi-path libraries, event markers, obstacle pathfinding, and a drivetrain physics simulation need additional implementation. Teams must build with the matching FRC tools, configure firmware, measure geometry, tune gains, verify direction and limits, and test on their robot. The autonomous canvas is a generic coordinate grid, not an official field map or collision checker.

Projects are stored in the current browser on the current device. Download JSON backups to move or preserve them. No cloud team synchronization is provided. The optional WebMCP tools read the same project and navigate the editor; they do not deploy robots.

## Source layout

- `app/page.tsx`: workspace, local persistence, and optional WebMCP registration
- `components/studio-views.tsx`: configuration editors and preflight
- `components/export-view.tsx`: language/source selection and archive download
- `lib/robot-model.ts`: schemas and validation
- `lib/generator.ts`: package assembly and PathPlanner files
- `lib/gen-java.ts`, `lib/gen-cpp.ts`, `lib/gen-python.ts`: source generators
- `lib/zip.ts`: uncompressed ZIP assembly with CRC32
- `public/vendor/`: pinned official vendor metadata
- `public/templates/`: official WPILib Gradle templates and wrapper

The Gradle wrapper and build templates originate from wpilibsuite/vscode-wpilib v2026.2.1. Vendor metadata is redistributed from each provider without changes. See THIRD_PARTY_NOTICES.md.
