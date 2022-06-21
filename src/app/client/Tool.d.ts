import { ParamsDeviceTracker } from '../../types/ParamsDeviceTracker';
import { BaseDeviceDescriptor } from '../../types/BaseDeviceDescriptor';

type Entry = HTMLElement | DocumentFragment;

export interface Tool {
    createEntryForDeviceList(
        descriptor: BaseDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): Array<Entry | undefined> | Entry | undefined;
}
