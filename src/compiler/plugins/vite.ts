import { NAMESPACE, PACKAGE_NAME } from '../constants';
import { plugin } from '@esportsplus/typescript/compiler';

import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';


type VitePlugin = {
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate?: (ctx: { file: string; modules: any[] }) => void;
    name: string;
    transform: (code: string, id: string) => { code: string; map: null } | null;
    watchChange: (id: string) => void;
};


let base = plugin.vite({
    name: PACKAGE_NAME,
    plugins: [reactivity, template]
});

let TEMPLATE_SEARCH = NAMESPACE + '.template(';

let TEMPLATE_CALL_REGEX = new RegExp(
    '(const\\s+(\\w+)\\s*=\\s*' + NAMESPACE + '\\.template\\()(`)',
    'g'
);


function injectHMR(code: string, id: string): string {
    let hmrId = id.replace(/\\/g, '/'),
        hotReplace = NAMESPACE + '.createHotTemplate("' + hmrId + '", "',
        injected = code.replace(TEMPLATE_CALL_REGEX, function(_match: string, prefix: string, varName: string, backtick: string) {
            return prefix.replace(TEMPLATE_SEARCH, hotReplace + varName + '", ') + backtick;
        });

    if (injected === code) {
        return code;
    }

    injected += '\nif (import.meta.hot) { import.meta.hot.accept(() => { ' + NAMESPACE + '.accept("' + hmrId + '"); }); }';

    return injected;
}


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        vitePlugin = base({ root });

    return {
        ...vitePlugin,
        configResolved(config: any) {
            vitePlugin.configResolved(config);
            isDev = config?.command === 'serve' || config?.mode === 'development';
        },
        handleHotUpdate(_ctx: { file: string; modules: any[] }) {
            // Let Vite handle the default HMR flow
        },
        transform(code: string, id: string) {
            let result = vitePlugin.transform(code, id);

            if (!result || !isDev) {
                return result;
            }

            let injected = injectHMR(result.code, id);

            if (injected === result.code) {
                return result;
            }

            return { code: injected, map: null };
        }
    } satisfies VitePlugin;
};

