import Client from '@devicefarmer/adbkit/lib/adb/client';
import { ExtendedSync } from './ExtendedSync';
import { SyncCommand } from './command/host-transport/sync';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';

export class ExtendedClient extends Client {
    public async pipeSyncService(serial: string): Promise<ExtendedSync> {
        const transport = await this.transport(serial);
        return new SyncCommand(transport).execute();
    }

    public async pipeReadDir(serial: string, pathString: string, stream: Multiplexer): Promise<void> {
        const sync = await this.pipeSyncService(serial);
        return sync.pipeReadDir(pathString, stream).then(() => {
            sync.end();
        });
    }

    public async pipePull(serial: string, path: string, stream: Multiplexer): Promise<void> {
        const sync = await this.pipeSyncService(serial);
        return sync.pipePull(path, stream).then(() => {
            sync.end();
        });
    }
}
