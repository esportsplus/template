// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DIRECT_ATTACH_EVENTS, LIFECYCLE_EVENTS } from '../../src/constants';
import parse from '../../src/event/parse';


describe('event/parse', () => {
    it('runs without a DOM, as the compiler does', () => {
        expect(typeof document).toBe('undefined');
        expect(parse('onclick')).toEqual({ event: 'click', once: false, route: 'delegate' });
    });

    it.each(['on', 'On', 'ON'])('rejects %s, pointing to onconnect', (key) => {
        expect(() => parse(key as `on${string}`)).toThrow(`@esportsplus/template: '${key}' is not an attribute; bind listeners through onconnect's second argument`);
    });

    it.each([...LIFECYCLE_EVENTS])('%s is a hook, in any case', (key) => {
        for (let name of [key, 'on' + key.slice(2).toUpperCase(), 'on' + key[2].toUpperCase() + key.slice(3)]) {
            expect(parse(name as `on${string}`)).toEqual({ event: null, once: false, route: key });
        }
    });

    it('reads a once-prefixed hook name as a once event, not a hook', () => {
        expect(parse('onceconnect')).toEqual({ event: 'connect', once: true, route: 'delegate' });
    });

    it.each([
        ['onclick', 'click'],
        ['onClick', 'click'],
        ['onCLICK', 'click'],
        ['onkeydown', 'keydown'],
        ['onmousedown', 'mousedown'],
        ['ontouchstart', 'touchstart'],
        ['onwheel', 'wheel'],
        ['oncustom', 'custom'],
        ['onchange', 'change'],
        ['ondblclick', 'dblclick'],
        ['ondrag', 'drag'],
        ['ondrop', 'drop']
    ])('delegates %s as %s', (key, event) => {
        expect(parse(key as `on${string}`)).toEqual({ event, once: false, route: 'delegate' });
    });

    it.each([...DIRECT_ATTACH_EVENTS])('attaches %s directly, once or not', (event) => {
        expect(parse(`on${event}`)).toEqual({ event, once: false, route: 'direct' });
        expect(parse(`once${event}`)).toEqual({ event, once: true, route: 'direct' });
        expect(parse(`on${event.toUpperCase()}`)).toEqual({ event, once: false, route: 'direct' });
    });

    // 'cancel' starts with 'ca', not the once prefix 'ce'
    it('does not read oncancel as a once key', () => {
        expect(parse('oncancel')).toEqual({ event: 'cancel', once: false, route: 'direct' });
        expect(parse('oncecancel')).toEqual({ event: 'cancel', once: true, route: 'direct' });
    });

    it.each([
        ['onceclick', 'click'],
        ['onceClick', 'click'],
        ['onCeClick', 'click'],
        ['onCEKEYDOWN', 'keydown'],
        ['oncewheel', 'wheel']
    ])('delegates %s once as %s', (key, event) => {
        expect(parse(key as `on${string}`)).toEqual({ event, once: true, route: 'delegate' });
    });

    it.each([
        ['ondocumentkeydown', 'keydown', false],
        ['onDocumentKeyDown', 'keydown', false],
        ['onDOCUMENTKEYDOWN', 'keydown', false],
        ['ondocumentfocus', 'focus', false],
        ['ondocumentvisibilitychange', 'visibilitychange', false],
        ['ondocumentdomcontentloaded', 'domcontentloaded', false],
        ['oncedocumentkeydown', 'keydown', true],
        ['onceDocumentKeyDown', 'keydown', true],
        ['onCEDOCUMENTCLICK', 'click', true]
    ])('binds %s on the document as %s', (key, event, once) => {
        expect(parse(key as `on${string}`)).toEqual({ event, once, route: 'ondocument' });
    });

    it.each([
        ['onwindowresize', 'resize', false],
        ['onWindowResize', 'resize', false],
        ['onwindowfocus', 'focus', false],
        ['onwindowscroll', 'scroll', false],
        ['onwindowstorage', 'storage', false],
        ['oncewindowload', 'load', true],
        ['onceWindowResize', 'resize', true],
        ['onCeWindowMessage', 'message', true]
    ])('binds %s on the window as %s', (key, event, once) => {
        expect(parse(key as `on${string}`)).toEqual({ event, once, route: 'onwindow' });
    });

    it.each([
        ['ondomcontentloaded', 'domcontentloaded'],
        ['onDOMContentLoaded', 'domcontentloaded'],
        ['ondoc', 'doc'],
        ['ondocked', 'docked'],
        ['onwi', 'wi'],
        ['onwiggle', 'wiggle'],
        ['onwindo', 'windo']
    ])('delegates %s as %s: only a whole document or window prefix names a host', (key, event) => {
        expect(parse(key as `on${string}`)).toEqual({ event, once: false, route: 'delegate' });
    });

    it('reads a custom event spelled with a whole host prefix as that host', () => {
        expect(parse('ondocumentation')).toEqual({ event: 'ation', once: false, route: 'ondocument' });
        expect(parse('onwindowpane')).toEqual({ event: 'pane', once: false, route: 'onwindow' });
    });

    it('reads a custom event starting with ce as a once key', () => {
        expect(parse('oncellchange')).toEqual({ event: 'llchange', once: true, route: 'delegate' });
    });

    it.each([
        ['once', 'delegate'],
        ['ondocument', 'ondocument'],
        ['oncedocument', 'ondocument'],
        ['onwindow', 'onwindow'],
        ['oncewindow', 'onwindow']
    ])('routes the bare prefix %s with an empty event', (key, route) => {
        expect(parse(key as `on${string}`)).toEqual({ event: '', once: key.startsWith('once'), route });
    });

    it.each(['onactivewheel', 'onActiveTouchMove', 'onceactivewheel', 'onCeActiveTouchStart', 'onactive'])('rejects %s', (key) => {
        expect(() => parse(key as `on${string}`)).toThrow(`@esportsplus/template: '${key}' is not an event attribute`);
    });

    it('does not reject active past a host prefix', () => {
        expect(parse('ondocumentactivewheel')).toEqual({ event: 'activewheel', once: false, route: 'ondocument' });
    });

    it('returns a fresh result each call', () => {
        let a = parse('onclick'),
            b = parse('onclick');

        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });
});
