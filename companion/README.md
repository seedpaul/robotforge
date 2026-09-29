# RobotForge Companion 1.4.0

This companion lets the RobotForge web app build Java/C++/Python projects locally and deploy them to your FRC roboRIO using GradleRIO or RobotPy. It only accepts validated RobotForge configurations, not arbitrary source uploads or shell commands.

## First use

1. Install Node.js 22.13 or newer: https://nodejs.org/en/download
2. Java/C++: install WPILib 2026.2.1 with its JDK and roboRIO C++ toolchain: https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/wpilib-setup.html
   Python: install Python 3.12 from https://www.python.org/downloads/. On Windows, include the Python launcher. The first online build installs pinned RobotPy packages into an isolated environment under your home folder's `.robotforge` directory.
3. Extract this entire ZIP into a folder. Windows: open **Start RobotForge.cmd**. macOS/Linux: open a terminal in this folder and run `node companion.mjs`.
4. On the SAME laptop, open https://robot-forge-frc.paul-seed121071.chatgpt.site in Chrome or Edge. In **Code & export > Deploy to robot**, enter the pairing code printed in the companion window. Allow local network access if the browser asks.
5. Enter your real team number and complete your robot configuration. Choose robot network (team mDNS hostname) or USB (172.22.11.2). Click **Build** while online. The first build may take several minutes and downloads build dependencies. No code is sent to a robot at this stage.
6. Join your robot network or connect USB. Leave the robot disabled. **Review & deploy**, verify the target, type your team number, and confirm the robot is disabled. Deployment replaces the running robot program and generated path files and restarts the program.
7. Keep power on and keep this companion open until deployment finishes. Check Driver Station and robot logs before enabling. A successful upload does not establish that wiring, direction, sensors, tuning, or paths are correct.

The companion does not control Driver Station or enable the robot. It cannot independently verify that your robot is disabled. USB addresses do not identify a team; physically verify the connected robot. Configure/image the roboRIO with the matching 2026 tools first. Standard default FRC SSH credentials are used by the official deployment tools; custom credentials require deploying the exported project with those tools directly.

## At events / offline

Companion 1.4.0 honors **Libraries & updates**. Automatic online builds check stable 2026 releases from official publishers. Frozen projects and cached/offline builds keep the selected versions. The resolved versions appear in the build log and in `robotforge-libraries.lock.json`; deployment never checks for or applies another update after that build. New seasons and previews are excluded. Python environments are isolated by the exact requirement list. Extra PWF, navX, and PhotonVision packages are installed when enabled in the project; writing their device integration code is a separate task.

Complete an online build on this laptop for each language you plan to use before the event. **Use cached dependencies** skips network preparation; it fails if the required dependencies have not been cached. Java/C++ uploads always run Gradle offline. Python uploads use the requirements downloaded by RobotPy sync. Changing connection or configuration requires a new build. Build cancellation is available; upload cancellation is deliberately unavailable because interrupting a transfer may leave the roboRIO in an incomplete state. The 20-minute operation timeout still applies.

## Tools in custom locations

Set environment variables on the laptop before starting the companion. These settings cannot be changed by a web page.

- `ROBOTFORGE_JAVA_HOME`: JDK 17 directory. Otherwise the companion checks WPILIB_JAVA_HOME, standard WPILib 2026 directories, JAVA_HOME, then java on PATH.
- `ROBOTFORGE_PYTHON`: full path to a Python 3.12 executable. Otherwise Windows uses `py -3.12`; macOS/Linux uses `python3.12`.
- Developers only: `ROBOTFORGE_DEV_ORIGIN=http://127.0.0.1:3107` permits exactly that local development origin, in addition to the production site.

## Troubleshooting

- Cannot connect: keep the companion window open, use the same laptop and current pairing code, allow browser local network access, and ensure port 5819 is free. Embedded browsers or managed school browsers may restrict loopback requests; use Chrome/Edge. If policy blocks access, export the project and deploy using WPILib VS Code / RobotPy.
- Build fails: inspect the displayed log. Install the matching WPILib/toolchain or Python version. Build online before selecting cached dependencies. Missing C++ toolchains must be installed from the WPILib installer.
- Robot not found: connect to the robot network; verify team number and mDNS. Try USB, select USB, and build again. No alternate address is silently tried.
- Refresh/navigation: use the same pairing code to reconnect and read the current operation. If the build snapshot is no longer in the browser's memory, build again before deploying.
- The companion cannot deploy hand-edited source. Export and use a normal FIRST development environment for custom code.

## Data and security

The service binds only to 127.0.0.1:5819. Every request checks the exact Origin and Host and uses a random 192-bit token, regenerated on restart. Pairing tokens stay in browser memory and are not included in backups. Requests are size limited. Jobs use fresh random directories, one operation at a time. Source/build files are hashed and rechecked before deployment. All executable names and arguments come from the companion, not the web client. Dependencies come from the pinned official project templates. Log history is capped at 80 KB.

Builds remain in `~/.robotforge/builds` for review; the companion does not delete them. Python environments remain in `~/.robotforge/python-<requirement-hash>`. Close the companion before manually removing old builds. Logs may contain local file paths. Do not share pairing codes. Close the companion after use.

## Verification scope

The application and companion are software-tested, including generator output and build behavior. Physical roboRIO upload and browser/OS combinations still require on-hardware acceptance testing. There is no claim of automatic competition readiness.

Companion 1.4.0 adds differential/West Coast/tank, mecanum, and four-module swerve generation. Download this release before using the new drivetrain settings. The browser requires protocol 5 so older companions cannot silently generate a different drive layout.
