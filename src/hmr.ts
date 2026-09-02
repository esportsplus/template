import { template } from './utilities';


type HotTemplate = {
    factory: () => DocumentFragment;
    html: string;
    template: () => DocumentFragment;
};


let modules = new Map<string, Map<string, HotTemplate>>();


const accept = (moduleId: string): void => {
    let templates = modules.get(moduleId);

    if (!templates) {
        return;
    }

    for (let [, entry] of templates) {
        entry.template = template(entry.html) as () => DocumentFragment;
    }
};

const createHotTemplate = (moduleId: string, templateId: string, html: string): (() => DocumentFragment) => {
    let templates = modules.get(moduleId),
        entry = templates?.get(templateId);

    if (entry) {
        entry.html = html;
        entry.template = template(html) as () => DocumentFragment;

        return entry.factory;
    }

    entry = {
        factory: () => entry!.template(),
        html,
        template: template(html) as () => DocumentFragment
    };

    if (!templates) {
        templates = new Map();
        modules.set(moduleId, templates);
    }

    templates.set(templateId, entry);

    return entry.factory;
};


export { accept, createHotTemplate };
