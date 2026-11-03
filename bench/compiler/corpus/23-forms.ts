import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let form = reactive({ agree: false, email: '', name: '', role: 'user' });


const signup = () => html`
    <form class="signup">
        <input name="name" value=${() => form.name} oninput=${(e: Event) => form.name = (e.target as HTMLInputElement).value} />
        <input name="email" type="email" value=${() => form.email} required />
        <select name="role" value=${() => form.role}><option value="user">User</option><option value="admin">Admin</option></select>
        <input type="checkbox" checked=${() => form.agree} onchange=${() => form.agree = !form.agree} />
        <button disabled=${() => !form.agree} type="submit">Sign up</button>
    </form>
`;


export { signup };
