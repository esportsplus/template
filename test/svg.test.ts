import { describe, expect, it } from 'vitest';
import svg from '../src/svg';


describe('svg', () => {
    describe('svg.sprite', () => {
        it('creates SVG use element', () => {
            let result = svg.sprite('#icon-home');
            let svgElement = result.firstChild as SVGSVGElement;

            expect(svgElement.tagName.toLowerCase()).toBe('svg');
        });

        it('contains use element as child', () => {
            let result = svg.sprite('#icon-home'),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement;

            expect(useElement.tagName.toLowerCase()).toBe('use');
        });

        it('sets href attribute on use element', () => {
            let result = svg.sprite('#icon-home'),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement;

            expect(useElement.getAttribute('href') || useElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#icon-home');
        });

        it('adds # prefix if missing', () => {
            let result = svg.sprite('icon-settings'),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement;

            expect(useElement.getAttribute('href') || useElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#icon-settings');
        });

        it('does not double # prefix', () => {
            let result = svg.sprite('#icon-user'),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement,
                href = useElement.getAttribute('href') || useElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

            expect(href).toBe('#icon-user');
            expect(href).not.toBe('##icon-user');
        });

        it('returns DocumentFragment', () => {
            let result = svg.sprite('#icon');

            expect(result).toBeInstanceOf(DocumentFragment);
        });

        it('creates independent fragments for each call', () => {
            let result1 = svg.sprite('#icon-a'),
                result2 = svg.sprite('#icon-b');

            expect(result1).not.toBe(result2);
            expect(result1.firstChild).not.toBe(result2.firstChild);
        });

        it('handles empty string (adds #)', () => {
            let result = svg.sprite(''),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement;

            expect(useElement.getAttribute('href') || useElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#');
        });

        it('handles complex icon names', () => {
            let result = svg.sprite('#my-app-icon-arrow-left-circle'),
                svgElement = result.firstChild as SVGSVGElement,
                useElement = svgElement.firstChild as SVGUseElement;

            expect(useElement.getAttribute('href') || useElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#my-app-icon-arrow-left-circle');
        });
    });

    describe('svg template function', () => {
        it('svg is a function', () => {
            expect(typeof svg).toBe('function');
        });

        it('svg has sprite method', () => {
            expect(typeof svg.sprite).toBe('function');
        });

        it('svg throws when called directly (needs compilation)', () => {
            expect(() => svg`<rect/>`).toThrow();
        });
    });
});
