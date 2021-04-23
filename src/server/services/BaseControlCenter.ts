import { ControlCenterCommand } from '../../common/ControlCenterCommand';
import { TypedEmitter } from '../../common/TypedEmitter';

export interface ControlCenterEvents<T> {
    device: T;
}

export abstract class BaseControlCenter<T> extends TypedEmitter<ControlCenterEvents<T>> {
    abstract getId(): string;
    abstract getName(): string;
    abstract getDevices(): T[];
    abstract runCommand(command: ControlCenterCommand): Promise<string | void>;
}
