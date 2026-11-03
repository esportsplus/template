import type { ts } from '@esportsplus/typescript';
import type { Prepend } from '@esportsplus/typescript/compiler';


// The `text` a coordinator passes a replacement's generator when no other plugin replaced anything: each node's own source
const written = (node: ts.Node): string => node.getText();

// A result with its prepend entries evaluated as the coordinator does after composing, with nothing else composed
const prepended = <R extends { prepend?: Prepend[] }>(result: R): Omit<R, 'prepend'> & { prepend: string[] } => ({
    ...result,
    prepend: (result.prepend ?? []).map((entry) => typeof entry === 'string' ? entry : entry(written))
});


export { prepended, written };
