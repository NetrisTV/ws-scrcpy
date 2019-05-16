import error from "./error";

export default function assert(condition: boolean, message: string) {
    if (!condition) {
        error(message);
        throw new Error(message);
    }
}
