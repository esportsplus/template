import { describe, expect, it } from 'vitest';
import {
    ARRAY_SLOT,
    ATTRIBUTE_DELIMITERS,
    CLEANUP,
    DIRECT_ATTACH_EVENTS,
    LIFECYCLE_EVENTS,
    PACKAGE_NAME,
    SLOT_HTML,
    STORE
} from '../src/constants';


describe('constants', () => {
    describe('Symbols', () => {
        it('ARRAY_SLOT is a Symbol', () => {
            expect(typeof ARRAY_SLOT).toBe('symbol');
        });

        it('CLEANUP is a Symbol', () => {
            expect(typeof CLEANUP).toBe('symbol');
        });

        it('STORE is a Symbol', () => {
            expect(typeof STORE).toBe('symbol');
        });

        it('Symbols are unique', () => {
            expect(ARRAY_SLOT).not.toBe(CLEANUP);
            expect(ARRAY_SLOT).not.toBe(STORE);
            expect(CLEANUP).not.toBe(STORE);
        });
    });

    describe('ATTRIBUTE_DELIMITERS', () => {
        it('has class delimiter as space', () => {
            expect(ATTRIBUTE_DELIMITERS.class).toBe(' ');
        });

        it('has style delimiter as semicolon', () => {
            expect(ATTRIBUTE_DELIMITERS.style).toBe(';');
        });
    });

    describe('DIRECT_ATTACH_EVENTS', () => {
        it('is a Set', () => {
            expect(DIRECT_ATTACH_EVENTS).toBeInstanceOf(Set);
        });

        it('contains blur events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('blur')).toBe(true);
        });

        it('contains focus events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('focus')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('focusin')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('focusout')).toBe(true);
        });

        it('contains media events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('play')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('pause')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('ended')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('timeupdate')).toBe(true);
        });

        it('contains form events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('submit')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('reset')).toBe(true);
        });

        it('contains error and load events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('error')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('load')).toBe(true);
        });

        it('contains mouse enter/leave events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('mouseenter')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('mouseleave')).toBe(true);
        });

        it('contains non-bubbling events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('pointerenter')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('pointerleave')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('toggle')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('invalid')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('close')).toBe(true);
        });

        it('contains scroll event', () => {
            expect(DIRECT_ATTACH_EVENTS.has('scroll')).toBe(true);
        });

        it('does not contain delegatable events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('click')).toBe(false);
            expect(DIRECT_ATTACH_EVENTS.has('keydown')).toBe(false);
        });
    });

    describe('LIFECYCLE_EVENTS', () => {
        it('is a Set', () => {
            expect(LIFECYCLE_EVENTS).toBeInstanceOf(Set);
        });

        it('contains onconnect', () => {
            expect(LIFECYCLE_EVENTS.has('onconnect')).toBe(true);
        });

        it('contains ondisconnect', () => {
            expect(LIFECYCLE_EVENTS.has('ondisconnect')).toBe(true);
        });

        it('contains onfirstpaint', () => {
            expect(LIFECYCLE_EVENTS.has('onfirstpaint')).toBe(true);
        });

        it('contains ontick', () => {
            expect(LIFECYCLE_EVENTS.has('ontick')).toBe(true);
        });

        it('does not contain standard DOM events', () => {
            expect(LIFECYCLE_EVENTS.has('onclick')).toBe(false);
            expect(LIFECYCLE_EVENTS.has('onsubmit')).toBe(false);
        });
    });

    describe('PACKAGE_NAME', () => {
        it('is @esportsplus/template', () => {
            expect(PACKAGE_NAME).toBe('@esportsplus/template');
        });
    });

    describe('SLOT_HTML', () => {
        it('is a comment marker', () => {
            expect(SLOT_HTML).toBe('<!--$-->');
        });
    });
});
