"""Run from .verification/units-{differential,mecanum}-python with RobotPy installed."""
import math
import os
import sys
sys.path.insert(0, os.getcwd())
import hal
hal.initialize(500, 0)
from wpilib.simulation import DriverStationSim, EncoderSim, stepTimingAsync
from wpimath.geometry import Pose2d
import hardware


class Motor:
    def __init__(self, config):
        self.configured = True
        self.output = 0
    def position(self): return 99.0  # Distinct from actual external feedback.
    def velocity(self): return 77.0
    def voltage(self, value): self.output = value
    def stop(self): self.output = 0


hardware.MotorIO = Motor
from peripherals import HardwareIO
from drive import Drive
from config import CONFIG

sensors = HardwareIO()  # Real WPILib Encoder allocation and calibration.
drive = Drive(sensors)
mecanum = CONFIG['drive']['type'] == 'mecanum'
keys = ['frontLeft', 'frontRight', 'backLeft', 'backRight'] if mecanum else ['left', 'right']
motors = drive.wheels if mecanum else drive.left + drive.right
simulators = [EncoderSim(getattr(sensors, 'd_encoder_'+key)) for key in keys]
DriverStationSim.setEnabled(True)
DriverStationSim.setAutonomous(False)
DriverStationSim.notifyNewData()
assert drive.auto_ready
drive.periodic()
drive.reset_pose(Pose2d())
for sim in simulators:
    sim.setDistance(1.5)
    sim.setRate(0.8)
for i, key in enumerate(keys):
    assert math.isclose(getattr(sensors, 'read_encoder_'+key)(), 1.75)
    assert math.isclose(getattr(sensors, 'rate_encoder_'+key)(), .8)
    group = i if mecanum else getattr(drive, key)
    assert math.isclose(drive.distance(group), 1.75), 'external distance is already calibrated in meters'
    assert math.isclose(drive.velocity(group), .8), 'external rate is already meters/second'
assert math.isclose(drive.speeds().vx, .8)
drive.periodic()
assert math.isclose(drive.pose().X(), 1.5), 'odometry must follow external distance change'
drive.reset_pose(Pose2d())
assert math.isclose(drive.pose().X(), 0)


def command():
    if mecanum: drive.teleop(.3, 0, 0)
    else: drive.arcade(.3, 0)


command()
assert all(m.output != 0 for m in motors)
getter = 'read_encoder_'+keys[0]
original = getattr(sensors, getter)
setattr(sensors, getter, lambda: float('nan'))
command()
assert all(m.output == 0 for m in motors), 'invalid feedback must stop outputs'
drive.periodic()
assert math.isfinite(drive.pose().X()), 'invalid feedback must not poison odometry'
setattr(sensors, getter, original)
drive.periodic()
command()
stepTimingAsync(.15)
drive.periodic()
assert all(m.output == 0 for m in motors), 'stale commands must stop outputs'
command()
DriverStationSim.setEnabled(False)
DriverStationSim.notifyNewData()
drive.periodic()
assert all(m.output == 0 for m in motors), 'disable must stop outputs'
print('PASS:', CONFIG['drive']['type'], 'real EncoderSim distance/rate, shared calibration, odometry, fault rejection, watchdog and disable')
