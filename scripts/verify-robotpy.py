import sys, os
sys.path.insert(0, os.getcwd())
import hal
hal.initialize(500, 0)
import wpilib
from wpilib.simulation import DriverStationSim, stepTimingAsync
import commands2
from hardware import Mechanism
from robot import Robot
from pathplannerlib.path import PathPlannerPath
from pathplannerlib.config import RobotConfig
print('deploy:', wpilib.getDeployDirectory())
config=RobotConfig.fromGUISettings()
path=PathPlannerPath.fromPathFile('LeaveStart')
assert len(path.getAllPathPoints()) > 3
print('PathPlanner parses config and generated curve: PASS')
robot=Robot()
robot.robotInit()
assert robot.drive.auto_ready
print('Robot initialization with vendor packages and autonomous loading: PASS')
class FakeMotor:
    def __init__(self): self.value=0
    def voltage(self, v): self.value=v
    def stop(self): self.value=0
motor=FakeMotor()
mechanism=Mechanism('test mechanism',[motor])
DriverStationSim.setEnabled(True)
DriverStationSim.setAutonomous(False)
DriverStationSim.notifyNewData()
scheduler=commands2.CommandScheduler.getInstance()
a=mechanism.action(.3,.08)
a.schedule()
for _ in range(2): stepTimingAsync(.02); scheduler.run()
assert motor.value == 3.6 or abs(motor.value-3.6)<.001
for _ in range(8): stepTimingAsync(.02); scheduler.run()
assert motor.value==0 and not a.isScheduled()
print('Command timeout stops output: PASS')
a=mechanism.action(.3,2); a.schedule(); stepTimingAsync(.02); scheduler.run()
b=mechanism.action(-.2,2); b.schedule(); stepTimingAsync(.02); scheduler.run()
assert not a.isScheduled() and b.isScheduled() and motor.value<0
b.cancel(); assert motor.value==0
print('Conflicting commands interrupt; cancellation stops output: PASS')
a=mechanism.action(.3,2); a.schedule();stepTimingAsync(.02);scheduler.run()
DriverStationSim.setEnabled(False);DriverStationSim.notifyNewData();stepTimingAsync(.02);scheduler.run()
assert motor.value==0
print('Disabled robot stops mechanism: PASS')
robot.disabledInit()

