import { ControlCenterCommand } from '../../common/ControlCenterCommand';
import { TypedEmitter } from '../../common/TypedEmitter';

export interface ControlCenterEvents<T, U> {
    device: T;
    devicePeriodically: U;
}

export abstract class BaseControlCenter<T, U> extends TypedEmitter<ControlCenterEvents<T, U>> {
    abstract getId(): string;
    abstract getName(): string;
    abstract getDevices(): T[];
    abstract runCommand(command: ControlCenterCommand): Promise<string | void>;
}
