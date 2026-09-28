"""Copy into the generated hardware-python fixture's tests directory and run robotpy test."""
import math

def test_peripheral_guards(control, robot):
    with control.run_robot():
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        output = [0]
        owner = robot.mechanisms['intake']
        owner.set = lambda v: output.__setitem__(0, v)
        owner.stop = lambda: output.__setitem__(0, 0)
        robot.hardware.read_devdigital = lambda: 0
        command = robot.action('collect')
        assert owner in command.getRequirements()
        command.schedule()
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        assert output[0] == .35
        robot.hardware.read_devdigital = lambda: 1
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        assert output[0] == 0 and not command.isScheduled()

        robot.hardware.read_devdigital = lambda: math.nan
        command = robot.action('collect')
        command.schedule()
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        assert output[0] == 0 and not command.isScheduled()

        robot.hardware.read_devcanrange = lambda: 1.0
        servo = robot.action('cmddevservo')
        assert owner in servo.getRequirements()
        servo.schedule()
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        assert abs(robot.hardware.d_devservo.get() - .5) < .01
        servo.cancel()
        assert robot.hardware.d_devservo.getPulseTime() == 0

        robot.hardware.set_devservo(.7)
        assert abs(robot.hardware.d_devservo.get() - .7) < .01
        control.step_timing(seconds=.2, autonomous=False, enabled=True)
        assert robot.hardware.d_devservo.getPulseTime() == 0

        control.step_timing(seconds=.2, autonomous=False, enabled=False)
        robot.hardware.set_devservo(.8)
        assert robot.hardware.d_devservo.getPulseTime() == 0
