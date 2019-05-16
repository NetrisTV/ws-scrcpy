export default class Script {
    constructor(public type: string, public source: string) {
    }

    public static createFromElementId(id: string) {
        const script = document.getElementById(id);

        // Didn't find an element with the specified ID, abort.
        if (!script) {
            throw Error("Could not find shader with ID: " + id);
        }

        // Walk through the source element's children, building the shader source string.
        let source = "";
        let currentChild = script.firstChild;
        while (currentChild) {
            if (currentChild.nodeType == 3) {
                source += currentChild.textContent;
            }
            currentChild = currentChild.nextSibling;
        }

        return new Script((<HTMLScriptElement>script).type, source);
    }

    public static createFromSource(type: string, source: string) {
        return new Script(type, source);
    }
}
