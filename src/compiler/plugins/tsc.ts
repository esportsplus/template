import { plugin } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';


export default plugin.tsc([reactivity, template]) as ReturnType<typeof plugin.tsc>;
