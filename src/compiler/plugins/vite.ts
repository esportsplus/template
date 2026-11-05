import { AsyncLocalStorage } from 'node:async_hooks';
import { plugin } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import { compiler } from '..';
import { apply, plugin as hmr, HMR_PACKAGE } from '../hmr';
import type { Handshake, HmrState } from '../hmr';
import { PACKAGE_NAME, UNCOMPILED } from '../constants';


type VitePlugin = {
    config: (config: any, env: { command: string }) => { optimizeDeps: { include: string[] } } | undefined;
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate: (ctx: any) => any;
    name: string;
    transform: {
        filter: { id: { exclude: RegExp[]; include: RegExp } };
        handler: (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => Promise<{ code: string; map: unknown } | null>;
    };
    watchChange: (id: string) => void;
};


// Query parameters of Vite asset imports: the code such a module is given is not the file's own source
const ASSETS = new Set(['inline', 'init', 'no-inline', 'raw', 'sharedworker', 'url', 'worker']);

const FILE_REGEX = /\.[cm]?[tj]sx?$/;

const REGEX_NODE_MODULES = /[\\/]node_modules[\\/]/;

const REGEX_PATH_SEPARATOR = /\\/g;

// A script module's id, with or without a query
const REGEX_SCRIPT = /\.[cm]?[tj]sx?(?:\?|$)/;

const REGEX_VIRTUAL = /^\0/;

const RELOAD_WINDOW = 100;


function isAsset(query: string): boolean {
    for (let key of new URLSearchParams(query).keys()) {
        if (ASSETS.has(key)) {
            return true;
        }
    }

    return false;
}


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        state: HmrState = { templates: new Set(), transforms: new AsyncLocalStorage() },
        vitePlugin = plugin.vite({
            name: PACKAGE_NAME,
            plugins: [hmr(state), reactivity, compiler(true)],
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
        // Served template modules import the HMR runtime, which the compiler injects after Vite's dependency scan
        // has run; listed up front, it is pre-bundled with the rest instead of discovered late with a page reload
        config(config: any, { command }: { command: string }) {
            let { exclude = [], include = [] } = config?.optimizeDeps ?? {};

            if (command !== 'serve' || config?.server?.hmr === false || include.includes(HMR_PACKAGE) || exclude.includes(HMR_PACKAGE)) {
                return undefined;
            }

            return { optimizeDeps: { include: [HMR_PACKAGE] } };
        },
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
        transform: {
            // Lets Vite skip every other module without calling in
            filter: { id: { exclude: [REGEX_NODE_MODULES, REGEX_VIRTUAL], include: REGEX_SCRIPT } },
            async handler(this: unknown, code: string, id: string, options?: { ssr?: boolean }) {
                let query = id.indexOf('?'),
                    path = query === -1 ? id : id.slice(0, query);

                // The filter again, for a host that does not apply it; a queried module is the file's own source
                // (`?worker_file`) unless it is an asset import
                if (
                    REGEX_VIRTUAL.test(id) ||
                    REGEX_NODE_MODULES.test(path) ||
                    !FILE_REGEX.test(path) ||
                    (query !== -1 && isAsset(id.slice(query + 1)))
                ) {
                    return null;
                }

                // Modules transform concurrently, so each transform's handshake is its own, kept across its awaits.
                // HMR wraps a module under its own id only. A build answered from the host's result cache runs no
                // plugin, leaving `state.templates` (dev only, where nothing is cached) as it was; the host reports
                // the compile's removal warnings through this context either way.
                let handshake: Handshake = { id: isDev && options?.ssr !== true && query === -1 ? path.replace(REGEX_PATH_SEPARATOR, '/') : null, plan: null },
                    result = await state.transforms.run(handshake, () => vitePlugin.transform.handler.call(this, code, path));

                if (result === null || handshake.id === null || handshake.plan === null) {
                    return result;
                }

                return await apply(result.code, result.map as SourceMapV3, handshake.id, handshake.plan) ?? result;
            }
        }
    } satisfies VitePlugin;
};
