# RobotForge

A device-local FRC robot project builder for the 2026 season. Java, C++, and Python only.

## Run the web app

Install Node.js 22.13 or newer, then run `npm install` and `npm run dev`.

## Features

- Searchable component catalog covering CTRE, REV, AndyMark, Limelight, Thrifty Bot, Kauai Labs / Studica, SDS, VEXpro, WCP, and PWF
- CAN and PWM motor controllers, named CANivore buses, validated I/O allocation, automatic vendor dependencies, and wiring inventory
- Differential drivetrain with two motors per side, integrated encoders, ADXRS450, Pigeon 2, or navX gyro
- Mechanism subsystems, bounded motor / servo / pneumatic / LED commands, sensor stop conditions, and active-low forward DIO limits
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

**Libraries & updates** checks official feeds on opening, hourly while open, and after reconnecting. Online companion builds also resolve current stable 2026 versions. It supports WPILib, RobotPy, REVLib, Phoenix 6, PathPlanner, Playing With Fusion, Studica navX, PhotonVision, legacy Phoenix 5, and ThriftyLib. New catalog metadata is fetched at runtime; publishing a new website is not necessary for ordinary library releases. No desktop-agent automation or scheduled chat is required.

Automatic mode adopts newer stable releases within 2026. Freeze a project before competition, restore its previous version set, or save a version snapshot. Failed checks keep saved versions and report which feeds failed; they never downgrade a project. Native vendor versions and Python bindings are tracked independently. New seasons, prereleases, unknown repositories, and unexpected vendor identities are excluded. The shared API caches successful release checks for one hour; incomplete or manually requested checks can refresh after one minute. Checks happen on use, not while the application and companion are both closed.

Every archive contains `robotforge-libraries.lock.json`, pinned vendordeps or Python requirements, and a frozen project backup. Companion jobs resolve once, print their selected versions, and deploy that same successful build. Python environments are isolated by the selected requirement set. The new protocol requires Companion 1.2.0; download the updated ZIP in the app.

Additional vendor switches install APIs; they do not generate device integration logic for unsupported hardware. Library metadata cannot automatically migrate generated source across a breaking API change, install roboRIO firmware, update the locally installed WPILib toolchain, or port projects to another season. Such updates require code/tooling changes and testing. Compilation failures block robot deployment.

`node scripts/verify-libraries.mjs` verifies update selection, prerelease/yanked filtering, manifest validation, network-failure fallback, old project migration, and optional vendor exports. Add `--live` to check actual publisher feeds. Sources are the vendor's documented JSON, WPILib's `vendor-json-repo/2026` archive, WPILib GitHub releases, and the official PyPI package release histories.

## Validation

`node scripts/verify-generator.mjs` checks invalid configuration rejection, generates three language fixtures, and verifies path geometry. `node node_modules/typescript/bin/tsc --noEmit` checks the web application.

Generated fixtures are under ignored `.verification/`. Java compilation, C++ roboRIO compilation/linking, Python vendor-library startup, PathPlanner parsing, and command lifecycle checks are performed separately. No physical robot was connected or deployed.

The companion was exercised on Windows with a real Java build and native dependency preparation, C++ roboRIO compilation/linking, and Python environment installation, RoboRIO dependency synchronization, syntax checking, and all four RobotPy builtin tests. Upload commands were tested with an injected runner; physical uploads were disabled during verification. The updated site passed its production build and TypeScript checks. The Libraries & updates interface was verified in the browser for frozen mode, optional vendor selection, reload persistence, rollback, and mobile overflow. Java and C++ projects with all optional vendors compiled; Python installed and synchronized all optional libraries, imported their APIs, and passed four builtin tests.

## Scope and limitations

This is an initial functional generator for differential-drive robots. It is not an automatic competition-readiness certification. Swerve, vision fusion, devices without an implemented profile, bidirectional position-limited mechanisms, mechanism PID/profiled setpoints, multi-path libraries, event markers, obstacle pathfinding, and a drivetrain physics simulation need additional implementation. Teams must build with the matching FRC tools, configure firmware, measure geometry, tune gains, verify direction and limits, and test on their robot. The autonomous canvas is a generic coordinate grid, not an official field map or collision checker.

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

The Gradle wrapper and build templates originate from wpilibsuite/vscode-wpilib v2026.2.1. Vendor metadata comes from each provider; export filenames are normalized. See THIRD_PARTY_NOTICES.md.

## Expanded hardware support

See [HARDWARE-SUPPORT.md](HARDWARE-SUPPORT.md) for the complete profile matrix. Profiles explicitly distinguish generated adapters, passive wiring records, and integrations that block export. Selecting a vendor name never claims support for every product sold by that vendor.

The implemented peripheral adapters are compiled in Java and C++ against the 2026 libraries and exercised in Python with real vendor packages. The fixture combines 29 peripheral adapters, 17 Java motor instances (16 in C++/Python), and 11 commands. All five RobotPy tests pass: four builtin lifecycle tests plus a runtime test covering a sensor threshold, invalid sensor abort before output, command ownership, servo cancellation, freshness timeout, and disabled output inhibition. The production web build, TypeScript checks, and local page/library endpoint health checks pass. No physical robot was connected. The browser preview could not be tested this turn because the in-app browser rejected its existing local tab; previous UI testing refers to the earlier Libraries & updates version.

Thrifty Nova uses ThriftyLib in Java; no C++ or Python implementation is claimed. Legacy CTRE Python requires a compatible Phoenix 6 package, currently 26.1.3 with robotpy-ctre 2026.1.0.1. Official package metadata is checked for this dependency constraint and exact compatible versions are saved in the build lock. This can select an older Phoenix 6 release for compatibility; projects without legacy CTRE continue using the latest stable Phoenix 6.

Run `npm run test:hardware` for addressing, bus restrictions, module links, language availability, generation, and automatic dependency tests. Copy `scripts/verify-hardware-runtime.py` to the generated Python fixture’s tests directory and run `python -m robotpy test`.
