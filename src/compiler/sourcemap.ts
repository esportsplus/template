import { sourcemap } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';


// Offsets into the code the map was generated for; `text` never contains a line break and the
// replaced range never spans one, so every edit stays on a single generated line
type Edit = { end: number; start: number; text: string };


// Generated column after the edits on its line: unedited characters move by the net length change
// of every edit before them; a character inside a replaced range maps to where its edit now starts
function relocate(column: number, edits: Edit[]): number {
    let delta = 0;

    for (let i = 0, n = edits.length; i < n; i++) {
        let edit = edits[i];

        if (column < edit.start) {
            break;
        }

        if (column < edit.end) {
            return edit.start + delta;
        }

        delta += edit.text.length - (edit.end - edit.start);
    }

    return column + delta;
}


// Applies single-line edits and rewrites the map's generated columns to match, so a pass that
// runs after the map was built stays exact without re-deriving it. Lines never move.
const edit = (code: string, map: SourceMapV3, edits: Edit[]): { code: string; map: SourceMapV3 } => {
    if (edits.length === 0) {
        return { code, map };
    }

    edits = [...edits].sort((a, b) => a.start - b.start);

    let byLine = new Map<number, Edit[]>(),
        line = 0,
        lineStart = 0,
        out = '',
        position = 0;

    for (let i = 0, n = edits.length; i < n; i++) {
        let { end, start, text } = edits[i];

        while (true) {
            let next = code.indexOf('\n', lineStart);

            if (next === -1 || next >= start) {
                break;
            }

            line++;
            lineStart = next + 1;
        }

        if (text.includes('\n') || code.slice(start, end).includes('\n')) {
            throw new Error('sourcemap: edits must stay on one line');
        }

        let list = byLine.get(line);

        if (!list) {
            list = [];
            byLine.set(line, list);
        }

        list.push({ end: end - lineStart, start: start - lineStart, text });
        out += code.slice(position, start) + text;
        position = end;
    }

    out += code.slice(position);

    // Only the first field (generated column, relative within its line) moves; every other field is
    // relative to the previous segment in stream order, which the monotone relocation preserves
    let decoded = sourcemap.decode(map.mappings);

    for (let [index, list] of byLine) {
        let segments = decoded[index];

        if (!segments) {
            continue;
        }

        let column = 0,
            previous = 0;

        for (let i = 0, n = segments.length; i < n; i++) {
            let fields = segments[i];

            column += fields[0];

            let moved = relocate(column, list);

            fields[0] = moved - previous;
            previous = moved;
        }
    }

    return { code: out, map: { ...map, mappings: sourcemap.encode(decoded) } };
};


export { edit };
export type { Edit };
