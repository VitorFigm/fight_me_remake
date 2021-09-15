import { ArmAction, ArmStateName, View } from "@app/models";
import { State } from "app/controllers/states/model/state.model";
import {
  Moving,
  MovingProps,
} from "app/controllers/states/moving/moving.state";
import { FiniteStateMachine } from "app/controllers/states/state-machine";
import { inject } from "app/core/inversion-of-control/inversion-of-control.engine";
import { GRAVITY } from "app/services/next-frame/constants";
import { calculatePendularMotion } from "app/utils/math/pendulum";
import { FullArm } from "../../arm.controller";

interface FallingProps {
  stateMachine: FiniteStateMachine<ArmAction, ArmStateName>;
  armLength: number;
  armMass?: number;
  friction?: number;
}

const DEFAULT_PROPS = {
  armMass: 1,
  friction: 0.07,
};

export class Falling extends State<ArmAction, ArmStateName> {
  private _props: Required<FallingProps>;
  name: ArmStateName = "falling";

  private _movingFullArm: Moving;
  private _movingForeArm: Moving;

  constructor(_props: FallingProps) {
    super(_props.stateMachine);
    this._props = { ...DEFAULT_PROPS, ..._props };

    const movingConfig: MovingProps = {
      axis: "angle",
      initialAcceleration: 0,
      friction: this._props.friction,
      stateMachine: this._props.stateMachine,
    };

    this._movingFullArm = inject(Moving, movingConfig);

    this._movingForeArm = inject(Moving, movingConfig);
  }

  listenActions(): void {
    this.setTransition({ from: "controlling", on: "loose" });
  }

  onInit(): void {}

  execute(fullArm: FullArm): void {
    console.log(this._props.friction);
    this.acceleratePendulums(fullArm);
    const shoudlAccelerate = true;

    this._movingFullArm.execute(fullArm, shoudlAccelerate);
    this._movingForeArm.execute(fullArm.components.forearm, shoudlAccelerate);
  }

  stop() {
    this._movingForeArm.velocity = 0;
    this._movingFullArm.velocity = 0;
  }

  private acceleratePendulums(fullArm: FullArm) {
    const commmon = {
      length: this._props.armLength / 2,
      mass: this._props.armMass,
    };

    const fullArmPendulum = {
      ...commmon,
      angle: fullArm.position.angle,
      velocity: this._movingFullArm.velocity,
    };

    const foreArmPendulum = {
      ...commmon,
      angle: fullArm.components.forearm.position.angle,
      velocity: this._movingForeArm.velocity,
    };

    const pendularMotion = calculatePendularMotion(
      fullArmPendulum,
      foreArmPendulum,
      GRAVITY
    );

    this._movingFullArm.acceleration = pendularMotion.pendulum1Acceleration;
    this._movingForeArm.acceleration = pendularMotion.pendulum2Acceleration;
  }
}