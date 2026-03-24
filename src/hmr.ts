let clone = <T extends DocumentFragment | Node>(node: T, deep: boolean = true) => node.cloneNode(deep) as T,
    modules = new Map<string, Map<string, HotTemplate>>(),
    tmpl = typeof document !== 'undefined' ? document.createElement('template') : null;


type HotTemplate = {
    cached: DocumentFragment | undefined;
    factory: () => DocumentFragment;
    html: string;
};


function invalidate(moduleId: string): void {
    let templates = modules.get(moduleId);

    if (!templates) {
        return;
    }

    for (let [, entry] of templates) {
        entry.cached = undefined;
    }
}

function register(moduleId: string, templateId: string, html: string): () => DocumentFragment {
    let entry: HotTemplate = {
        cached: undefined,
        factory: () => {
            if (!entry.cached) {
                let element = tmpl!.cloneNode() as HTMLTemplateElement;

                element.innerHTML = entry.html;
                entry.cached = element.content;
            }

            return clone(entry.cached!, true) as DocumentFragment;
        },
        html
    };

    (modules.get(moduleId) ?? (modules.set(moduleId, new Map()), modules.get(moduleId)!)).set(templateId, entry);

    return entry.factory;
}


const accept = (moduleId: string): void => {
    invalidate(moduleId);
};

const createHotTemplate = (moduleId: string, templateId: string, html: string): () => DocumentFragment => {
    let existing = modules.get(moduleId)?.get(templateId);

    if (existing) {
        existing.cached = undefined;
        existing.html = html;

        return existing.factory;
    }

    return register(moduleId, templateId, html);
};

// Test-only: reset state
const hmrReset = (): void => {
    modules.clear();
};


export { accept, createHotTemplate, hmrReset, modules };
