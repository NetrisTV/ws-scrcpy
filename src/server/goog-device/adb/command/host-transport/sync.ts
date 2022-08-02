import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import Command from '@dead50f7/adbkit/lib/adb/command';
import { ExtendedSync } from '../../ExtendedSync';
import Bluebird from 'bluebird';

export class SyncCommand extends Command<ExtendedSync> {
    execute(): Bluebird<ExtendedSync> {
        this._send('sync:');
        return this.parser.readAscii(4).then((reply) => {
            switch (reply) {
                case Protocol.OKAY:
                    return new ExtendedSync(this.connection);
                case Protocol.FAIL:
                    return this.parser.readError();
                default:
                    return this.parser.unexpected(reply, 'OKAY or FAIL');
            }
        });
    }
}
