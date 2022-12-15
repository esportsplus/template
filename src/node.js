import { effect } from '~/app';
import renderable from './renderable';
import slot from './slot';
import text from './text';


// TODO:
// - Add scheduler
// - Should be recursive
const node = (s, value) => {
    if (Array.isArray(value)) {
        for (let i = 0, n = value.length; i < n; i++) {
            node(s, value[i]);
        }
    }
    else if (typeof value === 'object' && value !== null) {
        renderable(value).render(s, value.values);
    }
    else if (typeof value === 'function') {
        let n;

        effect(async () => {
            let result = await value();

            // Swap with upgraded renderer
            if (Array.isArray(result)) {
                s.delete(0, s.nodes.length);

                for (let i = 0, n = result.length; i < n; i++) {
                    node(s, result[i]);
                }
            }
            else if (typeof result === 'object' && result !== null) {
                n = null;
                s.render( renderable(result).render(slot(), result.values) );
            }
            else if (typeof result === 'function') {
                throw new Error('Node renderer handler received a nested function within an effect!');
            }
            else if (!n) {
                n = text(null, result);

                s.delete(0, s.nodes.length);
                s.push([ n.node ]);
            }
            else {
                n.update(result);
            }
        });
    }
    else {
        s.push([ text(null, value).node ]);
    }
};


export default node;
