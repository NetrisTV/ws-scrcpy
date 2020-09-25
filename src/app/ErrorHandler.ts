export default class ErrorHandler {
    constructor(readonly OnError: (ev: string | Event) => void) {}
}
