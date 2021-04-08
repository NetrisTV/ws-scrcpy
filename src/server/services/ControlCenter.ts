import { ControlCenterCommand } from '../../common/ControlCenterCommand';
import { TypedEmitter } from '../../app/TypedEmitter';

export interface ControlCenterEvents<T> {
    device: T;
}

export abstract class ControlCenter<T> extends TypedEmitter<ControlCenterEvents<T>> {
    abstract getId(): string;
    abstract getName(): string;
    abstract getDevices(): T[];
    abstract runCommand(command: ControlCenterCommand): Promise<void>;
}
