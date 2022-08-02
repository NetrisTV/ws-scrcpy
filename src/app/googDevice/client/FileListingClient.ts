import '../../../style/filelisting.css';
import { ParamsFileListing } from '../../../types/ParamsFileListing';
import { ManagerClient } from '../../client/ManagerClient';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { ACTION } from '../../../common/Action';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import Util from '../../Util';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
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

type Download = {
    receivedBytes: number;
    entry?: Entry;
    progressEl?: HTMLElement;
    anchor?: HTMLElement;
    chunks: Uint8Array[];
    path: string;
    pathToLoadAfter: string;
};
type Upload = { row: HTMLElement; progressEl: HTMLElement; anchor: HTMLElement; timeout: number | null };

enum Foreground {
    Drop = 'drop-target',
    Connect = 'connect',
}

const Message: Record<Foreground, string> = {
    [Foreground.Drop]: 'Drop files here',
    [Foreground.Connect]: 'Connection lost',
};

export class FileListingClient extends ManagerClient<ParamsFileListing, never> implements DragAndPushListener {
    public static readonly ACTION = ACTION.FILE_LISTING;
    public static readonly PARENT_DIR = '..';
    public static readonly PROPERTY_NAME = 'data-name';
    public static readonly PROPERTY_ENTRY_ID = 'data-entry-id';
    public static REMOVE_ROW_TIMEOUT = 2000;

    public static start(params: ParamsFileListing): FileListingClient {
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
    private downloads: Map<Multiplexer, Download> = new Map();
    private uploads: Map<string, Upload> = new Map();
    private tableBody: HTMLElement;
    private channels: Set<Multiplexer> = new Set();
    constructor(params: ParamsFileListing) {
        super(params);
        this.parent = document.body;
        this.serial = this.params.udid;
        this.path = this.params.path;
        this.openNewConnection();
        this.setTitle(`Listing ${this.serial}`);
        this.setBodyClass('file-listing');
        this.name = `${TAG} [${this.serial}]`;
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
        this.tableBody = fragment.getElementById(this.tableBodyId) as HTMLElement;
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
                e.preventDefault();
                e.cancelBubble = true;
                const newPath = path.resolve(this.path, name);
                if (newPath !== this.path) {
                    const entryIdString = e.target.getAttribute(FileListingClient.PROPERTY_ENTRY_ID);
                    let entry: Entry | undefined;
                    let anchor: HTMLElement | undefined;
                    if (entryIdString) {
                        const entryId = parseInt(entryIdString, 10);
                        if (!isNaN(entryId) && this.entries[entryId]) {
                            entry = this.entries[entryId];
                            anchor = e.target;
                        }
                    }
                    this.loadContent(newPath, entry, anchor);
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
            this.addForeground(Foreground.Drop);
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
            this.removeForeground(Foreground.Drop);
        }
        return true;
    }

    public onDrop(): boolean {
        this.enterCount = 0;
        this.removeForeground(Foreground.Drop);
        return true;
    }

    private findOrCreateEntryRow(fileName: string): HTMLElement {
        const row = document.getElementById(`entry-${fileName}`);
        if (row) {
            return row;
        }
        return this.addRow(true, fileName, 'file');
    }

    public onFilePushUpdate(data: PushUpdateParams): void {
        const { fileName, progress, error, message, finished } = data;
        let upload = this.uploads.get(fileName);
        if (!upload || document.getElementById(upload.anchor.id) !== upload.anchor) {
            const row = this.findOrCreateEntryRow(fileName);
            const anchor = row.getElementsByTagName('a')[0];
            if (!anchor.id) {
                anchor.id = `upload_${fileName}`;
            }
            const progressEl = this.appendProgressElement(anchor);
            upload = { row, progressEl, anchor, timeout: null };
            this.uploads.set(fileName, upload);
        }
        const { row, progressEl, anchor } = upload;
        if (error) {
            this.uploads.delete(fileName);
            progressEl.style.width = `100%`;
            progressEl.classList.add('error');
            if (!anchor.classList.contains('error')) {
                anchor.classList.add('error');
                anchor.innerText = `${fileName}. ${message}`;
            }
            if (!upload.timeout) {
                upload.timeout = window.setTimeout(() => {
                    const parent = row.parentElement;
                    if (parent) {
                        parent.removeChild(row);
                        this.reload();
                    }
                }, FileListingClient.REMOVE_ROW_TIMEOUT);
            }
        } else {
            anchor.innerText = `${fileName}. ${message}`;
            progressEl.style.width = `${progress}%`;
        }
        if (finished && !error) {
            this.uploads.delete(fileName);
            this.reload();
        }
    }
    public onError(error: string | Error): void {
        console.error(this.name, 'FIXME: implement', error);
    }

    private addForeground(type: Foreground): void {
        const fragment = html`<div class="foreground ${type}">
            <div class="foreground-message ${type}-message">${Message[type]}</div>
        </div>`.content;
        this.parent.appendChild(fragment);
    }

    private removeForeground(type: Foreground): void {
        const els = this.parent.getElementsByClassName(type);
        Array.from(els).forEach((el) => {
            this.parent.removeChild(el);
        });
    }

    public static parseParameters(params: URLSearchParams): ParamsFileListing {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.FILE_LISTING) {
            throw Error('Incorrect action');
        }
        const pathParam = params.get('path');
        const path = pathParam || '/data/local/tmp';
        return { ...typedParams, action, udid: Util.parseString(params, 'udid', true), path };
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        localUrl.searchParams.set('action', ACTION.MULTIPLEX);
        return localUrl;
    }

    protected onSocketClose(event: CloseEvent): void {
        if (this.filePushHandler) {
            this.filePushHandler.release();
        }
        console.error(this.name, 'socket closed', event.reason);
        this.addForeground(Foreground.Connect);
    }

    protected onSocketMessage(_e: MessageEvent): void {
        // We create separate channel for each request
        // Don't expect any messages on this level
    }

    protected onSocketOpen(): void {
        this.loadContent(this.path);
    }

    protected loadContent(path: string, entry?: Entry, anchor?: HTMLElement, pathToLoadAfter = ''): void {
        if (!this.ws || this.ws.readyState !== this.ws.OPEN || !(this.ws instanceof Multiplexer)) {
            return;
        }
        if (!entry && (this.channels.size || this.uploads.size)) {
            return;
        }
        this.requireClean = true;
        this.requestedPath = path;
        let cmd: string;
        if (!entry) {
            cmd = Protocol.STAT;
        } else if (entry.isFile()) {
            cmd = Protocol.RECV;
        } else {
            cmd = Protocol.LIST;
        }
        const len = Buffer.byteLength(path, 'utf-8');
        const payload = Buffer.alloc(cmd.length + 4 + len);
        let pos = payload.write(cmd, 0);
        pos = payload.writeUInt32LE(len, pos);
        payload.write(path, pos);
        const channel = this.ws.createChannel(payload);
        this.channels.add(channel);
        const download: Download = {
            receivedBytes: 0,
            path,
            entry,
            anchor,
            chunks: [],
            pathToLoadAfter,
        };
        this.downloads.set(channel, download);
        const onMessage = (event: MessageEvent): void => {
            this.handleReply(channel, event);
        };
        const onClose = (): void => {
            this.channels.delete(channel);
            this.downloads.delete(channel);
            channel.removeEventListener('message', onMessage);
            channel.removeEventListener('close', onClose);
        };
        channel.addEventListener('message', onMessage);
        channel.addEventListener('close', onClose);
    }

    protected clean(): void {
        this.tableBody.innerHTML = '';
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

    protected handleReply(channel: Multiplexer, e: MessageEvent): void {
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
                this.addEntry(new Entry(name, mode, size, mtime));
                return;
            case Protocol.DONE:
                this.finishDownload(channel);
                return;
            case Protocol.STAT: {
                const download = this.downloads.get(channel);
                if (!download) {
                    return;
                }
                const stat = data.slice(4);
                const mode = stat.readUInt32LE(0);
                const size = stat.readUInt32LE(4);
                const mtime = stat.readUInt32LE(8);
                const nameString = path.basename(download.path);
                if (mode === 0) {
                    console.error('FIXME: show error in UI');
                    console.error(`Error: no entity "${download.path}"`);
                    this.channels.delete(channel);
                    this.loadContent(tempPath);
                    return;
                }
                const entry = new Entry(nameString, mode, size, mtime);
                let anchor: HTMLElement | undefined;
                let nextPath = '';
                if (!entry.isDirectory()) {
                    nextPath = this.requestedPath = path.dirname(download.path);
                    const row = this.addEntry(entry);
                    anchor = row ? row.getElementsByTagName('a')[0] : undefined;
                }
                this.loadContent(download.path, entry, anchor, nextPath);
                break;
            }
            case Protocol.FAIL:
                const length = data.readUInt32LE(4);
                const message = Util.utf8ByteArrayToString(data.slice(8, 8 + length));
                console.error(TAG, `FAIL: ${message}`);
                return;
            case Protocol.DATA:
                const download = this.downloads.get(channel);
                if (!download) {
                    return;
                }
                download.chunks.push(data.slice(4));
                download.receivedBytes += data.length - 4;
                if (download.anchor) {
                    let progressElement = download.progressEl;
                    if (!progressElement) {
                        progressElement = this.appendProgressElement(download.anchor);
                        download.progressEl = progressElement;
                    }
                    if (download.entry) {
                        const { size } = download.entry;
                        const percent = (download.receivedBytes * 100) / size;
                        progressElement.style.width = `${percent}%`;
                    }
                }
                return;
            default:
                console.error(`Unexpected "${reply}"`);
        }
    }

    protected appendProgressElement(anchor: HTMLElement): HTMLElement {
        const progressElement = document.createElement('span');
        progressElement.className = 'background-progress';
        const parent = anchor.parentElement;
        if (parent) {
            parent.appendChild(progressElement);
        }
        return progressElement;
    }

    protected addEntry(entry: Entry): HTMLElement | undefined {
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
        const type = entry.isDirectory() ? 'dir' : entry.isSymbolicLink() ? 'link' : entry.isFile() ? 'file' : 'else';
        const date = entry.mtime.toLocaleString();
        return this.addRow(false, entry.name, type, entry.size.toString(), date, entryId);
    }

    protected addRow(push: boolean, name: string, typeClass: string, size = '', date = '', entryId = ''): HTMLElement {
        const row = document.createElement('tr');
        row.id = `entry-${name}`;
        row.classList.add('entry-row');
        const nameTd = document.createElement('td');
        nameTd.classList.add('entry-name');
        const link = document.createElement('a');
        link.classList.add('icon', typeClass);
        link.setAttribute(FileListingClient.PROPERTY_NAME, name);
        if (entryId) {
            link.setAttribute(FileListingClient.PROPERTY_ENTRY_ID, entryId);
        }
        link.innerText = name;
        nameTd.appendChild(link);
        row.appendChild(nameTd);
        if (push) {
            nameTd.colSpan = 3;
            link.classList.add('push');
        } else {
            const href = new URL(location.href);
            const hash = new URLSearchParams(href.hash.replace(/^#!/, ''));
            hash.set('path', path.join(this.path, name));
            href.hash = `#!${hash.toString()}`;
            link.href = href.toString();
            const sizeTd = document.createElement('td');
            sizeTd.classList.add('entry-size');
            sizeTd.innerText = size;
            row.appendChild(sizeTd);
            const mtimeTd = document.createElement('td');
            mtimeTd.classList.add('entry-time');
            mtimeTd.innerText = date;
            row.appendChild(mtimeTd);
        }
        if (push || !this.tableBody.children.length) {
            this.tableBody.insertBefore(row, this.tableBody.firstChild);
        } else {
            this.tableBody.appendChild(row);
        }
        return row;
    }

    protected finishDownload(channel: Multiplexer): void {
        const download = this.downloads.get(channel);
        if (!download) {
            return;
        }
        this.downloads.delete(channel);
        const el = download.progressEl;
        if (el) {
            this.cleanProgress(el);
        }
        let name: string;
        if (download.entry && download.entry.isFile()) {
            name = download.entry.name;
        } else {
            // we always should have `download.entry` and never be here
            name = path.basename(this.path);
        }
        if (download.pathToLoadAfter) {
            this.channels.delete(channel);
            this.loadContent(download.pathToLoadAfter);
        }
        const file = new File(download.chunks, name, { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = `${name}`;
        a.click();
    }

    protected cleanProgress(el: HTMLElement): void {
        el.classList.add('finished');
        setTimeout(() => {
            const parent = el.parentElement;
            if (parent) {
                parent.removeChild(el);
            }
        });
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
