import { describe, expect, it, beforeEach } from 'vitest';
import { accept, createHotTemplate, hmrReset, modules } from '../src/hmr';


describe('hmr', () => {
    beforeEach(() => {
        hmrReset();
    });

    describe('createHotTemplate', () => {
        it('registers a new template and returns a factory', () => {
            let factory = createHotTemplate('mod1', 'tpl1', '<div>hello</div>');

            expect(typeof factory).toBe('function');
            expect(modules.has('mod1')).toBe(true);
            expect(modules.get('mod1')!.has('tpl1')).toBe(true);
        });

        it('factory returns a DocumentFragment clone', () => {
            let factory = createHotTemplate('mod1', 'tpl1', '<div>hello</div>');
            let frag = factory();

            expect(frag).toBeInstanceOf(DocumentFragment);
            expect(frag.firstChild).toBeInstanceOf(HTMLDivElement);
            expect((frag.firstChild as HTMLElement).textContent).toBe('hello');
        });

        it('factory caches the parsed fragment and returns clones', () => {
            let factory = createHotTemplate('mod1', 'tpl1', '<span>test</span>');
            let frag1 = factory(),
                frag2 = factory();

            expect(frag1).not.toBe(frag2);
            expect((frag1.firstChild as HTMLElement).tagName).toBe('SPAN');
            expect((frag2.firstChild as HTMLElement).tagName).toBe('SPAN');
        });

        it('returns existing factory when called with same moduleId and templateId', () => {
            let factory1 = createHotTemplate('mod1', 'tpl1', '<div>v1</div>'),
                factory2 = createHotTemplate('mod1', 'tpl1', '<div>v2</div>');

            expect(factory1).toBe(factory2);
        });

        it('updates html when re-registered with same ids', () => {
            createHotTemplate('mod1', 'tpl1', '<div>v1</div>');
            createHotTemplate('mod1', 'tpl1', '<div>v2</div>');

            let factory = createHotTemplate('mod1', 'tpl1', '<div>v2</div>');
            let frag = factory();

            expect((frag.firstChild as HTMLElement).textContent).toBe('v2');
        });

        it('invalidates cache when html changes', () => {
            let factory = createHotTemplate('mod1', 'tpl1', '<div>old</div>');

            factory(); // populate cache

            createHotTemplate('mod1', 'tpl1', '<div>new</div>');

            let frag = factory();

            expect((frag.firstChild as HTMLElement).textContent).toBe('new');
        });

        it('registers multiple templates per module', () => {
            createHotTemplate('mod1', 'tpl1', '<div>a</div>');
            createHotTemplate('mod1', 'tpl2', '<span>b</span>');

            expect(modules.get('mod1')!.size).toBe(2);
        });

        it('registers templates across different modules', () => {
            createHotTemplate('mod1', 'tpl1', '<div>a</div>');
            createHotTemplate('mod2', 'tpl1', '<div>b</div>');

            expect(modules.size).toBe(2);
        });
    });

    describe('accept', () => {
        it('invalidates all cached templates for a module', () => {
            let factory1 = createHotTemplate('mod1', 'tpl1', '<div>a</div>'),
                factory2 = createHotTemplate('mod1', 'tpl2', '<span>b</span>');

            factory1(); // populate cache
            factory2(); // populate cache

            let entry1 = modules.get('mod1')!.get('tpl1')!,
                entry2 = modules.get('mod1')!.get('tpl2')!;

            expect(entry1.cached).toBeDefined();
            expect(entry2.cached).toBeDefined();

            accept('mod1');

            expect(entry1.cached).toBeUndefined();
            expect(entry2.cached).toBeUndefined();
        });

        it('does not affect templates from other modules', () => {
            let factory1 = createHotTemplate('mod1', 'tpl1', '<div>a</div>'),
                factory2 = createHotTemplate('mod2', 'tpl1', '<div>b</div>');

            factory1();
            factory2();

            let entry2 = modules.get('mod2')!.get('tpl1')!;

            accept('mod1');

            expect(entry2.cached).toBeDefined();
        });

        it('is a no-op for unknown module ids', () => {
            expect(() => accept('nonexistent')).not.toThrow();
        });

        it('after accept, factory produces new fragments from same html', () => {
            let factory = createHotTemplate('mod1', 'tpl1', '<div>content</div>');

            let frag1 = factory();

            accept('mod1');

            let frag2 = factory();

            expect(frag1).not.toBe(frag2);
            expect((frag2.firstChild as HTMLElement).textContent).toBe('content');
        });
    });

    describe('hmrReset', () => {
        it('clears all registered modules', () => {
            createHotTemplate('mod1', 'tpl1', '<div>a</div>');
            createHotTemplate('mod2', 'tpl1', '<div>b</div>');

            expect(modules.size).toBe(2);

            hmrReset();

            expect(modules.size).toBe(0);
        });
    });
});
