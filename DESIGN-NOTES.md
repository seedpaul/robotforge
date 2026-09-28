# Visual programming assessment and RobotForge integration

Reviewed 2026-09-28.

## Assessment of the reference

The supplied [FRCodeBlocks article](https://industrialmonitordirect.com/blogs/knowledgebase/frcodeblocks-reference-blockly-to-java-generator-for-frc) suggests a useful direction: expose robot behavior visually while keeping generated source accessible to learners.

Its attribution is inconsistent. It identifies FRC3184/frcblocks as a Java generator, but that repository's [README](https://github.com/FRC3184/frcblocks) describes a Blockly-to-RobotPy bridge. Its [getting-started guide](https://github.com/FRC3184/frcblocks/blob/master/getting_started.md) organizes blocks around robot events, devices, and actions, and describes save, compile, deploy, and simulate controls. The article's Java coverage and defect claims were not accepted as verified facts about that repository. No source code was copied from it.

The strongest lesson is an approachable path from a physical device to visible behavior, with a readable source artifact teams can learn from. A visual interface still needs semantic validation, verified API adapters, a build step, and physical commissioning.

## Combined approach implemented

| Idea | RobotForge implementation | Reason |
|---|---|---|
| Organize robot concepts visually | Overview maps each subsystem to its hardware, commands, routine usage, and controller assignments. | Students can trace what controls a mechanism without searching separate lists. |
| Guide beginners through the workflow | A six-stage build order and a link to the next configuration issue. | The user sees a concrete next task without treating saved settings as physical verification. |
| Compose behavior with blocks | A routine editor with actions, waits, and concurrent action groups; reorder with a grip or keyboard buttons. | These blocks map to a small, testable set of real WPILib operations. |
| Show the generated program | A live Java/C++/Python routine factory, produced by the same function used in exported source. | The preview teaches the actual generated structure and avoids a separate demonstration generator. |
| Reuse behavior | Routines are available in controller assignments and PathPlanner autonomous named-command steps. | A team configures an action once and composes it in multiple places. |
| Prevent invalid compositions | Check missing references, duplicate identifiers, excessive sizes, and concurrent subsystem conflicts before export. | A composition cannot safely have two commands competing for the same mechanism. |
| Preserve recovery and handoff | Local autosave, existing JSON backups, session undo for routine edits, and a generated `LOGIC.md`. | Students can recover edits and hand a readable plan to teammates. |
| Keep build/deploy close to the editor | Existing paired companion builds the validated project; protocol 4 requires Companion 1.3.0. | Older companions cannot silently ignore new routine data. |

## Execution model

[WPILib command compositions](https://docs.wpilib.org/en/stable/docs/software/commandbased/command-compositions.html) define sequence, parallel, race, and deadline behavior. RobotForge exposes these as top-to-bottom blocks, “finish all,” “finish first,” and “lead action finishes.” Each action reference creates a fresh command. The full routine reserves the union of its subsystems, and concurrent actions cannot share an owner. A maximum routine time bounds execution. Current actions retain their existing output shutdown and sensor-stop behavior.

A sensor failure ends its action, not the whole routine. Later stages can still run. The editor and exported guide state this explicitly; automatic fault propagation and recovery branches are future work.

## Deliberate boundaries

This is a structured routine builder, not a general Blockly language. Routines cannot recursively include other routines, arbitrary source, loops, or unrestricted API calls. No Blockly XML import or source-to-block round trip is claimed. The project JSON remains the editable source of truth; edits made to exported source must be preserved separately.

Timing is calculated from configured timeouts and waits. It does not predict mechanism position, motor speed, field clearance, or sensor availability. Existing physical hardware and swerve limitations remain unchanged. The visual builder does not make an unimplemented device adapter supported.

Logical next extensions are reusable closed-loop mechanism templates with measured limits, sensor-conditioned branches with explicit failure handling, and physics-backed simulation. Each needs its own generator and behavior validation before it is exposed as a working block.

## Validation

`scripts/verify-routines.mjs` checks legacy import, project round trips, invalid references, routine-ID collisions, duplicate block IDs, parallel ownership conflicts, timing warnings, and exact preview/export factory agreement. Its fixtures exercise six routine variants in all three languages, including controller and PathPlanner references.

Java and C++ fixture builds pass. Python passes four builtin RobotPy lifecycle tests and a scheduler-level test covering sequential reuse, all three concurrent finish rules, timeout, competing-command interruption, and disable shutdown. Companion authorization and build/deploy sequencing tests also pass. No physical robot upload was performed.

Browser checks verified routine creation, live code changes, same-subsystem conflict feedback, undo, keyboard block reordering, Python preview, controller and autonomous selection, and restoration after reload. Desktop (1440px) and mobile (390px) checks found no page-width overflow. Grip-based dragging is implemented but was not exercised by this browser check.
