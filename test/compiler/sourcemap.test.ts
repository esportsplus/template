import { describe, expect, it } from 'vitest';
import { edit } from '../../src/compiler/sourcemap';


// Segments are [generatedColumn, source, originalLine, originalColumn] VLQ deltas:
// 'AAAA' = [0,0,0,0], 'KAAK' = [+5,0,0,+5], 'AACA' = [0,0,+1,0]
function map(mappings: string) {
    return { mappings, names: [], sources: ['a.ts'], version: 3 as const };
}


describe('compiler/sourcemap', () => {
    describe('edit', () => {
        it('returns code and map untouched without edits', () => {
            let source = map('AAAA,KAAK');

            expect(edit('abcd efgh', source, [])).toEqual({ code: 'abcd efgh', map: source });
        });

        it('shifts segments after an insertion by its length', () => {
            let result = edit('abcd efgh', map('AAAA,KAAK'), [{ end: 5, start: 5, text: 'XY' }]);

            expect(result.code).toBe('abcd XYefgh');
            expect(result.map.mappings).toBe('AAAA,OAAK');
        });

        it('maps a segment inside a replaced range to the replacement start', () => {
            let result = edit('abcd efgh', map('AAAA,KAAK'), [{ end: 4, start: 0, text: 'z' }]);

            expect(result.code).toBe('z efgh');
            expect(result.map.mappings).toBe('AAAA,EAAK');
        });

        it('accumulates several edits on one line', () => {
            let result = edit('abcd efgh', map('AAAA,KAAK'), [
                { end: 5, start: 5, text: '(' },
                { end: 0, start: 0, text: '[' },
                { end: 9, start: 9, text: ')' }
            ]);

            expect(result.code).toBe('[abcd (efgh)');
            expect(result.map.mappings).toBe('CAAA,MAAK');
        });

        it('only rewrites the lines that were edited', () => {
            let result = edit('ab\ncd', map('AAAA;AACA'), [{ end: 3, start: 3, text: 'X' }]);

            expect(result.code).toBe('ab\nXcd');
            expect(result.map.mappings).toBe('AAAA;CACA');
        });

        it('rejects edits that would add or remove a line', () => {
            expect(() => edit('ab\ncd', map('AAAA;AACA'), [{ end: 0, start: 0, text: 'x\n' }])).toThrow('one line');
            expect(() => edit('ab\ncd', map('AAAA;AACA'), [{ end: 4, start: 1, text: '' }])).toThrow('one line');
        });
    });
});
