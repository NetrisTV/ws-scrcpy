import '../../../style/filelisting.css';
import { ParamsFileListing } from '../../../types/ParamsFileListing';
import { ManagerClient } from '../../client/ManagerClient';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { ACTION } from '../../../common/Action';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { ParsedUrlQuery } from 'querystring';
import Util from '../../Util';
import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';
import { Entry } from '../Entry';
import { html } from '../../ui/HtmlTag';
import * as path from 'path';
import { ChannelCode } from '../../../common/ChannelCode';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import FilePushHandler, { DragAndPushListener, PushUpdateParams } from '../filePush/FilePushHandler';
import { AdbkitFilePushStream } from '../filePush/AdbkitFilePushStream';

const TAG = '[FileListing]';

const parentDirLinkBox = 'parentDirLinkBox';
const rootDirLinkBox = 'rootDirLinkBox';
const tempDirLinkBox = 'tempDirLinkBox';
const storageDirLinkBox = 'storageDirLinkBox';

const rootPath = '/';
const tempPath = '/data/local/tmp';
const storagePath = '/storage';

export class FileListingClient extends ManagerClient<ParamsFileListing, never> implements DragAndPushListener {
    public static readonly ACTION = ACTION.FILE_LISTING;
    public static readonly PARENT_DIR = '..';
    public static readonly PROPERTY_NAME = 'data-name';
    public static readonly PROPERTY_ENTRY_ID = 'data-entry-id';

    public static start(params: ParsedUrlQuery): FileListingClient {
        return new FileListingClient(params);
    }

    public static createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('file-listing', blockClass);
        entry.appendChild(
            BaseDeviceTracker.buildLink(
                {
                    action: ACTION.FILE_LISTING,
                    udid: descriptor.udid,
                    path: `${tempPath}/`,
                },
                'list files',
                params,
            ),
        );
        return entry;
    }

    private readonly serial: string;
    private readonly name: string;
    private readonly tableBodyId: string;
    private readonly wrapperId: string;
    private readonly filePushHandler?: FilePushHandler;
    private readonly parent: HTMLElement;
    private enterCount = 0;
    private entries: Entry[] = [];
    private path: string;
    private requireClean = false;
    private requestedPath = '';
    private requestedEntry?: Entry;
    private chunks: Uint8Array[] = [];
    private channel?: Multiplexer;
    private nextPath?: string;
    constructor(params: ParsedUrlQuery) {
        super(params);
        this.parent = document.body;
        this.serial = this.params.udid;
        this.path = this.params.path;
        this.openNewConnection();
        this.setTitle(`Listing ${this.serial}`);
        this.setBodyClass('file-listing');
        this.name = `[${TAG}] ${this.serial}`;
        this.tableBodyId = `${Util.escapeUdid(this.serial)}_list`;
        this.wrapperId = `wrapper_${this.tableBodyId}`;
        const fragment = html`<div id="${this.wrapperId}" class="listing">
            <h1 id="header">Contents ${this.path}</h1>
            <div id="${parentDirLinkBox}" class="quick-link-box">
                <a class="icon up" href="#!" ${FileListingClient.PROPERTY_NAME}=".."> [parent] </a>
            </div>
            <div id="${rootDirLinkBox}" class="quick-link-box">
                <a class="icon dir" href="#!" ${FileListingClient.PROPERTY_NAME}="${rootPath}"> [root] </a>
            </div>
            <div id="${storageDirLinkBox}" class="quick-link-box">
                <a class="icon dir" href="#!" ${FileListingClient.PROPERTY_NAME}="${storagePath}/"> [storage] </a>
            </div>
            <div id="${tempDirLinkBox}" class="quick-link-box">
                <a class="icon dir" href="#!" ${FileListingClient.PROPERTY_NAME}="${tempPath}/"> [temp] </a>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>MTime</th>
                    </tr>
                </thead>
                <tbody id="${this.tableBodyId}"></tbody>
            </table>
        </div>`.content;
        const wrapper = fragment.getElementById(this.wrapperId);
        if (wrapper) {
            wrapper.addEventListener('click', (e) => {
                if (!e.target || !(e.target instanceof HTMLElement)) {
                    return;
                }
                const name = e.target.getAttribute(FileListingClient.PROPERTY_NAME);
                if (!name) {
                    return;
                }
                const newPath = path.resolve(this.path, name);
                e.preventDefault();
                e.cancelBubble = true;
                if (newPath !== this.path) {
                    const entryIdString = e.target.getAttribute(FileListingClient.PROPERTY_ENTRY_ID);
                    if (entryIdString) {
                        const entryId = parseInt(entryIdString, 10);
                        if (!isNaN(entryId) && this.entries[entryId]) {
                            this.requestedEntry = this.entries[entryId];
                        }
                    }
                    this.loadContent(newPath);
                }
            });

            if (this.ws instanceof Multiplexer) {
                this.filePushHandler = new FilePushHandler(this.parent, new AdbkitFilePushStream(this.ws, this));
                this.filePushHandler.addEventListener(this);
            }
        }
        this.parent.appendChild(fragment);
    }

    public onDragEnter(): boolean {
        if (this.enterCount === 0) {
            this.addDropTarget();
        }
        this.enterCount++;
        return true;
    }
    public onDragLeave(): boolean {
        this.enterCount--;
        if (this.enterCount < 0) {
            this.enterCount = 0;
        }
        if (this.enterCount === 0) {
            this.removeDropTarget();
        }
        return true;
    }
    public onDrop(): boolean {
        this.removeDropTarget();
        return true;
    }
    public onFilePushUpdate(data: PushUpdateParams): void {
        console.log(TAG, 'FIXME: implement', 'onFilePushUpdate', data);
    }
    public onError(error: string | Error): void {
        console.error(TAG, 'FIXME: implement', error);
    }

    private addDropTarget(): void {
        const fragment = html`<div class="drop-target">
            <div class="drop-target-message">Drop files here</div>
        </div>`.content;
        this.parent.appendChild(fragment);
    }

    private removeDropTarget(): void {
        const els = this.parent.getElementsByClassName('drop-target');
        Array.from(els).forEach((el) => {
            this.parent.removeChild(el);
        });
    }

    public parseParameters(params: ParsedUrlQuery): ParamsFileListing {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.FILE_LISTING) {
            throw Error('Incorrect action');
        }
        const path = params.path ? (Array.isArray(params.path) ? params.path[0] : params.path) : '/data/local/tmp';
        return { ...typedParams, action, udid: Util.parseStringEnv(params.udid), path };
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        localUrl.searchParams.set('action', ACTION.MULTIPLEX);
        return localUrl;
    }

    protected onSocketClose(e: CloseEvent): void {
        if (this.filePushHandler) {
            this.filePushHandler.release();
        }
        console.log(this.name, 'socket closed', e.reason);
    }

    protected onSocketMessage(_e: MessageEvent): void {
        // We create separate channel for each request
        // Don't expect any messages on this level
    }

    protected onSocketOpen(): void {
        this.loadContent(this.path);
    }

    protected loadContent(path: string): void {
        if (!this.ws || this.ws.readyState !== this.ws.OPEN || !(this.ws instanceof Multiplexer)) {
            return;
        }
        if (this.channel) {
            this.nextPath = path;
            return;
        }
        this.requireClean = true;
        this.requestedPath = path;
        const cmd = Protocol.LIST;
        const len = Buffer.byteLength(path, 'utf-8');
        const payload = new Buffer(cmd.length + 4 + len);
        let pos = payload.write(cmd, 0);
        pos = payload.writeUInt32LE(len, pos);
        payload.write(path, pos);
        const channel = (this.channel = this.ws.createChannel(payload));
        const onMessage = (e: MessageEvent): void => {
            this.handleReply(e);
        };
        const onClose = (): void => {
            this.channel = undefined;
            channel.removeEventListener('message', onMessage);
            channel.removeEventListener('close', onClose);
            const nextPath = this.nextPath;
            if (nextPath) {
                this.nextPath = undefined;
                this.loadContent(nextPath);
            }
        };
        channel.addEventListener('message', onMessage);
        channel.addEventListener('close', onClose);
    }

    protected clean(): void {
        const tbody = document.getElementById(this.tableBodyId);
        if (tbody) {
            tbody.innerHTML = '';
        }
        const header = document.getElementById('header');
        if (header) {
            header.innerText = `Content ${this.path}`;
        }
        this.toggleQuickLinks(this.path);

        // FIXME: should do over way around: load content on hash change
        const hash = location.hash.replace(/#!/, '');
        const params = new URLSearchParams(hash);
        if (params.get('action') === ACTION.FILE_LISTING) {
            params.set('path', this.path);
            location.hash = `#!${params.toString()}`;
        }
    }

    protected toggleQuickLinks(path: string): void {
        const isRoot = path === rootPath;
        const parentEl = document.getElementById(parentDirLinkBox);
        if (parentEl) {
            parentEl.classList.toggle('hidden', isRoot);
        }
        const rootEl = document.getElementById(rootDirLinkBox);
        if (rootEl) {
            rootEl.classList.toggle('hidden', isRoot);
        }
        const isTemp = path === tempPath;
        const tempEl = document.getElementById(tempDirLinkBox);
        if (tempEl) {
            tempEl.classList.toggle('hidden', isTemp);
        }
        const isStorage = path === storagePath;
        const storageEl = document.getElementById(storageDirLinkBox);
        if (storageEl) {
            storageEl.classList.toggle('hidden', isStorage);
        }
    }

    protected handleReply(e: MessageEvent): void {
        const data = Buffer.from(e.data);
        const reply = data.slice(0, 4).toString('ascii');
        switch (reply) {
            case Protocol.DENT:
                const stat = data.slice(4);
                const mode = stat.readUInt32LE(0);
                const size = stat.readUInt32LE(4);
                const mtime = stat.readUInt32LE(8);
                const namelen = stat.readUInt32LE(12);
                const name = Util.utf8ByteArrayToString(stat.slice(16, 16 + namelen));
                this.addRow(new Entry(name, mode, size, mtime));
                return;
            case Protocol.DONE:
                this.finishDownload();
                return;
            case Protocol.FAIL:
                const length = data.readUInt32LE(4);
                const message = Util.utf8ByteArrayToString(data.slice(8, 8 + length));
                console.error(`Error: ${message}`);
                return;
            case Protocol.DATA:
                this.chunks.push(data.slice(4));
                return;
            default:
                console.error(`Unexpected "${reply}"`);
        }
    }

    protected addRow(entry: Entry): void {
        if (this.requireClean) {
            this.path = this.requestedPath;
            this.requestedPath = '';
            this.clean();
            this.requireClean = false;
            this.entries.length = 0;
        }
        this.entries.push(entry);
        const entryId = (this.entries.length - 1).toString();
        if (entry.name === '.') {
            return;
        }
        if (entry.name === FileListingClient.PARENT_DIR) {
            const el = document.getElementById(parentDirLinkBox);
            if (el) {
                const a = el.children[0];
                if (a) {
                    a.setAttribute(FileListingClient.PROPERTY_ENTRY_ID, entryId);
                }
            }
            return;
        }
        const row = document.createElement('tr');
        const nameTd = document.createElement('td');
        const link = document.createElement('a');
        const type = entry.isDirectory() ? 'dir' : entry.isSymbolicLink() ? 'link' : entry.isFile() ? 'file' : 'else';
        link.classList.add('icon', type);
        link.setAttribute(FileListingClient.PROPERTY_NAME, entry.name);
        link.setAttribute(FileListingClient.PROPERTY_ENTRY_ID, entryId);
        const href = new URL(location.href);
        const hash = new URLSearchParams(href.hash.replace(/^#!/, ''));
        hash.set('path', path.join(this.path, entry.name));
        href.hash = `#!${hash.toString()}`;
        link.href = href.toString();
        link.innerText = entry.name;
        nameTd.appendChild(link);
        row.appendChild(nameTd);
        const sizeTd = document.createElement('td');
        sizeTd.innerText = entry.size.toString();
        row.appendChild(sizeTd);
        const mtimeTd = document.createElement('td');
        mtimeTd.innerText = entry.mtime.toLocaleString();
        row.appendChild(mtimeTd);
        document.getElementById(this.tableBodyId)?.appendChild(row);
    }

    protected finishDownload(): void {
        let name: string;
        if (this.requestedEntry && this.requestedEntry.isFile()) {
            name = this.requestedEntry.name;
            this.requestedEntry = undefined;
        } else {
            // Was opened link to a file, get its name and load its parent content
            name = path.basename(this.path);
            this.loadContent(path.dirname(this.path));
        }
        const file = new File(this.chunks, name, { type: 'application/octet-stream' });
        this.chunks.length = 0;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = `${name}`;
        a.click();
    }

    public getPath(): string {
        return this.path;
    }

    public reload(): void {
        this.loadContent(this.path);
    }

    protected supportMultiplexing(): boolean {
        return true;
    }

    protected getChannelInitData(): Buffer {
        const serial = Util.stringToUtf8ByteArray(this.serial);
        const buffer = Buffer.alloc(4 + 4 + serial.byteLength);
        buffer.write(ChannelCode.FSLS, 'ascii');
        buffer.writeUInt32LE(serial.length, 4);
        buffer.set(serial, 8);
        return buffer;
    }
}
