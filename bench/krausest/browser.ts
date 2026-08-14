// Import order is load-bearing: './setup' must install its scheduler stubs before the library evaluates
import { flush } from './setup';
import { create } from './app';
import { format, run } from './harness';


let container = document.createElement('div');

document.body.appendChild(container);

let pre = document.createElement('pre'),
    results = run(create(container), flush, () => {
        void (container as HTMLElement).offsetHeight;
    });

pre.id = 'results';
pre.textContent = JSON.stringify({ results });
document.body.appendChild(pre);

console.log(format(results));
