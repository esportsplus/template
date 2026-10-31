// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { apply } from '../../src/compiler/hmr';


type Plan = Parameters<typeof apply>[3];


const EAGER: Plan = [{ kind: 'assignment', wrapper: 'eager' }];

const FACTORY: Plan = [{ kind: 'assignment', wrapper: 'factory' }];

const FUNCTION: Plan = [{ kind: 'function' }];

const ID = '/src/module.ts';

const MAP = { mappings: '', names: [], sources: [], version: 3 };


// The lowered code without the appended tail, the HMR namespace's generated name replaced by NS; null if apply()
// declined. Every case also runs as JSX, read by the parser rather than the scanner, which must agree.
function run(code: string, plan: Plan) {
    let normalize = (id: string) => {
            let result = apply(code, MAP as unknown as Parameters<typeof apply>[1], id, plan);

            if (result === null) {
                return null;
            }

            let namespace = /import \* as (\w+) from '@esportsplus\/template\/hmr';/.exec(result.code)![1],
                tail = result.code.indexOf(`\nimport * as ${namespace}`);

            return result.code.slice(0, tail).replaceAll(namespace, 'NS').replaceAll(JSON.stringify(id), JSON.stringify(ID));
        },
        scanned = normalize(ID);

    expect(normalize(ID.replace(/\.ts$/, '.tsx'))).toBe(scanned);

    return scanned;
}


describe('compiler/hmr apply', () => {
    describe('finds only top-level export statements', () => {
        it.each([
            ['a string', "let a = 'export default 1;', b = \"export { a }\";\n"],
            ['a line comment', '// export default 1;\n'],
            ['a block comment', '/* export default 1;\nexport { a } */\n'],
            ['a regex', 'let r = /export default 1;/g, s = /[`\'"{]/;\n'],
            ['a template literal', 'let t = `export default ${1}\nexport { a }`;\n'],
            ['a nested template literal', 'let t = `a ${`export default ${"}"}`} b`;\n'],
            ['a template literal holding braces', "let t = `${ { a: '}' }.a } export default 1;`;\n"],
            ['a block', '{\n    let x = 1;\n}\nfunction f() { return { export: 1 }; }\n'],
            ['a property named export', 'let o = { export: 1 };\nlet x = o.export;\n'],
            ['a division then a regex', 'let a = 4 / 2 / 1, r = a ? /}/ : /{/;\n'],
            ['a postfix increment before a division', "let a = 1, b = a++ / 2 / 1, c = [a][0] / 2, d = 'x' / 2;\n"],
            ['a regex after a block', 'if (a) {\n    b();\n}\n/export default 1;/.test("x");\n'],
            ['a regex holding a slash in a class', 'let r = /[/`]export default/;\n'],
            ['a member named export', 'let o = { a: 1 };\no.export = 1;\nlet x = o\n    .export, y = o?.export;\n'],
            ['an unicode line separator in a string', "let s = 'a\\u2028b';\n"]
        ])('ignores export text in %s', (_label, prefix) => {
            expect(run(prefix + 'export default value;\n', EAGER)).toBe(
                prefix + 'export default NS.eager("/src/module.ts", "default", () => (value));\n'
            );
        });

        it('returns null when a planned site is missing', () => {
            expect(run('// export default value;\nconst value = 1;\n', EAGER)).toBeNull();
        });
    });

    describe('assignment', () => {
        it('wraps the whole expression, up to the semicolon', () => {
            expect(run('export default factory(a, b) / 2;\n', FACTORY)).toBe(
                'export default NS.factory("/src/module.ts", "default", () => (factory(a, b) / 2));\n'
            );
        });

        it('wraps an expression without a semicolon, ended by the next statement', () => {
            expect(run('export default value\nexport { other };\n', [...EAGER, { exports: [{ exportId: 'other', local: 'other', wrapper: 'callable' }], kind: 'list' }])).toBe(
                'export default NS.eager("/src/module.ts", "default", () => (value))\nexport { __hmr_other as other };\n'
            );
        });

        it('wraps a multi-line expression on its first and last line', () => {
            expect(run('export default (\n    value\n) as unknown;\n', EAGER)).toBe(
                'export default NS.eager("/src/module.ts", "default", () => ((\n    value\n) as unknown));\n'
            );
        });

        it('leaves a trailing comment outside the wrapper', () => {
            expect(run('export default value; // export default\n', EAGER)).toBe(
                'export default NS.eager("/src/module.ts", "default", () => (value)); // export default\n'
            );
        });

        it('wraps an async arrow', () => {
            expect(run('export default async () => value;\n', FACTORY)).toBe(
                'export default NS.factory("/src/module.ts", "default", () => (async () => value));\n'
            );
        });

        it('wraps an expression holding a template literal and a regex', () => {
            expect(run('export default `a ${b ? "}" : `${c}`}`.replace(/;/g, \'\');\n', EAGER)).toBe(
                'export default NS.eager("/src/module.ts", "default", () => (`a ${b ? "}" : `${c}`}`.replace(/;/g, \'\')));\n'
            );
        });

        it('is not matched by a function plan', () => {
            expect(run('export default value;\n', FUNCTION)).toBeNull();
        });
    });

    describe('function', () => {
        it.each([
            ['a named function', 'export default function view(a: string) {\n    return a;\n}\n', 'function view(a: string) {\n    return a;\n}'],
            ['an anonymous function', 'export default function () { return 1; }\n', 'function () { return 1; }'],
            ['an async function', 'export default async function view() {\n    return 1;\n}\n', 'async function view() {\n    return 1;\n}'],
            ['a function with a typed return', 'export default function view(): { a: number } {\n    return { a: 1 };\n}\n', 'function view(): { a: number } {\n    return { a: 1 };\n}'],
            ['a function returning a union of object types', 'export default function view(): { a: 1 } | Map<string, { b: 2 }> {\n    return { a: 1 };\n}\n', 'function view(): { a: 1 } | Map<string, { b: 2 }> {\n    return { a: 1 };\n}'],
            ['a function returning a function type', 'export default function view(): (a: { b: 1 }) => void {\n    return () => {};\n}\n', 'function view(): (a: { b: 1 }) => void {\n    return () => {};\n}'],
            ['a generic generator', 'export default function* view<T extends { a: 1 }>(a: T) {\n    yield a;\n}\n', 'function* view<T extends { a: 1 }>(a: T) {\n    yield a;\n}']
        ])('wraps %s', (_label, code, body) => {
            expect(run(code, FUNCTION)).toBe(`export default NS.factory("/src/module.ts", "default", () => (${body}));\n`);
        });

        it('is not matched by an assignment plan', () => {
            expect(run('export default async function view() {}\n', FACTORY)).toBeNull();
        });

        it('does not take a default class for a site', () => {
            expect(run('export default class View {}\n', FACTORY)).toBeNull();
        });
    });

    describe('list', () => {
        it('wraps a default and a named export in one list', () => {
            expect(run('function a() {}\nfunction b() {}\nexport { a as default, b };\n', [{
                exports: [
                    { exportId: 'default', local: 'a', wrapper: 'factory' },
                    { exportId: 'b', local: 'b', wrapper: 'callable' }
                ],
                kind: 'list'
            }])).toBe('function a() {}\nfunction b() {}\nexport { __hmr_a as default, __hmr_b as b };\n');
        });

        it('wraps a multi-line list', () => {
            expect(run('export {\n    a,\n    // b\n    c as d\n};\n', [{
                exports: [
                    { exportId: 'a', local: 'a', wrapper: 'callable' },
                    { exportId: 'd', local: 'c', wrapper: 'callable' }
                ],
                kind: 'list'
            }])).toBe('export {\n    __hmr_a as a,\n    // b\n    __hmr_c as d\n};\n');
        });

        it('takes a type-only list for a list, as the parser does', () => {
            expect(run('export type { a };\n', [{ exports: [{ exportId: 'a', local: 'a', wrapper: 'callable' }], kind: 'list' }])).toBe(
                'export type { __hmr_a as a };\n'
            );
        });

        it('appends a wrapper per export', () => {
            let result = apply('export { a as default, b };\n', MAP as unknown as Parameters<typeof apply>[1], ID, [{
                    exports: [
                        { exportId: 'default', local: 'a', wrapper: 'factory' },
                        { exportId: 'b', local: 'b', wrapper: 'callable' }
                    ],
                    kind: 'list'
                }])!;

            expect(result.code).toMatch(/const __hmr_a = \w+\.factory\("\/src\/module\.ts", "default", \(\) => a\);/);
            expect(result.code).toMatch(/const __hmr_b = \w+\.callable\("\/src\/module\.ts", "b", \(\) => b\);/);
            expect(result.code).toContain('import.meta.hot.accept(');
        });

        it.each([
            ['a re-export', "export { a } from './a';\n"],
            ['a star re-export', "export * from './a';\n"],
            ['an exported const', 'export const a = 1;\n'],
            ['an exported function', 'export function a() {}\n']
        ])('does not take %s for a site', (_label, code) => {
            expect(run(code + 'export default value;\n', EAGER)).toBe(
                code + 'export default NS.eager("/src/module.ts", "default", () => (value));\n'
            );
        });

        it.each([
            ['a different export name', [{ exportId: 'c', local: 'a', wrapper: 'callable' }]],
            ['a different export count', [{ exportId: 'a', local: 'a', wrapper: 'callable' }, { exportId: 'b', local: 'b', wrapper: 'callable' }]]
        ] as const)('returns null on %s', (_label, exports) => {
            expect(run('export { a };\n', [{ exports: [...exports], kind: 'list' }])).toBeNull();
        });
    });

    it('returns null when the code has more sites than the plan', () => {
        expect(run('export default value;\nexport { a };\n', EAGER)).toBeNull();
    });

    it('keeps sites in source order', () => {
        expect(run('export { a };\nexport default value;\n', EAGER)).toBeNull();
    });

    it('picks wrapper names the code does not use', () => {
        expect(run('const __hmr_a = 1;\nexport { a };\n', [{ exports: [{ exportId: 'a', local: 'a', wrapper: 'callable' }], kind: 'list' }])).toBe(
            'const __hmr_a = 1;\nexport { __hmr_a_1 as a };\n'
        );
    });
});
