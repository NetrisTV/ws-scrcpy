/// <reference types="node" />
import { TcpNetConnectOpts } from 'net';
export interface ClientOptions extends TcpNetConnectOpts {
    bin?: string;
}
