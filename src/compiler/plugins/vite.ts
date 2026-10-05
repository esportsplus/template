import { plugin } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import { compiler } from '..';
import type { Removal } from '..';
import { apply, plugin as hmr } from '../hmr';
import type { HmrState } from '../hmr';
import { PACKAGE_NAME, UNCOMPILED } from '../constants';


// The part of Rollup's transform context used here; absent when the hook is called directly
type Context = { warn?: (message: string) => void } | undefined;

type VitePlugin = {
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate: (ctx: any) => any;
    name: string;
    transform: (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string; map: unknown } | null;
    watchChange: (id: string) => void;
};


const FILE_REGEX = /\.[tj]sx?$/;

const REGEX_PATH_SEPARATOR = /\\/g;

const RELOAD_WINDOW = 100;


// The removal's offset in the source Vite passed in: the analysis ran on code an earlier plugin may have edited
function locate(code: string, removal: Removal): number {
    let at = -1;

    for (let i = 0; i <= removal.occurrence; i++) {
        at = code.indexOf(removal.text, at + 1);

        if (at === -1) {
            return removal.start;
        }
    }

    return at;
}

function warning(code: string, id: string, removal: Removal): string {
    let offset = locate(code, removal),
        line = 1,
        start = 0;

    for (let at = code.indexOf('\n'); at !== -1 && at < offset; at = code.indexOf('\n', at + 1)) {
        line++;
        start = at + 1;
    }

    return `${PACKAGE_NAME}: ${id}:${line}:${offset - start + 1} \`${removal.text}\` removes or replaces ` +
        `template-owned nodes by hand, so their lifecycle hooks and what they created stay alive until the content ` +
        `that owns them is released. Change content through a slot, reactive array or render() disposer instead ` +
        `(see README 'Removing template content').`;
}


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        // Set by the template compiler during the transform in progress, which runs synchronously
        removals: Removal[] = [],
        state: HmrState = { id: null, plan: null, templates: new Set() },
        vitePlugin = plugin.vite({
            name: PACKAGE_NAME,
            plugins: [hmr(state), reactivity, compiler((found) => { removals = found; })],
            uncompiled: [UNCOMPILED]
        })({ root });

    const reload = (server: any) => {
        let now = Date.now();

        if (now - lastReload < RELOAD_WINDOW) {
            return;
        }

        lastReload = now;
        (server.hot ?? server.ws).send({ type: 'full-reload' });
    };

    return {
        ...vitePlugin,
        configResolved(config: any) {
            vitePlugin.configResolved(config);
            isDev = config?.command === 'serve' && config?.server?.hmr !== false;
        },
        handleHotUpdate(ctx: any) {
            let { file, modules, server } = ctx,
                // Modules compiled against the changed file are updated with it
                result = vitePlugin.handleHotUpdate(ctx);

            // CSS/SCSS and non-script assets keep Vite's default HMR path.
            if (!FILE_REGEX.test(file) || file.includes('node_modules')) {
                return result;
            }

            // A supported component self-accepts; let Vite apply the update normally.
            for (let i = 0, n = modules.length; i < n; i++) {
                if (modules[i].isSelfAccepting) {
                    return result;
                }
            }

            // Unsupported/unsafe template modules must not be re-imported blindly: request one
            // full reload and stop Vite from walking the import chain.
            if (state.templates.has(file.replace(REGEX_PATH_SEPARATOR, '/'))) {
                reload(server);
                return [];
            }

            return result;
        },
        transform(this: unknown, code: string, id: string, options?: { ssr?: boolean }) {
            // The pipeline runs synchronously, so this handshake cannot interleave across modules
            state.id = isDev && options?.ssr !== true ? id.replace(REGEX_PATH_SEPARATOR, '/') : null;
            state.plan = null;
            removals = [];

            let context = this as Context,
                result = vitePlugin.transform(code, id);

            if (typeof context?.warn === 'function') {
                for (let i = 0, n = removals.length; i < n; i++) {
                    context.warn(warning(code, id.replace(REGEX_PATH_SEPARATOR, '/'), removals[i]));
                }
            }

            if (result === null || state.id === null || state.plan === null) {
                return result;
            }

            return apply(result.code, result.map as SourceMapV3, state.id, state.plan) ?? result;
        }
    } satisfies VitePlugin;
};
