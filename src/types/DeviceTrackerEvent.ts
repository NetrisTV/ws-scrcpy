export type DeviceTrackerEvent<T> = {
    name: string;
    id: string;
    device: T;
};
