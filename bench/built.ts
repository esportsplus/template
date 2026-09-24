import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';


const REGEX_PATH_SEPARATOR = /\\/g;


function newest(directory: string, extension: string): number {
    let latest = 0;

    for (let entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(extension)) {
            latest = Math.max(latest, statSync(path.join(entry.parentPath, entry.name)).mtimeMs);
        }
    }

    return latest;
}


// Vite's module runner turns every export into a getter, so benchmarking `src/` measures one
// getter call per cross-module access (and const enums that tsc would have inlined). Benches
// keep importing `src/` for types and editor navigation; this plugin redirects those imports to
// the shipped `build/` output, which `external` hands to Node as native ESM.
const built = (root: string) => {
    let build = path.join(root, 'build'),
        src = path.join(root, 'src');

    if (!existsSync(build) || newest(src, '.ts') > newest(build, '.js')) {
        throw new Error(`bench: '${build}' is missing or older than src/ — run \`pnpm build\` first`);
    }

    return {
        enforce: 'pre' as const,
        name: 'bench:built',
        resolveId(source: string, importer?: string) {
            if (!importer || !source.startsWith('.')) {
                return null;
            }

            let relative = path.relative(src, path.resolve(path.dirname(importer), source));

            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                return null;
            }

            let file = path.join(build, relative);

            return (existsSync(file + '.js') ? file + '.js' : path.join(file, 'index.js')).replace(REGEX_PATH_SEPARATOR, '/');
        }
    };
};

// Native-ESM modules: the redirected build output, plus the scheduler stubs every bench drains
// in its hot loop (plain type-annotated JS that Node strips natively)
const external = [/\/build\//, /\/bench\/krausest\/setup\.ts$/];


export { built, external };
