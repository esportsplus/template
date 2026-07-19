// Import order is load-bearing: './setup' must install its scheduler stubs before the library evaluates
import { flush } from './setup';
import { create } from './app';
import { format, run } from './harness';


let container = document.createElement('div');

document.body.appendChild(container);

let results = run(create(container), flush, () => {
        void (container as HTMLElement).offsetHeight;
    }),
    pre = document.createElement('pre');

pre.id = 'results';
pre.textContent = JSON.stringify({ results });
document.body.appendChild(pre);

console.log(format(results));
