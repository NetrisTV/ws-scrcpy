import { Client } from './Client';
import { Message } from '../common/Message';
import { Filters, FiltersJoin, LogcatServiceMessage, TextFilter } from '../common/LogcatMessage';
import { AdbKitLogcatEntry } from '../common/AdbKitLogcat';
import { ParsedUrlQueryInput } from 'querystring';
import { ACTION, Fields, LogsFilter, PriorityLevel } from '../server/LogsFilter';

const MAX = 1000;

const CLIENT_FILTER_CLASSNAME = 'client-filter';
const PRIORITY_LEVELS = ['', '', 'VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'SILENT'];
const FILTER_TYPE = ['Tag', 'Message', 'PID', 'TID', 'Priority'];
const SELECT_FIELD_ID = 'selectFilterField';
const SELECT_PRIORITY_ID = 'selectFilterPriority';
const INPUT_TEXT_ID = 'inputFilterText';

export interface LogsParams extends ParsedUrlQueryInput {
    action: 'logcat';
    udid: string;
}

export class ClientLogsProxy extends Client {
    public static readonly defaultPriority: PriorityLevel = PriorityLevel.ERROR;
    public static ACTION: string = 'logcat';
    public static start(params: LogsParams): ClientLogsProxy {
        return new ClientLogsProxy(params.action, params.udid);
    }
    private readonly escapedUdid: string;
    private cache: AdbKitLogcatEntry[] = [];
    private entryToRowMap: WeakMap<AdbKitLogcatEntry, Element> = new WeakMap<AdbKitLogcatEntry, Element>();
    private rowToEntryMap: WeakMap<Element, AdbKitLogcatEntry> = new WeakMap<Element, AdbKitLogcatEntry>();
    private filters: Filters = {
        priority: ClientLogsProxy.defaultPriority
    };

    constructor(action: string, private readonly udid: string) {
        super(action);
        this.ws.onopen = this.onSocketOpen.bind(this);
        this.escapedUdid = ClientLogsProxy.escapeUdid(udid);
        document.body.className = 'flex';
        this.setTitle(`Logcat ${udid}`);
        this.createFilterInputs();
        ClientLogsProxy.getOrCreateTbody(this.escapedUdid);
        this.buildFiltersButtons(CLIENT_FILTER_CLASSNAME);
    }
    protected onSocketOpen = (): void => {
        this.startLogcat(this.udid);
    };

    protected onSocketClose(e: CloseEvent): void {
        console.log(`Connection closed: ${e.reason}`);
    }

    protected onSocketMessage(e: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(e.data);
        } catch (error) {
            console.error(error.message);
            console.log(e.data);
            return;
        }
        if (message.type !== ClientLogsProxy.ACTION) {
            console.log(`Unknown message type: ${message.type}`);
            return;
        }
        const logcatMessage: LogcatServiceMessage = message.data as LogcatServiceMessage;
        if (logcatMessage.type === 'error') {
            console.error(JSON.stringify(logcatMessage.event));
        } else if (logcatMessage.type === 'entry') {
            this.appendLog(logcatMessage);
        } else {
            console.log(JSON.stringify(logcatMessage));
        }
    }

    private onClickFilterButtons(ev: MouseEvent): void {
        if (!ev || !ev.target) {
            return;
        }
        const e: Element = ev.target as Element;
        const type = e.getAttribute('data-filter');
        const text = e.getAttribute('data-text');
        const priorityText = e.getAttribute('data-priority');
        const priority = (priorityText ? parseInt(priorityText, 10) : 0) as PriorityLevel;
        if (typeof type !== 'string' || typeof text !== 'string') {
            return;
        }
        let updated = false;
        if (type === Fields.Priority) {
            if (this.filters.priority === priority) {
                this.filters.priority = ClientLogsProxy.defaultPriority;
                updated = true;
            }
        } else {
            updated = LogsFilter.updateFilter(ACTION.REMOVE, priority, text, type, this.filters);
        }
        if (updated) {
            this.applyFilters();
            this.buildFiltersButtons(CLIENT_FILTER_CLASSNAME);
        }
    }

    public startLogcat(name: string): void {
        if (!name || !this.ws || this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        const message: Message = {
            id: 1,
            type: 'logcat',
            data: {
                type: 'start',
                udid: name
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    private static padNum(number: number): string {
        if (number < 10) {
            return '0' + number;
        }
        return '' + number;
    }

    private static formatDate(date: Date): string {
        const mo = date.getMonth();
        const da = date.getDate();
        const ho = date.getHours();
        const mi = date.getMinutes();
        const se = date.getSeconds();
        const ms = (date.getMilliseconds() * 100).toString().substr(0, 3);
        return `${this.padNum(mo)}-${this.padNum(da)} ${this.padNum(ho)}:${this.padNum(mi)}:${this.padNum(se)}.${ms}`;
    }

    private createFilterInputs(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'controls-add-filter';
        const parag = document.createElement('p');
        const label = document.createElement('label');
        const cInputId = INPUT_TEXT_ID;
        label.setAttribute('for', cInputId);
        label.innerText = 'Add filter:';
        parag.append(label);
        const selectField = document.createElement('select');
        selectField.id = SELECT_FIELD_ID;
        FILTER_TYPE.forEach(type => {
            const option = document.createElement('option');
            option.value = type.toLowerCase();
            option.innerText = type;
            selectField.append(option);
        });
        parag.append(selectField);
        const selectPriority = document.createElement('select');
        selectPriority.id = SELECT_PRIORITY_ID;
        PRIORITY_LEVELS.forEach((level: string, idx: number) => {
            if (!level) {
                return;
            }
            const option = document.createElement('option');
            option.value = idx.toString();
            option.innerText = level;
            selectPriority.append(option);
            if (idx === PriorityLevel.VERBOSE) {
                option.selected = true;
            }
        });
        parag.append(selectPriority);

        const input = document.createElement('input');
        input.id = cInputId;
        parag.append(input);
        selectField.onchange = () => {
            if (selectField.options[selectField.selectedIndex].value.toLowerCase() === Fields.Priority) {
                input.style.display = 'none';
            } else {
                input.style.display = 'initial';
            }
        };
        const buttonToClient = document.createElement('button');
        buttonToClient.id = 'cFilterButton';
        buttonToClient.className = 'button-add-filter button-add-filter-client';
        buttonToClient.innerText = 'to client';
        buttonToClient.onclick = () => {
            const type = FILTER_TYPE[selectField.selectedIndex].toLowerCase();
            const priority = LogsFilter.priorityFromName(selectPriority.selectedOptions[0].text);
            this.addFilter(type, input.value.trim(), priority);
            input.value = '';
        };
        parag.append(buttonToClient);
        // const buttonToServer = document.createElement('button');
        // buttonToServer.id = 'sFilterButton';
        // buttonToServer.className = 'button-add-filter button-add-filter-server';
        // buttonToServer.innerText = 'to server';
        // buttonToServer.onclick = () => {
        //     console.error('Not implemented');
        //     input.value = '';
        // };
        // parag.append(buttonToServer);
        wrapper.append(parag);
        document.body.append(wrapper);
    }

    private addFilter(type: string, input: string, priority: PriorityLevel): void {
        let updated: boolean = false;
        if (type === Fields.Priority) {
            if (this.filters.priority !== priority) {
                this.filters.priority = priority;
                updated = true;
            }
        } else {
            if  (!input) {
                return;
            }
            updated = LogsFilter.updateFilter(ACTION.ADD, priority, input, type, this.filters);
        }

        if (updated) {
            this.applyFilters();
            this.buildFiltersButtons(CLIENT_FILTER_CLASSNAME);
        }
    }

    private buildFiltersButtons(className: string): void {
        const p = this.filters.priority;
        const list: Element[] = [
            ClientLogsProxy.createFilterButton(Fields.Priority, className, '', p)
        ];
        const buttons = this.getOrCreateButtonsWrapper();
        ClientLogsProxy.createButtonsForFilter(Fields.PID, className, list, this.filters.pid);
        ClientLogsProxy.createButtonsForFilter(Fields.TID, className, list,  this.filters.tid);
        ClientLogsProxy.createButtonsForFilter(Fields.Tag, className, list,  this.filters.tag);
        ClientLogsProxy.createButtonsForFilter(Fields.Message, className, list,  this.filters.message);
        while (buttons.children.length) {
            buttons.removeChild(buttons.children[0]);
        }
        list.forEach(e => {
            buttons.append(e);
        });
    }

    private static createButtonsForFilter(type: Fields, className: string, list: Element[], filter?: FiltersJoin): void {
        if (!filter) {
            return;
        }
        if (filter instanceof Map) {
            for (const [value, priority] of filter.entries()) {
                list.push(ClientLogsProxy.createFilterButton(type, className, value.toString(), priority));
            }
            return;
        }
        filter.forEach((e: TextFilter) => {
            list.push(ClientLogsProxy.createFilterButton(type, className, e.value.toString(), e.priority));
        });
    }

    private static createFilterButton(type: string, className: string, text: string, priority: PriorityLevel): Element {
        const e = document.createElement('div');
        if (text) {
            e.innerText = `${type}: ${text} (${LogsFilter.priorityToLetter(priority)})`;
        } else {
            e.innerText = `${type}: ${LogsFilter.priorityToName(priority)}`;
        }
        e.className = `filter-button filter-${type} ${className}`;
        e.setAttribute('data-filter', type);
        e.setAttribute('data-text', text);
        e.setAttribute('data-priority', priority.toString(10));
        return e;
    }

    private static escapeUdid(udid: string): string {
        return 'udid_' + udid.replace(/[. :]/g, '_');
    }

    private static getOrCreateWrapper(): Element {
        let wrapper = document.getElementById('logcat');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'logcat';
            wrapper.className = 'table-wrapper';
            document.body.append(wrapper);
        }
        return wrapper;
    }

    private getOrCreateButtonsWrapper(): Element {
        let buttons = document.getElementById('buttons');
        if (!buttons) {
            buttons = document.createElement('div');
            buttons.id = 'buttons';
            buttons.className = 'buttons-wrapper';
            if (document.body.children.length) {
                document.body.insertBefore(buttons, document.body.children[0]);
            } else {
                document.body.append(buttons);
            }
            buttons.onclick = this.onClickFilterButtons.bind(this);
        }
        return buttons;
    }

    private static getOrCreateTbody(udid: string): Element {
        const wrapper = this.getOrCreateWrapper();
        let tbody = document.querySelector(`#logcat table#${udid} tbody`);
        if (!tbody) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            ['Date', 'PID', 'TID', 'P', 'Tag', 'Message'].forEach(name => {
                const td = document.createElement('th');
                td.innerText = name;
                td.className = name.toLowerCase();
                headRow.append(td);
            });
            thead.append(headRow);
            table.append(thead);
            tbody = document.createElement('tbody') as HTMLTableSectionElement;
            table.id = udid;
            table.append(tbody);
            table.setAttribute('width', '100%');
            wrapper.append(table);
            tbody.addEventListener('mouseup', () => {
                const selection = window.getSelection();
                const text = selection?.toString().trim();
                if (selection && text) {
                    let el = selection.anchorNode?.parentElement;
                    while (el && el.tagName !== 'TD') {
                        el = el.parentElement;
                    }
                    if (el) {
                        this.prepareAsFilter(el.className, text);
                    }
                }
            });
        }
        return tbody;
    }

    private static prepareAsFilter(type: string, text: string): void {
        const lowerCase = type.toLowerCase();
        const valid = FILTER_TYPE.filter(t => t.toLowerCase() === lowerCase);
        if (valid.length) {
            const selectField = document.getElementById(SELECT_FIELD_ID) as HTMLSelectElement;
            const input = document.getElementById(INPUT_TEXT_ID) as HTMLInputElement;
            if (!selectField || ! input) {
                return;
            }
            const optField = Array.from(selectField.options).filter(o => o.value === type)[0];
            if (!optField) {
                return;
            }
            selectField.selectedIndex = optField.index;
            input.value = text;
            input.style.display = 'initial';
        }
    }

    private applyFilters(): void {
        let count = 0;
        const rows: Element[] = [];
        for (let i = this.cache.length - 1; i >= 0 && count <= MAX; i--) {
            const entry = this.cache[i];
            if (!LogsFilter.filterEvent(this.filters, entry)) {
                continue;
            }
            count++;
            let row = this.entryToRowMap.get(entry);
            if (!row) {
                row = ClientLogsProxy.createRow(entry);
                this.entryToRowMap.set(entry, row);
                this.rowToEntryMap.set(row, entry);
            }
            rows.push(row);
        }
        const tbody = ClientLogsProxy.getOrCreateTbody(this.escapedUdid);
        let l = tbody.children.length;
        for (let i = 0; i < l; i++) {
            const row = tbody.children[i];
            if (!rows.includes(row)) {
                i--;
                tbody.removeChild(row);
                l = tbody.children.length;
                const e = this.rowToEntryMap.get(row);
                if (e) {
                    this.entryToRowMap.delete(e);
                }
                this.rowToEntryMap.delete(row);
            }
        }
        rows.forEach(row => {
            tbody.append(row);
        });
    }

    private static createRow(entry: AdbKitLogcatEntry): Element {
        const row = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.innerText = ClientLogsProxy.formatDate(new Date(entry.date));
        dateTd.className = 'date';
        row.append(dateTd);
        const pid = document.createElement('td');
        pid.innerText = `[${entry.pid}]`;
        pid.className = 'pid';
        row.append(pid);
        const tid = document.createElement('td');
        tid.innerText = `[${entry.tid}]`;
        tid.className = 'tid';
        row.append(tid);
        const priority = document.createElement('td');
        priority.innerText = LogsFilter.priorityToLetter(entry.priority);
        priority.className = 'p';
        row.append(priority);
        const tag = document.createElement('td');
        tag.innerHTML = `<pre class="might-overflow">${entry.tag}</pre>`;
        tag.className = 'tag';
        row.append(tag);
        const message = document.createElement('td');
        message.className = 'message';
        message.innerHTML = `<pre class="might-overflow">${entry.message}</pre>`;
        row.append(message);
        return row;
    }

    private appendLog(logcatMessage: LogcatServiceMessage): void {
        const entry: AdbKitLogcatEntry = logcatMessage.event as AdbKitLogcatEntry;
        this.cache.push(entry);
        if (!LogsFilter.filterEvent(this.filters, entry)) {
            return;
        }
        const tbody = ClientLogsProxy.getOrCreateTbody(ClientLogsProxy.escapeUdid(logcatMessage.udid));
        const row = ClientLogsProxy.createRow(entry);
        if (tbody.children.length) {
            tbody.insertBefore(row, tbody.children[0]);
        } else {
            tbody.append(row);
        }
        this.entryToRowMap.set(entry, row);
        this.rowToEntryMap.set(row, entry);
        while (tbody.children.length > MAX) {
            const last = tbody.children[tbody.children.length - 1];
            tbody.removeChild(last);
            const msg = this.rowToEntryMap.get(last);
            if (msg) {
                this.entryToRowMap.delete(msg);
            }
            this.rowToEntryMap.delete(last);
        }
    }
}
