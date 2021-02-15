// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Value = any;

function htmlValue(value: Value): string {
    if (value instanceof HTMLTemplateElement) {
        return value.innerHTML;
    }
    if (typeof value === 'undefined') {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    const e = document.createElement('dummy');
    e.innerText = value.toString();
    return e.innerHTML;
}

export const html = function html(strings: TemplateStringsArray, ...values: ReadonlyArray<Value>): HTMLTemplateElement {
    const template = document.createElement('template') as HTMLTemplateElement;
    template.innerHTML = values.reduce((acc, v, idx) => acc + htmlValue(v) + strings[idx + 1], strings[0]).toString();
    return template;
};
