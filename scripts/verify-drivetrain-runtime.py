"""Run from an exported Python project with RobotPy and vendor dependencies installed."""
import math
import os
import sys
sys.path.insert(0, os.getcwd())
import hal
hal.initialize(500, 0)
import commands2
import wpilib
from wpilib.simulation import DriverStationSim, stepTimingAsync
from wpimath.kinematics import ChassisSpeeds
from wpimath.geometry import Pose2d, Rotation2d
import hardware

class Motor:
    def __init__(self, config):
        self.configured = True
        self.output = 0
        self.pos = self.vel = 0
    def position(self): return self.pos
    def velocity(self): return self.vel
    def voltage(self, value): self.output = value
    def stop(self): self.output = 0

class Sensors(commands2.Subsystem):
    def __init__(self):
        super().__init__()
        self.readings = [m['offset'] for m in CONFIG['drive']['modules']] if CONFIG['drive']['type']=='swerve' else [0.0]*4
    def stop_all(self): pass
    def __getattr__(self, name):
        if name.startswith('read_absolute'):
            return lambda: self.readings[int(name[-1])]
        raise AttributeError(name)

hardware.MotorIO = Motor
from drive import Drive
from config import CONFIG
if '--robot' in sys.argv:
    import peripherals
    peripherals.HardwareIO = Sensors
    from robot import Robot
    robot = Robot()
    robot.robotInit()
    assert robot.drive.auto_ready
    robot.teleop_drive()
    robot.disabledInit()
    print('PASS:', CONFIG['drive']['type'], 'complete robot initialization, autonomous chooser, controller binding and disable')
    sys.exit(0)
sensors = Sensors()
drive = Drive(sensors)
assert drive.auto_ready, 'autonomous setup must succeed with actual WPILib/PathPlanner APIs'
assert drive.healthy(), 'simulated gyro and configured sensors must be usable'
swerve = CONFIG['drive']['type'] == 'swerve'
DriverStationSim.setEnabled(True)
DriverStationSim.setAutonomous(False)
DriverStationSim.notifyNewData()
drive.periodic()
# Confirm field-relative input rotates into robot coordinates using the pose heading.
if CONFIG['controls'].get('fieldRelative'):
    drive.reset_pose(Pose2d(0,0,Rotation2d(math.pi/2)))
    original = drive.drive_speeds
    captured = []
    drive.drive_speeds = captured.append
    drive.teleop(.3,0,0)
    assert abs(captured[0].vx)<1e-8 and captured[0].vy<0
    drive.drive_speeds = original
    drive.reset_pose(Pose2d())
drive.teleop(.3, 0, 0)
assert all(m.output > 0 for m in drive.wheels), 'forward must drive all wheels forward'
assert all(abs(m.output)<=12*CONFIG['controls']['maxOutput'] for m in drive.wheels), 'teleop voltage cap'
drive.stop()
assert all(m.output == 0 for m in drive.wheels)
drive.teleop(0, .3, 0)
if swerve:
    assert all(m.output > 0 for m in drive.steer), 'left strafe should steer counterclockwise'
    # Optimal reverse driving uses negative wheel speed rather than a 180 degree steering turn.
    drive.teleop(-.3, 0, 0)
    assert all(m.output < 0 for m in drive.wheels)
    assert all(abs(m.output) < .001 for m in drive.steer)
    sensors.readings[0] = float('nan')
    drive.teleop(.3, 0, 0)
    assert all(m.output == 0 for m in drive.wheels + drive.steer), 'invalid absolute feedback stops the entire chassis'
    sensors.readings[0] = .25
    drive.periodic()
    assert math.isfinite(drive.pose().X()), 'bad feedback must not poison odometry'
    sensors.readings[0] = 0
else:
    assert [m.output > 0 for m in drive.wheels] == [False,True,True,False], 'mecanum strafe wheel order'
    path = drive.follow_path()
    path.initialize()
    assert abs(drive.pose().X()-CONFIG['auto']['waypoints'][0]['x']) < 1e-6
    stepTimingAsync(.1)
    path.execute()
    assert any(abs(m.output) > 0 for m in drive.wheels), 'path following commands motion'
    path.end(True)
    assert all(m.output == 0 for m in drive.wheels), 'interrupted path stops'
drive.teleop(.3,0,0)
stepTimingAsync(.15)
drive.periodic()
assert all(m.output == 0 for m in drive.wheels), 'stale command watchdog stops output'
drive.teleop(.3,0,0)
DriverStationSim.setEnabled(False)
DriverStationSim.notifyNewData()
drive.periodic()
assert all(m.output == 0 for m in drive.wheels), 'disable stops output'
if swerve: assert all(m.output == 0 for m in drive.steer)
# Exercise chassis-speed feedback, odometry update/reset, and actual kinematic data types.
drive.speeds()
drive.reset_pose(Pose2d(2,3,Rotation2d(.4)))
assert abs(drive.pose().X()-2) < 1e-6
print('PASS:', CONFIG['drive']['type'], 'real APIs, forward/strafe, steering optimization, feedback faults, path interruption, watchdog, disable and odometry')
