import { Request, Response } from 'express';
import MjpegProxy from 'node-mjpeg-proxy';
import { WdaRunner } from '../appl-device/services/WDARunner';
import { WdaStatus } from '../../common/WdaStatus';

export class MjpegProxyFactory {
    private static instances: Map<string, MjpegProxy> = new Map();
    proxyRequest = async (req: Request, res: Response): Promise<void> => {
        const { udid } = req.params;
        if (!udid) {
            res.destroy();
            return;
        }
        let proxy = MjpegProxyFactory.instances.get(udid);
        if (!proxy) {
            const wda = await WdaRunner.getInstance(udid);
            if (!wda.isStarted()) {
                // FIXME: `wda.start()` should resolve on 'started'
                const startPromise = new Promise((resolve) => {
                    const onStatusChange = ({ status }: { status: WdaStatus }) => {
                        if (status === WdaStatus.STARTED) {
                            wda.off('status-change', onStatusChange);
                            resolve(undefined);
                        }
                    };
                    wda.on('status-change', onStatusChange);
                });
                await wda.start();
                await startPromise;
            }
            const port = wda.mjpegPort;
            const url = `http://127.0.0.1:${port}`;
            proxy = new MjpegProxy(url);
            proxy.on('streamstop', (): void => {
                wda.release();
                MjpegProxyFactory.instances.delete(udid);
            });
            proxy.on('error', (data: { msg: Error; url: string }): void => {
                console.error('msg: ' + data.msg);
                console.error('url: ' + data.url);
            });
            MjpegProxyFactory.instances.set(udid, proxy);
        }
        proxy.proxyRequest(req, res);
    };
}
