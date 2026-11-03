import type { ts } from '@esportsplus/typescript';


// The `text` a coordinator passes a replacement's generator when no other plugin replaced anything: each node's own source
const written = (node: ts.Node): string => node.getText();


export { written };
