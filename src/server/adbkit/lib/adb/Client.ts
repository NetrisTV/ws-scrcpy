import OriginalClient from '@devicefarmer/adbkit/lib/adb/client';
import { Duplex } from 'stream';
import { LocalAbstractCommand } from './command/host-transport/LocalAbstractCommand';

export class Client extends OriginalClient {
    public openLocalAbstract(serial: string, name: string): Promise<Duplex> {
        return this.transport(serial).then(function (transport) {
            return new LocalAbstractCommand(transport).execute(name);
        });
    }
}
