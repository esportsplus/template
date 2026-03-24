import { describe, expect, it } from 'vitest';
import parser from '../../src/compiler/parser';
import { TYPES } from '../../src/compiler/constants';


describe('compiler/parser', () => {
    describe('parse - static templates', () => {
        it('parses empty template', () => {
            let result = parser.parse(['']);

            expect(result.html).toBe('');
            expect(result.slots).toBeNull();
        });

        it('parses static HTML without slots', () => {
            let result = parser.parse(['<div>Hello World</div>']);

            expect(result.html).toBe('<div>Hello World</div>');
            expect(result.slots).toBeNull();
        });

        it('parses nested static HTML', () => {
            let result = parser.parse(['<div><span><strong>Nested</strong></span></div>']);

            expect(result.html).toBe('<div><span><strong>Nested</strong></span></div>');
            expect(result.slots).toBeNull();
        });

        it('parses multiple sibling elements', () => {
            let result = parser.parse(['<span>One</span><span>Two</span><span>Three</span>']);

            expect(result.html).toContain('<span>One</span>');
            expect(result.html).toContain('<span>Two</span>');
            expect(result.html).toContain('<span>Three</span>');
            expect(result.slots).toBeNull();
        });

        it('trims whitespace', () => {
            let result = parser.parse(['  <div>  Content  </div>  ']);

            expect(result.html).toBe('<div> Content </div>');
        });

        it('collapses multiple whitespace', () => {
            let result = parser.parse(['<div>   Multiple    Spaces   </div>']);

            expect(result.html).toBe('<div> Multiple Spaces </div>');
        });
    });

    describe('parse - node slots', () => {
        it('parses single node slot', () => {
            let result = parser.parse(['<div>', '</div>']);

            expect(result.html).toContain('<!--$-->');
            expect(result.slots).not.toBeNull();
            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Node);
        });

        it('parses multiple node slots', () => {
            let result = parser.parse(['<div>', '</div><span>', '</span>']);

            expect(result.slots!.length).toBe(2);
            expect(result.slots![0].type).toBe(TYPES.Node);
            expect(result.slots![1].type).toBe(TYPES.Node);
        });

        it('generates correct path for root-level slot', () => {
            let result = parser.parse(['<div>', '</div>']);
            let slot = result.slots![0];

            expect(slot.path).toContain('firstChild');
        });

        it('generates correct path for nested slot', () => {
            let result = parser.parse(['<div><span>', '</span></div>']);
            let slot = result.slots![0];

            expect(slot.path.length).toBeGreaterThan(1);
        });

        it('handles slot after text content', () => {
            let result = parser.parse(['<div>Text ', '</div>']);

            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Node);
        });

        it('handles slot before text content', () => {
            let result = parser.parse(['<div>', ' Text</div>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles multiple slots in same element', () => {
            let result = parser.parse(['<div>', ' and ', '</div>']);

            expect(result.slots!.length).toBe(2);
        });
    });

    describe('parse - attribute slots', () => {
        it('parses single attribute slot', () => {
            let result = parser.parse(['<div class="', '"></div>']);

            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Attribute);
        });

        it('parses attribute slot with name', () => {
            let result = parser.parse(['<button onclick="', '">Click</button>']);

            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Attribute);

            let attrSlot = result.slots![0] as { attributes: { names: string[] }; type: TYPES.Attribute };

            expect(attrSlot.attributes.names).toContain('onclick');
        });

        it('parses multiple attribute slots on same element', () => {
            let result = parser.parse(['<div class="', '" id="', '"></div>']);

            expect(result.slots!.length).toBe(1); // Single attribute slot with multiple names
            expect(result.slots![0].type).toBe(TYPES.Attribute);

            let attrSlot = result.slots![0] as { attributes: { names: string[] }; type: TYPES.Attribute };

            expect(attrSlot.attributes.names.length).toBe(2);
        });

        it('parses spread attributes slot', () => {
            let result = parser.parse(['<div ', '></div>']);

            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Attribute);

            let attrSlot = result.slots![0] as { attributes: { names: string[] }; type: TYPES.Attribute };

            expect(attrSlot.attributes.names).toContain(TYPES.Attributes);
        });

        it('parses class attribute with static value', () => {
            let result = parser.parse(['<div class="static ', '"></div>']);
            let attrSlot = result.slots![0] as { attributes: { names: string[]; static: Record<string, string> }; type: TYPES.Attribute };

            expect(attrSlot.attributes.static.class).toContain('static');
        });

        it('parses style attribute with static value', () => {
            let result = parser.parse(['<div style="color: red; ', '"></div>']);
            let attrSlot = result.slots![0] as { attributes: { names: string[]; static: Record<string, string> }; type: TYPES.Attribute };

            // Parser may normalize style values
            expect(attrSlot.attributes.static.style).toContain('color');
            expect(attrSlot.attributes.static.style).toContain('red');
        });

        it('removes event attributes from output HTML', () => {
            let result = parser.parse(['<button onclick="', '">Click</button>']);

            expect(result.html).not.toContain('onclick');
        });
    });

    describe('parse - void elements', () => {
        it('handles input element', () => {
            let result = parser.parse(['<input type="', '">']);

            expect(result.slots!.length).toBe(1);
            expect(result.html).toContain('<input');
        });

        it('handles br element', () => {
            let result = parser.parse(['<div>Before<br>After</div>']);

            expect(result.html).toContain('<br>');
            expect(result.slots).toBeNull();
        });

        it('handles img element', () => {
            let result = parser.parse(['<img src="', '">']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles hr element', () => {
            let result = parser.parse(['<hr><div>', '</div>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles meta element', () => {
            let result = parser.parse(['<meta name="', '">']);

            expect(result.slots!.length).toBe(1);
        });
    });

    describe('parse - SVG elements', () => {
        it('handles SVG container', () => {
            let result = parser.parse(['<svg viewBox="', '"></svg>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles SVG path (self-closing)', () => {
            let result = parser.parse(['<svg><path d="', '"/></svg>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles SVG circle (self-closing)', () => {
            let result = parser.parse(['<svg><circle r="', '"/></svg>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles SVG rect (self-closing)', () => {
            let result = parser.parse(['<svg><rect width="', '"/></svg>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles complex SVG with multiple elements', () => {
            let result = parser.parse([
                '<svg viewBox="0 0 100 100">',
                '<path d="M0,0"/>',
                '<circle r="10"/>',
                '</svg>'
            ]);

            // Each literal pair creates a slot, so 3 slots total
            expect(result.slots!.length).toBe(3);
        });

        it('handles SVG use element', () => {
            let result = parser.parse(['<svg><use href="', '"/></svg>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles SVG with slot after self-closing path', () => {
            let result = parser.parse(['<svg><path d="M0,0"/><text>', '</text></svg>']);

            expect(result.slots!.length).toBe(1);
            expect(result.slots![0].type).toBe(TYPES.Node);
        });
    });

    describe('parse - path generation', () => {
        it('uses firstChild for root level', () => {
            let result = parser.parse(['<div>', '</div>']);
            let slot = result.slots![0];

            expect(slot.path).toContain('firstChild');
        });

        it('uses nextSibling for siblings at root', () => {
            let result = parser.parse(['<span></span><div>', '</div>']);
            let slot = result.slots![0];

            expect(slot.path).toContain('nextSibling');
        });

        it('uses firstElementChild for nested elements', () => {
            let result = parser.parse(['<div><span class="', '"></span></div>']);
            let slot = result.slots![0];

            expect(slot.path).toContain('firstElementChild');
        });

        it('uses nextElementSibling for nested siblings', () => {
            let result = parser.parse(['<div><span></span><button onclick="', '"></button></div>']);
            let slot = result.slots![0];

            expect(slot.path).toContain('nextElementSibling');
        });

        it('generates correct path for deeply nested slot', () => {
            let result = parser.parse(['<div><ul><li><span>', '</span></li></ul></div>']);
            let slot = result.slots![0];

            expect(slot.path.length).toBeGreaterThan(3);
        });
    });

    describe('parse - mixed slots', () => {
        it('handles attribute and node slots on same element', () => {
            let result = parser.parse(['<div class="', '">', '</div>']);

            expect(result.slots!.length).toBe(2);
            expect(result.slots![0].type).toBe(TYPES.Attribute);
            expect(result.slots![1].type).toBe(TYPES.Node);
        });

        it('handles slots on sibling elements', () => {
            let result = parser.parse(['<div>', '</div><span class="', '"></span>']);

            expect(result.slots!.length).toBe(2);
        });

        it('handles complex nested structure with multiple slots', () => {
            let result = parser.parse([
                '<div class="',
                '">',
                '<span onclick="',
                '">',
                '</span>',
                '</div>'
            ]);

            // 5 literals = 4 slot markers + additional structure
            // class slot, node slot after >, onclick slot, node slot after >
            expect(result.slots!.length).toBe(5);
        });
    });

    describe('parse - edge cases', () => {
        it('handles data attributes', () => {
            let result = parser.parse(['<div data-value="', '"></div>']);

            expect(result.slots!.length).toBe(1);

            let attrSlot = result.slots![0] as { attributes: { names: string[] }; type: TYPES.Attribute };

            expect(attrSlot.attributes.names).toContain('data-value');
        });

        it('handles aria attributes', () => {
            let result = parser.parse(['<button aria-label="', '"></button>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles custom element tags', () => {
            let result = parser.parse(['<my-component prop="', '"></my-component>']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles empty attribute value', () => {
            let result = parser.parse(['<input disabled="', '">']);

            expect(result.slots!.length).toBe(1);
        });

        it('handles multiple templates in sequence', () => {
            let result1 = parser.parse(['<div>', '</div>']);
            let result2 = parser.parse(['<span>', '</span>']);

            expect(result1.slots!.length).toBe(1);
            expect(result2.slots!.length).toBe(1);
        });
    });

    describe('parse - comments', () => {
        it('preserves comments in static HTML', () => {
            let result = parser.parse(['<!-- Comment --><div>Content</div>']);

            expect(result.html).toContain('<!-- Comment -->');
        });

        it('handles slot after comment', () => {
            let result = parser.parse(['<!-- Comment --><div>', '</div>']);

            expect(result.slots!.length).toBe(1);
        });
    });

    describe('parse - whitespace handling', () => {
        it('removes excessive whitespace between elements', () => {
            let result = parser.parse(['<div>   </div>   <span>   </span>']);

            expect(result.html).not.toContain('   ');
        });

        it('preserves single space in text content', () => {
            let result = parser.parse(['<div>Hello World</div>']);

            expect(result.html).toContain('Hello World');
        });

        it('handles newlines in template', () => {
            let result = parser.parse([`<div>
                Content
            </div>`]);

            expect(result.html).toContain('Content');
        });
    });

    describe('parse - empty attribute removal', () => {
        it('removes empty attribute values', () => {
            let result = parser.parse(['<div class="', '"></div>']);

            // After slot marker removal, empty class="" should be removed
            expect(result.html).not.toContain('class=""');
        });
    });
});
