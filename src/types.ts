import { TEMPLATE } from './constants';


type Node = ChildNode | HTMLElement;

type Nodes = Node[];

type Template = {
    [TEMPLATE]: boolean;
    content: string;
    expressions?: unknown[];
    slots?: {
        path: number[];
        type: string;
    }[];
};


export { Node, Nodes, Template };