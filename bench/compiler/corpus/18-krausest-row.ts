import { read, reactive, signal, write } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Row = { id: number; state: { label: string } };


let rows = reactive([] as Row[]),
    selected = signal(0);


const table = () => html`
    <table class="table table-hover table-striped test-data">
        <tbody>${html.reactive(rows, (data) => html`
            <tr class="${() => read(selected) === data.id && 'danger'}">
                <td class="col-md-1">${data.id}</td>
                <td class="col-md-4"><a onclick=${() => write(selected, data.id)}>${() => data.state.label}</a></td>
                <td class="col-md-1"><a onclick=${() => rows.splice(rows.indexOf(data), 1)}><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td>
                <td class="col-md-6"></td>
            </tr>
        `)}</tbody>
    </table>
`;


export { table };
