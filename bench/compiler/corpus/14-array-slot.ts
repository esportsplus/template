import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Todo = { done: boolean; title: string };


let todos = reactive([] as Todo[]);


const list = () => html`
    <ul class="todos">${html.reactive(todos, (todo) => html`<li class="${() => todo.done && 'done'}">${todo.title}</li>`)}</ul>
`;

const table = () => html`<table><tbody>${html.reactive(todos, (todo) => html`<tr><td>${todo.title}</td><td>${() => todo.done}</td></tr>`)}</tbody></table>`;


export { list, table };
