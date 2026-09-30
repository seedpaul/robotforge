# RobotForge

A device-local FRC robot project builder for the 2026 season. Java, C++, and Python only.

## Run the web app

Install Node.js 22.13 or newer, then run `npm install` and `npm run dev`.

For the GitHub Pages build and publication steps, see [GitHub Pages hosting](GITHUB-PAGES.md). `npm run build:pages` creates a static editor and a checked library catalog; publication is gated until public access is approved. Browser projects must be backed up and imported when changing website addresses.

## Features

- Searchable component catalog covering CTRE, REV, AndyMark, Limelight, Thrifty Bot, Kauai Labs / Studica, SDS, VEXpro, WCP, and PWF, including all 12 supported CAN/PWM motor-controller profiles
- CAN and PWM motor controllers, named CANivore buses, validated I/O allocation, automatic vendor dependencies, and wiring inventory
- Differential, West Coast, tank, mecanum, and four-module swerve drivetrains, integrated drive encoders, ADXRS450, Pigeon 2, or navX gyro
- Mechanism subsystems, bounded motor / servo / pneumatic / LED commands, sensor stop conditions, and active-low forward DIO limits
- Mechanism map linking devices to commands and their uses; a guided build order with actionable configuration findings
- Visual routines with action/wait blocks, sequence and parallel/race/deadline composition, live Java/C++/Python factories, undo, and controller/autonomous reuse
- Xbox and joystick USB ports, raw axes, button mapping, deadband, and teleop output cap
- Bézier route editor, geometry playback, sequential autonomous, native PathPlanner 2026 files
- Java, C++, and Python source previews and real ZIP downloads, including dependency/build metadata
- Development checkpoints, change comparisons, recovery before imports/restores, and incremental mechanism additions
- Validation, commissioning checklist, local autosave, JSON backup/import, accessible responsive interface
- Paired local companion with build logs, cached/offline builds, and explicit team-confirmed deployment to a roboRIO using GradleRIO or RobotPy

Robot projects use pinned WPILib/GradleRIO 2026.2.1, RobotPy 2026.2.2, REVLib 2026.0.5 (Python binding 2026.0.4), Phoenix 6 26.3.0, and PathPlannerLib 2026.1.2. Versions were checked against upstream metadata on 2026-09-28.

## Build with the wizard

RobotForge opens in **Build wizard**.

1. **Assemble robot:** choose the drivetrain first, then drag mechanisms onto the chassis. Enter the team number in a plain numeric-entry box (1–99999), name the project, and choose Java/C++/Python.
2. **Assemble subsystems:** click a mechanism on the chassis or select a subsystem. Drag motor controllers, sensors, and accessories from the searchable component tray into its workspace. Click a placed component to set its CAN ID or channel, motor model, limits, calibration, and other details. Configure drivetrain feedback and wheel/module assignments below its component canvas.
3. **Define commands:** define bounded actions and optional sensor stops for each mechanism. Configure the default driver command for the drivetrain. Sensor-only and passive subsystems do not require artificial output commands. Continue to button assignments, autonomous, and preflight.

The robot schematic highlights configured subsystems and lists what still needs work. Progress is derived from the current design, including shared-port conflicts; adding a subsystem or breaking an assignment updates it immediately. Green indicates configuration, not successful compilation or physical commissioning. The wizard remembers its step and selected subsystem on this device. Existing backups, checkpoints, and the detailed editors use the same project data. Fresh projects start without example motors or commands, and incomplete drafts can be saved before hardware is added.

### Visual chassis builder

The wizard starts with an explicit swerve, differential, West Coast, tank, or mecanum choice. Then its mechanism tray offers turret, shooter, indexer, intake, arm, elevator, climber, and custom subsystems. Changing the drivetrain preserves existing hardware and commands for reassignment. Each mechanism gets a unique subsystem and can be moved around the chassis without changing its code or commissioning confirmations.

Click a placed mechanism to open its full component workspace in **Assemble subsystems**. This uses the same drag-to-place and click-to-configure interaction as the robot chassis. Components are real hardware records shared with the detailed editors. New CAN, DIO, analog, PWM, and assigned pneumatic-module connections avoid occupied ports across the whole robot; review the suggestions against physical wiring. Continue to **Define commands** for the same subsystem. Color reflects the current configuration, including changes made in the detailed editors.

On touch screens, select a part and tap the chassis. Keyboard users can select a template, focus the chassis, and press Enter to place it; arrow keys move a focused mechanism and Enter opens its setup. Named subsystem buttons beneath the canvas remain accessible when icons overlap. Both chassis and component positions survive project backups and development checkpoints; older projects receive a default layout. Moving icons preserves existing hardware IDs, commands, settings, and commissioning confirmations.

The chassis is a visual organizer. Icon positions do not set robot geometry or offsets. Turret, arm, elevator, and climber templates organize hardware and bounded output commands; closed-loop angle/position control still requires additional robot code.

`npm run test:designer` verifies layout persistence, legacy compatibility, placement bounds, incremental additions, drivetrain replacement, preserved assignments, completion changes, and generated-code stability when moving icons.

`npm run test:wizard` verifies draft persistence, subsystem ownership, cross-subsystem collision handling, iterative additions, completion changes, and checkpoint compatibility.

## Configure motor controllers

In **Hardware → Component library**, choose **Motor controllers** or search for SPARK MAX, SPARK Flex, Talon FX/FXS/SRX, Victor SPX/SP, or Thrifty Nova. **Add** creates that controller in the motor configuration and takes you to its name, CAN ID/PWM channel, subsystem, motor model, and limits. Suggested addresses account for other motors, sensors, the drivetrain gyro, servos, and LED outputs. Thrifty Nova is marked Java-only. The catalog and controller selector share the same profiles; existing saved projects keep their original motor configuration.

## Deploy from the browser

In **Code & export**, download the companion, extract it, and open `Start RobotForge.cmd` on a Windows laptop with Node.js and the 2026 WPILib tools installed. Python projects require Python 3.12. Pair the browser with the code shown in its window, build while online, then connect to the robot network or USB and choose **Review & deploy**. See [the companion guide](companion/README.md) for setup, custom tool locations, offline behavior, and limitations.

`node scripts/package-companion.mjs` builds the downloadable companion from the same schema and generators as the app. Run it after changing generators, vendor files, or companion code, before building the site. `node scripts/verify-companion.mjs` tests authorization, validation, build/deploy sequencing, stale builds, failures, and cancellation without contacting a robot.

## Automatic library updates

**Libraries & updates** checks official feeds on opening, hourly while open, and after reconnecting. Online companion builds also resolve current stable 2026 versions. It supports WPILib, RobotPy, REVLib, Phoenix 6, PathPlanner, Playing With Fusion, Studica navX, PhotonVision, legacy Phoenix 5, and ThriftyLib. New catalog metadata is fetched at runtime; publishing a new website is not necessary for ordinary library releases. No desktop-agent automation or scheduled chat is required.

Automatic mode adopts newer stable releases within 2026. Freeze a project before competition, restore its previous version set, or save a version snapshot. Failed checks keep saved versions and report which feeds failed; they never downgrade a project. Native vendor versions and Python bindings are tracked independently. New seasons, prereleases, unknown repositories, and unexpected vendor identities are excluded. The shared API caches successful release checks for one hour; incomplete or manually requested checks can refresh after one minute. Checks happen on use, not while the application and companion are both closed.

Every archive contains `robotforge-libraries.lock.json`, pinned vendordeps or Python requirements, and a frozen project backup. Companion jobs resolve once, print their selected versions, and deploy that same successful build. Python environments are isolated by the selected requirement set. The new protocol requires Companion 1.5.0; download the updated ZIP in the app.

Additional vendor switches install APIs; they do not generate device integration logic for unsupported hardware. Library metadata cannot automatically migrate generated source across a breaking API change, install roboRIO firmware, update the locally installed WPILib toolchain, or port projects to another season. Such updates require code/tooling changes and testing. Compilation failures block robot deployment.

`node scripts/verify-libraries.mjs` verifies update selection, prerelease/yanked filtering, manifest validation, network-failure fallback, old project migration, and optional vendor exports. Add `--live` to check actual publisher feeds. Sources are the vendor's documented JSON, WPILib's `vendor-json-repo/2026` archive, WPILib GitHub releases, and the official PyPI package release histories.

## Validation

`node scripts/verify-generator.mjs` checks invalid configuration rejection, generates three language fixtures, and verifies path geometry. `node node_modules/typescript/bin/tsc --noEmit` checks the web application.

Generated fixtures are under ignored `.verification/`. Java compilation, C++ roboRIO compilation/linking, Python vendor-library startup, PathPlanner parsing, and command lifecycle checks are performed separately. No physical robot was connected or deployed.

The companion was exercised on Windows with a real Java build and native dependency preparation, C++ roboRIO compilation/linking, and Python environment installation, RoboRIO dependency synchronization, syntax checking, and all four RobotPy builtin tests. Upload commands were tested with an injected runner; physical uploads were disabled during verification. The updated site passed its production build and TypeScript checks. The Libraries & updates interface was verified in the browser for frozen mode, optional vendor selection, reload persistence, rollback, and mobile overflow. Java and C++ projects with all optional vendors compiled; Python installed and synchronized all optional libraries, imported their APIs, and passed four builtin tests.

## Scope and limitations

This generates robot projects for the supported drivetrain and hardware configurations. It is not an automatic competition-readiness certification. Other module counts, motor-controller-connected steering encoders, vision fusion, devices without an implemented profile, bidirectional position-limited mechanisms, mechanism PID/profiled setpoints, multi-path libraries, event markers, obstacle pathfinding, and a drivetrain physics simulation need additional implementation. Teams must build with the matching FRC tools, configure firmware, measure geometry, tune gains, verify direction and limits, and test on their robot. The autonomous canvas is a generic coordinate grid, not an official field map or collision checker.

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

## Visual routines

**Logic builder** composes existing commands into typed blocks. Together blocks support all-finish, first-finish, and first-action-as-deadline behavior. Shared-subsystem concurrency, missing references, and malformed projects block export. Routine factories create fresh command instances and preserve each action's stop behavior. A routine reserves all of its subsystems throughout its sequence, including waits. An invalid sensor stops its action; it does not automatically abort later blocks. The displayed duration is a timeout estimate, not a physics simulation.

Routines are saved with the existing project JSON, selectable in Controls and Autonomous, and described in each export's `LOGIC.md`. Existing projects without routines still load. Companion 1.5.0 (protocol 6) is required so that older companions cannot omit routines or drivetrain encoder assignments. There is no Blockly XML import, arbitrary source block, recursive routine nesting, or source-to-visual round trip.

Run `npm run test:routines` to validate the model and generate Java/C++/Python fixtures under `.verification/routines-*`. Build the Java and C++ fixtures with GradleRIO. The Python fixture includes four RobotPy builtin lifecycle tests and the scheduler checks from `scripts/verify-routines-runtime.py`; run `python -m robotpy test` in that fixture. See [DESIGN-NOTES.md](DESIGN-NOTES.md) for the reference assessment and design decisions.


## Iterative development

Continue the same working robot project throughout the season. **Development** provides named checkpoints with notes and captures the complete configuration plus resolved dependency versions. Saving a draft does not imply it has passed a build or physical test. Up to 40 checkpoints are kept in this browser's IndexedDB; the active project continues to autosave separately.

1. Save a milestone before changing the design, with notes on what has been tested.
2. Use **Add a mechanism** for a subsystem-only starting point or a subsystem, CAN motor, and bounded starter command. Existing IDs, controls, routines, and autonomous assignments remain in place. The shortcut suggests an unused roboRIO CAN ID; adjust it to match the physical controller.
3. Use Hardware, Subsystems, Commands, Logic builder, Controls, and Autonomous to refine the design. Compare against any checkpoint to see added, removed, or changed items, scalar before/after values, and changed collection summaries.
4. Build and test the new revision, then save another checkpoint. Restoration freezes the captured dependencies and clears bench confirmations; it requires another build and explicit deployment to change a robot.

The mechanism shortcut, project import, and checkpoint restore first commit a recovery checkpoint. If checkpoint storage is unavailable, full, or fails, the replacement is cancelled and the current project remains. Imports show a change review before replacement. Unreadable active-project data is retained for recovery instead of overwritten by the default project.

**Download history** transfers milestones and notes to another browser using **Import history**. History imports merge identical checkpoints, reject conflicting identifiers, and leave the active design untouched. A single checkpoint can also be downloaded as a frozen project backup. Download backups regularly: clearing browser data removes local history, and no cloud team synchronization is provided.

Checkpoints archive configuration and dependencies, not robot binaries, firmware, or handwritten source. Regeneration produces a complete project and does not merge custom source changes. Keep exported code and custom work in version control.

Run `npm run test:development` for snapshot immutability, preserved assignments, incremental additions, CAN collisions, comparisons, restoration, backup round trips and merge limits, and generated exports before/after changes in Java, C++, and Python. Browser verification covers checkpoint creation, adding a motor/subsystem/command, restoration, import review and recovery, history import, reload persistence, and responsive layout.

## Configure a drivetrain

Start with the drivetrain in **Build wizard → Assemble robot**, then open it in **Assemble subsystems**. Four swerve modules, four mecanum wheels, or two differential/West Coast/tank sides each have their own component slots. Drag a compatible controller or encoder into a slot, or select it and click the slot; existing unassigned hardware can be reused. Click a placed component to edit its connections. The corner map highlights units with all required hardware assigned; preflight still checks configuration before export. Use Previous/Next to work through each unit. Chassis geometry and the heading sensor are shared settings below the assembly. **Hardware → Drivetrain layout** also remains available. Existing backups stay differential until a different layout is selected. Layout changes preserve hardware, mechanisms, commands, controller bindings, and development checkpoints.

- **Differential / West Coast / tank:** 1–4 motors per side with equal counts; choose arcade or independent tank axes in Controls. PathPlanner LTV following uses the actual motor count.
- **Mecanum:** assign one wheel motor per corner, measure wheelbase and track width, and configure forward/strafe/turn axes. WPILib mecanum odometry and a holonomic trajectory follower use the configured waypoints. Mecanum routes use the entered coordinates unchanged on both alliances; PathPlanner files are reference geometry, not the runtime follower.
- **Swerve:** assign four drive motors, four steering motors, and four CANcoder or roboRIO DIO duty-cycle absolute encoders. Configure each encoder's direction and forward offset. Generated code includes swerve kinematics, odometry, continuous steering control, module optimization, cosine compensation, and PathPlanner holonomic following. Invalid absolute feedback stops all eight motors. Steering encoders plugged into SPARK data ports are not currently supported.

Drive controllers currently support brushless SPARK MAX, SPARK Flex, and Talon FX. Differential/West Coast/tank sides and mecanum wheels use integrated motor feedback by default. Add an optional roboRIO quadrature encoder to a side or wheel to use it for distance, speed, and odometry in all three generated languages. Set **Distance per pulse (m)** to meters travelled per full encoder cycle (not each decoded edge), including any gearing; the code applies no additional wheel conversion to external feedback. See [WPILib encoder calibration](https://docs.wpilib.org/en/stable/docs/software/hardware-apis/sensors/encoders-software.html). Encoders are shared with hardware telemetry and cannot be assigned to more than one drive unit. Swerve steering also supports Talon FXS using external absolute feedback. Select robot-relative or field-relative controls for mecanum/swerve; field-relative axes use the blue field reference. Tune geometry, gains, motor/encoder directions, and offsets on the actual robot. Exports include a drivetrain-specific `DRIVETRAIN.md` guide.

Run `npm run test:drivetrains` for 21 layout/language exports, unit assembly, mapping validation, hardware reuse, and backup/checkpoint compatibility. `scripts/verify-unit-feedback-runtime.py` exercises the differential and mecanum external-encoder fixtures with actual WPILib EncoderSim: calibrated distance/rate, odometry, invalid feedback, watchdog and disable. `scripts/verify-drivetrain-runtime.py` exercises exported holonomic Python projects with installed RobotPy/vendor packages; copy it into the export directory before running, and use `--robot` for the full robot initialization check.
