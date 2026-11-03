// Import order is load-bearing: the scheduler stubs must install before the library evaluates
import { flush } from '../krausest/setup';
import { create } from './app';
import { format } from '../krausest/harness';
import { run } from './harness';


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
