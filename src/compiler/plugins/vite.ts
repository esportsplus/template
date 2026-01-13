import { plugin } from '@esportsplus/typescript/compiler';
import { PACKAGE_NAME } from '../constants';
import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';


export default plugin.vite({
    name: PACKAGE_NAME,
    plugins: [reactivity, template]
});
