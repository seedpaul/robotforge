"""Scheduler-level composition checks, run by RobotPy against generated robot code."""
from wpilib.simulation import DriverStationSim, stepTiming
def test_composition_lifecycle(control, robot):
    with control.run_robot():
        control.step_timing(seconds=.1, autonomous=False, enabled=True)
        outputs = {'intake': 0, 'shooter': 0}
        for name in outputs:
            robot.mechanisms[name].set = lambda value, name=name: outputs.__setitem__(name, value)
            robot.mechanisms[name].stop = lambda name=name: outputs.__setitem__(name, 0)

        def step(seconds):
            # pyfrc's convenience helper rounds to 200ms; inspect 20ms scheduler boundaries here.
            for _ in range(round(seconds / .02)):
                DriverStationSim.notifyNewData()
                stepTiming(.02)

        # A sequence may use the same action twice; it receives distinct instances.
        command = robot.action('sequence')
        assert command.getRequirements() == {robot.mechanisms['intake']}
        command.schedule(); step(.15)
        assert outputs['intake'] == .35
        step(.65)
        assert outputs['intake'] == .35 and command.isScheduled()
        step(.3)
        assert outputs['intake'] == 0 and not command.isScheduled()

        command = robot.action('parallel')
        assert command.getRequirements() == set(robot.mechanisms.values())
        command.schedule(); step(.15)
        assert outputs == {'intake': .35, 'shooter': .5}
        step(.4)
        assert outputs == {'intake': 0, 'shooter': .5} and command.isScheduled()
        step(.4)
        assert outputs == {'intake': 0, 'shooter': 0} and not command.isScheduled()

        for routine in ['race', 'deadline']:
            command = robot.action(routine)
            command.schedule(); step(.15)
            assert outputs == {'intake': .35, 'shooter': .5}
            step(.4)
            assert outputs == {'intake': 0, 'shooter': 0} and not command.isScheduled()

        command = robot.action('bounded')
        command.schedule(); step(.08)
        assert outputs == {'intake': .35, 'shooter': .5}
        step(.2)
        assert outputs == {'intake': 0, 'shooter': 0} and not command.isScheduled()

        # A competing command interrupts the entire composition and stops both outputs.
        command = robot.action('parallel')
        command.schedule(); step(.08)
        replacement = robot.action('collect')
        replacement.schedule(); step(.08)
        assert not command.isScheduled() and outputs['shooter'] == 0
        replacement.cancel()
        assert outputs == {'intake': 0, 'shooter': 0}

        command = robot.action('parallel')
        command.schedule(); step(.08)
        control.step_timing(seconds=.1, autonomous=False, enabled=False)
        assert outputs == {'intake': 0, 'shooter': 0} and not command.isScheduled()
