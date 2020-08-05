export class BaseClient {
    public setTitle(text: string): void {
        let titleTag: HTMLTitleElement | null = document.querySelector('head > title');
        if (!titleTag) {
            titleTag = document.createElement('title');
        }
        titleTag.innerText = text;
    }

    public setBodyClass(text: string): void {
        document.body.className = text;
    }

    public escapeUdid(udid: string): string {
        return 'udid_' + udid.replace(/[. :]/g, '_');
    }
}
