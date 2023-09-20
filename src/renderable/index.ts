import { Template } from '~/types';
import analyze from './analyze';


class Renderable {
    #slots?: ReturnType< typeof analyze >;
    #template = document.createElement('template');

    readonly expressions?: unknown[];
    readonly html: string;


    constructor(data: Template) {
        this.expressions = data.expressions;
        this.html = data.html;

        if (data.html) {
            this.#template.innerHTML = data.html;
            this.#template.normalize();
        }
    }


    get nodes() {
        return Array.from(
            this.#template.content.cloneNode(true).childNodes
        );
    }

    get slots() {
        if (this.#slots === undefined) {
            this.#slots = analyze(this);
        }

        return this.#slots;
    }
}


export default (data: Template) => {
    return new Renderable(data);
};
export { Renderable };