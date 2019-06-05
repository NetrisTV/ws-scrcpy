import { ServerDeviceConnection, IDevice } from './ServerDeviceConnection';

// @ts-ignore
import * as WebsocketBase from '../../node_modules/lws/lib/websocket-base.js';
import * as WebSocket from 'ws';

export = (SocketBase: WebsocketBase) => {
    return class Websocket extends SocketBase {
        private adbPollingPromise: Promise<ServerDeviceConnection> = ServerDeviceConnection.getInstance();

        public async websocket(wss: WebSocket.Server): Promise<void> {
            wss.on('connection', async (ws: WebSocket) => {
                const sendDeviceList = (data: IDevice[]) => {
                    ws.send(JSON.stringify(data));
                };
                const adbPolling = await this.adbPollingPromise;
                sendDeviceList(await adbPolling.getDevices());

                adbPolling.on('update', sendDeviceList);
                ws.on('message', (data: WebSocket.Data) => {
                    ws.send(`message received: ${data.toString()}`);
                });
                ws.on('close', () => {
                    adbPolling.off('update', sendDeviceList);
                });
            });
        }
    };
};
