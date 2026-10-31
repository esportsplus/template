// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coordinator, languageService } from '@esportsplus/typescript/compiler';
import type { Plugin, TransformResult } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import { CORPUS, STAGE } from './discovery/corpus';
import { found, reference } from './discovery/reference';


type Mismatch = { actual: unknown; expected: unknown; file: string; staged: boolean };


let fixtures: string[] = [];


// Runs reactivity then a probe over every file the way the tsc build does, comparing the site search with the
// full origins search on the program each file is compiled against, staged or not
function compare(root: string, tsconfig: string) {
    let opened = languageService.open(tsconfig),
        { fileNames } = opened.api.parseConfigFile(tsconfig),
        mismatches: Mismatch[] = [],
        shared = new Map(),
        staged = false,
        totals = { escapes: 0, files: 0, sites: 0, staged: 0 },
        plugins: Plugin[] = [
            {
                transform: (ctx) => {
                    let result: TransformResult = reactivity.transform(ctx);

                    staged = !!(result.replacements?.length || result.prepend?.length || result.imports?.length);

                    return result;
                }
            },
            {
                transform: (ctx) => {
                    let actual = found(ctx.sourceFile, ctx.checker, ctx.program),
                        expected = reference(ctx.sourceFile, ctx.checker, ctx.program);

                    totals.escapes += expected.escapes.length;
                    totals.files++;
                    totals.sites += expected.sites.length;
                    totals.staged += staged ? 1 : 0;

                    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                        mismatches.push({ actual, expected, file: ctx.sourceFile.fileName, staged });
                    }

                    return {};
                }
            }
        ];

    try {
        for (let fileName of fileNames) {
            let project = opened.project,
                sourceFile = project.program.getSourceFile(fileName);

            if (!sourceFile || fileName.endsWith('.d.ts')) {
                continue;
            }

            staged = false;
            coordinator.transform(plugins, sourceFile.getFullText(), sourceFile, { checker: project.checker, configPath: tsconfig, program: project.program }, root, shared);
        }
    }
    finally {
        opened.dispose();
        languageService.dispose(tsconfig);
    }

    return { mismatches, totals };
}


afterAll(() => {
    for (let fixture of fixtures) {
        rmSync(fixture, { force: true, recursive: true });
    }
});


describe('compiler site discovery, against the full origins search', () => {
    it('agrees on sites, escapes and dependencies over the corpus, staged and not', () => {
        let directory = mkdtempSync(join(process.cwd(), '.fixture-discovery-diff-')).replace(/\\/g, '/'),
            names: string[] = [];

        fixtures.push(directory);

        for (let [name, code] of Object.entries(CORPUS)) {
            writeFileSync(join(directory, name), code);
            writeFileSync(join(directory, name.replace(/\.ts$/, '.staged.ts')), code + STAGE);
            names.push('./' + name, './' + name.replace(/\.ts$/, '.staged.ts'));
        }

        writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, target: 'esnext', types: [] },
            files: names
        }));

        let { mismatches, totals } = compare(directory, directory + '/tsconfig.json');

        expect(mismatches).toEqual([]);
        expect(totals.files).toBe(names.length);
        expect(totals.staged).toBeGreaterThanOrEqual(Object.keys(CORPUS).length);
        expect(totals.sites).toBeGreaterThan(100);
        expect(totals.escapes).toBeGreaterThanOrEqual(16);
    }, 120000);

    // Opt in with DISCOVERY_ROOT=<directory holding a tsconfig.json>, e.g. the UI library; DISCOVERY_OUT=<file> keeps the totals
    it.runIf(process.env.DISCOVERY_ROOT)('agrees over DISCOVERY_ROOT', () => {
        let root = process.env.DISCOVERY_ROOT!.replace(/\\/g, '/'),
            { mismatches, totals } = compare(root, root + '/tsconfig.json');

        if (process.env.DISCOVERY_OUT) {
            writeFileSync(process.env.DISCOVERY_OUT, JSON.stringify(totals));
        }

        expect(mismatches).toEqual([]);
        expect(totals.sites).toBeGreaterThan(0);
    }, 600000);
});
