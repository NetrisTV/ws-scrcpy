import { StartServiceOptions } from './StartServiceOptions';
export interface StartActivityOptions extends StartServiceOptions {
    debug?: boolean;
    wait?: boolean;
}
