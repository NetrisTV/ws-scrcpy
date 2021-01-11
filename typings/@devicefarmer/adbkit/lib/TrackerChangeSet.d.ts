import { Device } from './Device';
export interface TrackerChangeSet {
    removed: Device[];
    changed: Device[];
    added: Device[];
}
