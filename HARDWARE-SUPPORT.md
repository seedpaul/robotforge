# RobotForge hardware support — 2026

Java, C++, and Python. Updated 2026-09-28. FRC only; no LabVIEW.

## What support means

- **Code adapter**: initialization, readings or bounded outputs are generated. This is source compilation and simulation coverage, not physical commissioning.
- **Wiring / inventory**: passive electronics and mechanical assemblies have no independent robot-code API. Add their programmable devices separately.
- **Integration needed**: documented in the catalog but blocks export and deployment; no fake working code is generated.

Sensor units: digital and target-present 0/1, distance meters, absolute encoder rotations, gyro degrees, color proximity counts. Analog and quadrature use configured calibration. CANdi reads S1 closed state as the primary value, and publishes S2 and quadrature separately. Limelight freshness comes from its heartbeat; telemetry includes blue-origin pose but no pose fusion or aiming. CANdle uses a configured solid RGB color; configure physical strip order in Phoenix Tuner.

## Controllers

SPARK MAX/Flex support brushless and brushed mechanism motors. Talon FX supports Kraken X60 and Falcon 500 drivetrain models. Talon FXS supports Minion, NEO, or brushed leads A/B for mechanisms. Talon SRX/Victor SPX use Phoenix 5. Thrifty Nova is Java-only. Standard PWM adapters cover SPARK, SPARK MAX, Talon SRX, Victor SPX, and Victor SP. Use motor/controller ratings for brushed AndyMark, VEXpro, and WCP motors.

Differential drive currently requires four matching SPARK MAX/NEO, SPARK Flex/Vortex, or Talon FX/Kraken X60 or Falcon 500 motors with integrated feedback. Additional motor types are mechanism-only. External sensors are exposed as readings and command stop conditions; they do not automatically replace drivetrain encoders. No generated swerve implementation is claimed.

## Component profiles

| Manufacturer | Component | Coverage | Connection | Guide |
|---|---|---|---|---|
| CTRE | CANcoder | Code adapter | CAN | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/cancoder.html) |
| CTRE | CANrange | Code adapter | CAN | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/canrange.html) |
| CTRE | CANdi | Code adapter | CAN | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/candi.html) |
| CTRE | CANdle | Code adapter | CAN | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/candle.html) |
| CTRE | Pigeon 2 | Code adapter | CAN | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/pigeon2.html) |
| CTRE | CANivore | Code adapter | USB / CAN FD | [Official documentation](https://v6.docs.ctr-electronics.com/en/stable/docs/canivore/canivore-intro.html) |
| CTRE | Pigeon IMU (original) | Code adapter | CAN | [Official documentation](https://docs.ctre-phoenix.com/en/stable/ch11_BringUpPigeon.html) |
| CTRE | CANCoder (Phoenix 5 firmware) | Integration needed | CAN | [Official documentation](https://docs.ctre-phoenix.com/en/stable/ch12a_BringUpCANCoder.html) |
| CTRE | SRX Magnetic Encoder | Code adapter | DIO | [Official documentation](https://docs.ctre-phoenix.com/en/stable/ch14_MCSensor.html) |
| CTRE | Power Distribution Panel | Code adapter | CAN | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| CTRE | Pneumatics Control Module | Code adapter | CAN | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| CTRE | Voltage Regulator Module | Wiring / inventory | Power | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| REV Robotics | Power Distribution Hub | Code adapter | CAN | [Official documentation](https://docs.revrobotics.com/ion-control/pdh) |
| REV Robotics | Pneumatic Hub | Code adapter | CAN | [Official documentation](https://docs.revrobotics.com/ion-control/ph) |
| REV Robotics | Servo Hub | Code adapter | CAN | [Official documentation](https://docs.revrobotics.com/ion-control/servo-hub) |
| REV Robotics | Through Bore Encoder (absolute) | Code adapter | DIO | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/tbe) |
| REV Robotics | Through Bore Encoder (incremental) | Code adapter | DIO × 2 | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/tbe) |
| REV Robotics | Magnetic Limit Switch | Code adapter | DIO | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/magnetic-limit-switch) |
| REV Robotics | Touch Sensor | Code adapter | DIO | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/touch) |
| REV Robotics | Potentiometer | Code adapter | Analog | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/potentiometer) |
| REV Robotics | Color Sensor V3 | Code adapter | I2C | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/color-sensor) |
| REV Robotics | 2m Distance Sensor | Integration needed | I2C | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/sensors/2m-distance/application-examples) |
| REV Robotics | Blinkin LED Driver | Code adapter | PWM | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/blinkin) |
| REV Robotics | Digital LED Indicator | Code adapter | DIO | [Official documentation](https://docs.revrobotics.com/rev-crossover-products) |
| REV Robotics | Mini Power Module | Wiring / inventory | Power | [Official documentation](https://docs.revrobotics.com/ion-control) |
| REV Robotics | Radio Power Module | Wiring / inventory | Power | [Official documentation](https://docs.revrobotics.com/ion-control) |
| REV Robotics | Servo Power Module | Wiring / inventory | Power | [Official documentation](https://docs.revrobotics.com/ion-control) |
| REV Robotics | PoE Injector / power cable | Wiring / inventory | Power | [Official documentation](https://docs.revrobotics.com/ion-control) |
| REV Robotics | Sensor breakout / joiner board | Wiring / inventory | Power | [Official documentation](https://docs.revrobotics.com/ion-control) |
| REV Robotics | Smart Robot Servo (PWM mode) | Code adapter | PWM | [Official documentation](https://docs.revrobotics.com/rev-crossover-products/servo) |
| Playing With Fusion | Time of Flight | Code adapter | CAN | [Official documentation](https://www.playingwithfusion.com/docs/1205%26catid%3D9012) |
| Kauai Labs / Studica | navX MXP / navX2 / Micro | Code adapter | SPI / USB / I2C | [Official documentation](https://github.com/Studica-Robotics/NavX/) |
| Limelight | Limelight 2 | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| Limelight | Limelight 2+ | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| Limelight | Limelight 3 | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| Limelight | Limelight 3G | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| Limelight | Limelight 3A | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| Limelight | Limelight 4 | Code adapter | NetworkTables | [Official documentation](https://docs.limelightvision.io/docs/docs-limelight/apis/complete-networktables-api) |
| The Thrifty Bot | Thrifty Absolute Encoder (analog) | Code adapter | Analog | [Official documentation](https://docs.thethriftybot.com/absolute-encoder) |
| The Thrifty Bot | 10-Pin Encoder (absolute output) | Code adapter | DIO | [Official documentation](https://docs.thethriftybot.com/10-pin-encoder) |
| The Thrifty Bot | Hall Effect Sensor | Code adapter | DIO | [Official documentation](https://docs.thethriftybot.com/) |
| The Thrifty Bot | LaserCAN | Integration needed | CAN | [Official documentation](https://docs.thethriftybot.com/) |
| The Thrifty Bot | MitoCANdria | Integration needed | CAN | [Official documentation](https://docs.thethriftybot.com/) |
| The Thrifty Bot | Thrifty Through Bore CAN Encoder | Integration needed | CAN | [Official documentation](https://docs.thethriftybot.com/) |
| AndyMark | AM Mag / Hall sensor | Code adapter | DIO | [Official documentation](https://www.andymark.com/) |
| AndyMark | Lamprey absolute encoder (PWM output) | Code adapter | DIO | [Official documentation](https://www.andymark.com/) |
| AndyMark | Beam-break / limit switch | Code adapter | DIO | [Official documentation](https://www.andymark.com/) |
| AndyMark | Gearbox / module / mechanical assembly | Wiring / inventory | Mechanical | [Official documentation](https://www.andymark.com/) |
| VEXpro | Gearbox / module / mechanical assembly | Wiring / inventory | Mechanical | [Official documentation](https://www.vexrobotics.com/pro) |
| WCP | Gearbox / module / mechanical assembly | Wiring / inventory | Mechanical | [Official documentation](https://docs.wcproducts.com/) |
| Swerve Drive Specialties | Gearbox / module / mechanical assembly | Wiring / inventory | Mechanical | [Official documentation](https://www.swervedrivespecialties.com/) |
| VEXpro | VersaPlanetary encoder (quadrature) | Code adapter | DIO × 2 | [Official documentation](https://www.vexrobotics.com/pro) |
| WCP | Limit / proximity switch (digital) | Code adapter | DIO | [Official documentation](https://docs.wcproducts.com/) |
| Standard WPILib | Digital switch / beam break | Code adapter | DIO | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Absolute duty-cycle encoder | Code adapter | DIO | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Quadrature encoder | Code adapter | DIO × 2 | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Analog sensor / pressure transducer | Code adapter | Analog | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Ultrasonic (ping / echo) | Code adapter | DIO × 2 | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | PWM servo | Code adapter | PWM | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Single solenoid on REV PH | Code adapter | Module channel | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Double solenoid on REV PH | Code adapter | Module channel | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Single solenoid on CTRE PCM | Code adapter | Module channel | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |
| Standard WPILib | Double solenoid on CTRE PCM | Code adapter | Module channel | [Official documentation](https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html) |

## Known gaps

REV 2m Distance Sensor lacks a verified bundled 2026 adapter. Legacy CANCoder requires compatible Phoenix 6 firmware. LaserCAN, MitoCANdria, and Thrifty CAN Through Bore Encoder need additional vendor adapters. No universal support claim is made for unlisted products, legacy firmware, FTC-only hubs, or every connection mode. Verify each part’s electrical interface and current season rules.
