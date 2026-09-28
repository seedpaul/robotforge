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
- Paired local companion with build logs, cached/offline builds, and explicit team-confirmed deployment to a roboRIO using GradleRIO or RobotPy

Robot projects use pinned WPILib/GradleRIO 2026.2.1, RobotPy 2026.2.2, REVLib 2026.0.5 (Python binding 2026.0.4), Phoenix 6 26.3.0, and PathPlannerLib 2026.1.2. Versions were checked against upstream metadata on 2026-09-28.

## Deploy from the browser

In **Code & export**, download the companion, extract it, and open `Start RobotForge.cmd` on a Windows laptop with Node.js and the 2026 WPILib tools installed. Python projects require Python 3.12. Pair the browser with the code shown in its window, build while online, then connect to the robot network or USB and choose **Review & deploy**. See [the companion guide](companion/README.md) for setup, custom tool locations, offline behavior, and limitations.

`node scripts/package-companion.mjs` builds the downloadable companion from the same schema and generators as the app. Run it after changing generators, vendor files, or companion code, before building the site. `node scripts/verify-companion.mjs` tests authorization, validation, build/deploy sequencing, stale builds, failures, and cancellation without contacting a robot.

## Automatic library updates

**Libraries & updates** checks official feeds on opening, hourly while open, and after reconnecting. Online companion builds also resolve current stable 2026 versions. It supports WPILib, RobotPy, REVLib, Phoenix 6, PathPlanner, Playing With Fusion, Studica navX, and PhotonVision. New catalog metadata is fetched at runtime; publishing a new website is not necessary for ordinary library releases. No desktop-agent automation or scheduled chat is required.

Automatic mode adopts newer stable releases within 2026. Freeze a project before competition, restore its previous version set, or save a version snapshot. Failed checks keep saved versions and report which feeds failed; they never downgrade a project. Native vendor versions and Python bindings are tracked independently. New seasons, prereleases, unknown repositories, and unexpected vendor identities are excluded. The shared API caches successful release checks for one hour; incomplete or manually requested checks can refresh after one minute. Checks happen on use, not while the application and companion are both closed.

Every archive contains `robotforge-libraries.lock.json`, pinned vendordeps or Python requirements, and a frozen project backup. Companion jobs resolve once, print their selected versions, and deploy that same successful build. Python environments are isolated by the selected requirement set. The new protocol requires Companion 1.1.0; download the updated ZIP in the app.

Additional vendor switches install APIs; they do not generate device integration logic for unsupported hardware. Library metadata cannot automatically migrate generated source across a breaking API change, install roboRIO firmware, update the locally installed WPILib toolchain, or port projects to another season. Such updates require code/tooling changes and testing. Compilation failures block robot deployment.

`node scripts/verify-libraries.mjs` verifies update selection, prerelease/yanked filtering, manifest validation, network-failure fallback, old project migration, and optional vendor exports. Add `--live` to check actual publisher feeds. Sources are the vendor's documented JSON, WPILib's `vendor-json-repo/2026` archive, WPILib GitHub releases, and the official PyPI package release histories.

## Validation

`node scripts/verify-generator.mjs` checks invalid configuration rejection, generates three language fixtures, and verifies path geometry. `node node_modules/typescript/bin/tsc --noEmit` checks the web application.

Generated fixtures are under ignored `.verification/`. Java compilation, C++ roboRIO compilation/linking, Python vendor-library startup, PathPlanner parsing, and command lifecycle checks are performed separately. No physical robot was connected or deployed.

The companion was exercised on Windows with a real Java build and native dependency preparation, C++ roboRIO compilation/linking, and Python environment installation, RoboRIO dependency synchronization, syntax checking, and all four RobotPy builtin tests. Upload commands were tested with an injected runner; physical uploads were disabled during verification. The updated site passed its production build and TypeScript checks. The Libraries & updates interface was verified in the browser for frozen mode, optional vendor selection, reload persistence, rollback, and mobile overflow. Java and C++ projects with all optional vendors compiled; Python installed and synchronized all optional libraries, imported their APIs, and passed four builtin tests.

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
