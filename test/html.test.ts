import { describe, expect, it } from 'vitest';
import html from '../src/html';


describe('html', () => {
    describe('html tagged template', () => {
        it('is a function', () => {
            expect(typeof html).toBe('function');
        });

        it('throws when called without compilation', () => {
            expect(() => html`<div>Hello</div>`).toThrow();
        });

        it('throws with appropriate error message', () => {
            expect(() => html`<div>Hello</div>`).toThrow(/vite-plugin/i);
        });
    });

    describe('html.reactive', () => {
        it('is a function', () => {
            expect(typeof html.reactive).toBe('function');
        });

        it('throws when called without compilation', () => {
            expect(() => html.reactive([] as unknown[], () => document.createDocumentFragment())).toThrow();
        });

        it('throws with appropriate error message', () => {
            expect(() => html.reactive([] as unknown[], () => document.createDocumentFragment())).toThrow(/vite-plugin/i);
        });
    });
});
