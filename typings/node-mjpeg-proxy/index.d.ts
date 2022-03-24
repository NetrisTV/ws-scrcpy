import { Request, Response } from 'express';
import { EventEmitter } from 'events';

declare class MjpegProxy extends EventEmitter {
    constructor(mjpegUrl: string);
    proxyRequest(req: Request, res: Response): void;
}


export = MjpegProxy;
