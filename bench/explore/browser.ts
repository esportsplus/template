import cases from './cases';
import { format, run } from './harness';


let pre = document.createElement('pre'),
    results = run(cases);

pre.id = 'results';
pre.textContent = JSON.stringify({ results });
document.body.appendChild(pre);

console.log(format(results));
