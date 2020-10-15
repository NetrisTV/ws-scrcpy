import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';
import Command from '@devicefarmer/adbkit/lib/adb/command';
import { Duplex } from 'stream';
import Bluebird from 'bluebird';

export class LocalAbstractCommand extends Command<Duplex> {
    execute(name: string): Bluebird<Duplex> {
        this._send(`localabstract:${name}`);
        return this.parser.readAscii(4).then((reply) => {
            switch (reply) {
                case Protocol.OKAY:
                    return this.parser.raw();
                case Protocol.FAIL:
                    return this.parser.readError();
                default:
                    return this.parser.unexpected(reply, 'OKAY or FAIL');
            }
        });
    }
}
