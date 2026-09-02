import { describe, expect, it } from 'vitest';
import { accept, createHotTemplate } from '../src/hmr';


describe('hmr', () => {
    describe('createHotTemplate', () => {
        it('creates a fragment from markup', () => {
            let factory = createHotTemplate('create', 'template', '<div>hello</div>');

            expect(factory().firstElementChild?.outerHTML).toBe('<div>hello</div>');
        });

        it('keeps a factory current when a template is replaced', () => {
            let factory = createHotTemplate('replace', 'template', '<div>old</div>');

            createHotTemplate('replace', 'template', '<span>new</span>');

            expect(factory().firstElementChild?.outerHTML).toBe('<span>new</span>');
        });

        it('returns the same factory for a replacement', () => {
            let first = createHotTemplate('identity', 'template', '<div>old</div>'),
                second = createHotTemplate('identity', 'template', '<div>new</div>');

            expect(second).toBe(first);
        });
    });

    describe('accept', () => {
        it('keeps updated factories usable', () => {
            let factory = createHotTemplate('accept', 'template', '<div>old</div>');

            createHotTemplate('accept', 'template', '<div>new</div>');
            accept('accept');

            expect(factory().firstElementChild?.outerHTML).toBe('<div>new</div>');
        });

        it('accepts unknown modules', () => {
            expect(() => accept('unknown')).not.toThrow();
        });
    });
});
