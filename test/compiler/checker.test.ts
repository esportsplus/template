// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ts } from '@esportsplus/typescript';
import { cached } from '../../src/compiler/checker';


// Test doubles stand in for a checker, so the wrapper is seen through their own loose type
type Fake = Record<string, (...args: unknown[]) => unknown>;


// A stand-in checker: every method returns a fresh object and counts its calls
function fake() {
    let calls: Record<string, number> = {},
        method = (name: string) => (...args: unknown[]) => {
            calls[name] = (calls[name] ?? 0) + 1;

            return { args, name };
        };

    let checker = {
            getDeclaredTypeOfSymbol: method('getDeclaredTypeOfSymbol'),
            getImmediateAliasedSymbol: method('getImmediateAliasedSymbol'),
            getReturnTypeOfSignature: method('getReturnTypeOfSignature'),
            getShorthandAssignmentValueSymbol: method('getShorthandAssignmentValueSymbol'),
            getSignaturesOfType: method('getSignaturesOfType'),
            getSymbolAtLocation: method('getSymbolAtLocation'),
            getTypeArguments: method('getTypeArguments'),
            getTypeAtLocation: method('getTypeAtLocation'),
            isTypeAssignableTo: method('isTypeAssignableTo'),
            resolveName: method('resolveName')
        };

    return { calls, checker: checker as Fake };
}


function wrap(checker: Fake): Fake {
    return cached(checker as unknown as ts.Checker) as unknown as Fake;
}


describe('compiler/checker', () => {
    it.each([
        'getDeclaredTypeOfSymbol',
        'getReturnTypeOfSignature',
        'getShorthandAssignmentValueSymbol',
        'getSignaturesOfType',
        'getSymbolAtLocation',
        'getTypeArguments',
        'getTypeAtLocation',
        'resolveName'
    ])('answers a repeated %s from its cache', (name) => {
        let { calls, checker } = fake(),
            memo = wrap(checker),
            node = {};

        let first = memo[name](node);

        expect(memo[name](node)).toBe(first);
        expect(calls[name]).toBe(1);
        expect(memo[name]({})).not.toBe(first);
        expect(calls[name]).toBe(2);
    });

    it('keys on both arguments', () => {
        let { calls, checker } = fake(),
            memo = wrap(checker),
            a = {},
            b = {},
            c = {};

        let ab = memo.isTypeAssignableTo(a, b);

        expect(memo.isTypeAssignableTo(a, b)).toBe(ab);
        expect(memo.isTypeAssignableTo(a, c)).not.toBe(ab);
        expect(memo.isTypeAssignableTo(b, a)).not.toBe(ab);
        expect(calls.isTypeAssignableTo).toBe(3);
    });

    it('caches a call with one argument apart from the same first argument with a second', () => {
        let { calls, checker } = fake(),
            memo = wrap(checker),
            node = {},
            kind = 1;

        let one = memo.getSignaturesOfType(node),
            two = memo.getSignaturesOfType(node, kind);

        expect(two).not.toBe(one);
        expect(memo.getSignaturesOfType(node, kind)).toBe(two);
        expect(memo.getSignaturesOfType(node)).toBe(one);
        expect(calls.getSignaturesOfType).toBe(2);
    });

    it('answers a call with more than two arguments from the checker every time', () => {
        let { calls, checker } = fake(),
            memo = wrap(checker),
            location = {};

        let first = memo.resolveName('Node', 1, location),
            second = memo.resolveName('Node', 1, location);

        expect(second).not.toBe(first);
        expect(calls.resolveName).toBe(2);

        // A two-argument call is still cached, apart from the bypassed ones
        let cachedCall = memo.resolveName('Node', 1);

        expect(memo.resolveName('Node', 1)).toBe(cachedCall);
        expect(calls.resolveName).toBe(3);
    });

    it('passes other methods and properties through uncached', () => {
        let { calls, checker } = fake(),
            memo = wrap(checker),
            symbol = {};

        memo.getImmediateAliasedSymbol(symbol);
        memo.getImmediateAliasedSymbol(symbol);

        expect(calls.getImmediateAliasedSymbol).toBe(2);
        expect((cached({ label: 'fake' } as unknown as ts.Checker) as unknown as { label: string }).label).toBe('fake');
    });

    it('caches undefined answers', () => {
        let count = 0,
            memo = wrap({ getTypeAtLocation: () => { count++; return undefined; } }),
            node = {};

        expect(memo.getTypeAtLocation(node)).toBeUndefined();
        expect(memo.getTypeAtLocation(node)).toBeUndefined();
        expect(count).toBe(1);
    });

    it('scopes each cache to its own wrapper', () => {
        let { calls, checker } = fake(),
            node = {};

        (wrap(checker)).getTypeAtLocation(node);
        (wrap(checker)).getTypeAtLocation(node);

        expect(calls.getTypeAtLocation).toBe(2);
    });

    it('binds methods to the underlying checker', () => {
        let checker = {
                self: null as unknown,
                getTypeAtLocation(this: { self: unknown }) {
                    this.self = this;

                    return 1;
                }
            },
            memo = wrap(checker as unknown as Fake);

        memo.getTypeAtLocation({});

        expect(checker.self).toBe(checker);
    });
});
