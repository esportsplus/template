import { describe, expect, it } from 'vitest';
import {
    ARRAY_SLOT,
    ATTRIBUTE_DELIMITERS,
    CLEANUP,
    DIRECT_ATTACH_EVENTS,
    LIFECYCLE_EVENTS,
    PACKAGE_NAME,
    SLOT_HTML,
    STATE_HYDRATING,
    STATE_NONE,
    STATE_WAITING,
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
            expect(DIRECT_ATTACH_EVENTS.has('onblur')).toBe(true);
        });

        it('contains focus events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onfocus')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onfocusin')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onfocusout')).toBe(true);
        });

        it('contains media events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onplay')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onpause')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onended')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('ontimeupdate')).toBe(true);
        });

        it('contains form events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onsubmit')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onreset')).toBe(true);
        });

        it('contains error and load events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onerror')).toBe(true);
            expect(DIRECT_ATTACH_EVENTS.has('onload')).toBe(true);
        });

        it('contains scroll event', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onscroll')).toBe(true);
        });

        it('does not contain delegatable events', () => {
            expect(DIRECT_ATTACH_EVENTS.has('onclick')).toBe(false);
            expect(DIRECT_ATTACH_EVENTS.has('onkeydown')).toBe(false);
            expect(DIRECT_ATTACH_EVENTS.has('onmouseenter')).toBe(false);
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

        it('contains onrender', () => {
            expect(LIFECYCLE_EVENTS.has('onrender')).toBe(true);
        });

        it('contains onresize', () => {
            expect(LIFECYCLE_EVENTS.has('onresize')).toBe(true);
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

    describe('State constants', () => {
        it('STATE_HYDRATING is 0', () => {
            expect(STATE_HYDRATING).toBe(0);
        });

        it('STATE_NONE is 1', () => {
            expect(STATE_NONE).toBe(1);
        });

        it('STATE_WAITING is 2', () => {
            expect(STATE_WAITING).toBe(2);
        });

        it('states are distinct', () => {
            expect(STATE_HYDRATING).not.toBe(STATE_NONE);
            expect(STATE_HYDRATING).not.toBe(STATE_WAITING);
            expect(STATE_NONE).not.toBe(STATE_WAITING);
        });
    });
});
