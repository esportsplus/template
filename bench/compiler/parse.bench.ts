import { bench, describe } from 'vitest';
import parser from '../../src/compiler/parser';


const ELEMENTS = 50;


// One literal per slot boundary: `parse` receives the template's literals exactly as the tagged
// template hands them over, so each shape below differs only in the text abutting its markers
function build(n: number, head: string, tail: string): string[] {
    let literals: string[] = [];

    for (let i = 0; i < n; i++) {
        literals.push((i === 0 ? '<div>' : '') + head);
        literals.push(tail);
    }

    literals[literals.length - 1] += '</div>';

    return literals;
}


const SLOT = build(ELEMENTS, '<span class="', '">x</span>');

const SLOT_PREFIXED = build(ELEMENTS, '<span class="row row--', '">x</span>');

const SLOT_STYLE = build(ELEMENTS, '<span style="color: red; width: ', 'px">x</span>');

const SLOT_SUFFIXED = build(ELEMENTS, '<a href="/users/', '/edit">x</a>');


describe('compiler/parser — parse (50 elements, one attribute slot each)', () => {
    bench('slot owns the whole value', () => {
        parser.parse(SLOT);
    });

    bench('prefixed class token', () => {
        parser.parse(SLOT_PREFIXED);
    });

    bench('prefix and suffix around a property value', () => {
        parser.parse(SLOT_SUFFIXED);
    });

    bench('prefix and suffix inside a style declaration', () => {
        parser.parse(SLOT_STYLE);
    });
});
