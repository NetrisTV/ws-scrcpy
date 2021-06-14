import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';

export interface Tool {
    createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined;
}
