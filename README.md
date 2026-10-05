# @esportsplus/template

High-performance, compiler-optimized HTML templating library for JavaScript/TypeScript. Templates are transformed at build time into optimized DOM manipulation code with zero runtime parsing overhead.

## Features

- **Compile-time transformation** - Templates converted to optimized code during build
- **Zero runtime parsing** - No template parsing at runtime
- **Reactive integration** - Works with `@esportsplus/reactivity` for dynamic updates; changes reach the DOM at the end of the task that made them (reactivity's microtask pass, with array slots batching their own operations the same way), and `flush()` from `@esportsplus/reactivity` (or `slot.flush()` for an array slot) applies them synchronously
- **Event delegation** - Efficient event handling with automatic delegation
- **Lifecycle events** - `onconnect`, `ondisconnect`, `onfirstpaint`, `ontick`
- **Async slots** - Async function support with fallback content in `EffectSlot`
- **Non-destructive reordering** - Uses `moveBefore` DOM API for array sort/reverse when available
- **HMR support** - Fine-grained hot module replacement for templates in development
- **Type-safe** - Full TypeScript support

## Installation

```bash
pnpm add @esportsplus/template
```

## Transformer Plugins

The library requires a build-time transformer to convert template literals into optimized code. Choose the plugin for your build tool:

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import template from '@esportsplus/template/compiler/vite';

export default defineConfig({
    plugins: [template()]
});
```

HMR is automatically enabled in development mode (`vite dev`). When a file containing `html` templates is saved, only the affected template factories are invalidated and re-created — no full page reload needed.

### TypeScript Compiler (tsc)

For direct `tsc` compilation, use the transformer:

```typescript
// tsconfig.json (with ts-patch or ttypescript)
{
    "compilerOptions": {
        "plugins": [
            { "transform": "@esportsplus/template/compiler/tsc" }
        ]
    }
}
```

## Basic Usage

```typescript
import { html, render } from '@esportsplus/template';

// Static template
const greeting = html`<div class="greeting">Hello World</div>`;

// Dynamic text
const message = (text: string) => html`<div>${text}</div>`;

// Dynamic attributes
const button = (cls: string) => html`<button class="${cls}">Click</button>`;

// Render to DOM: render() takes a factory and builds the content inside its own root
render(document.body, () => greeting);
```

## Template Syntax

### Text Slots

```typescript
// Basic text interpolation
const text = (value: string) => html`<span>${value}</span>`;

// Multiple slots
const multi = (a: string, b: string) => html`<p>${a} and ${b}</p>`;

// Adjacent slots
const adjacent = (a: string, b: string, c: string) => html`<div>${a}${b}${c}</div>`;
```

### Attribute Slots

```typescript
// Class
const dynamic = (cls: string) => html`<div class="${cls}"></div>`;

// Mixed static and dynamic
const mixed = (dynamic: string) => html`<div class="base ${dynamic}"></div>`;

// Multiple attributes
const attrs = (id: string, cls: string, style: string) =>
    html`<div id="${id}" class="${cls}" style="${style}"></div>`;

// Data attributes
const data = (value: string) => html`<div data-value="${value}"></div>`;
```

Each whitespace-separated class interpolation keeps its own binding, including effects:

```typescript
const control = (type: 'checkbox' | 'radio' | 'switch', state: { active: boolean }) =>
    html`<div class="${type === 'radio' ? 'checkbox checkbox--radio' : type} ${() => state.active && '--active'}"></div>`;
```

Safe constants are folded into the template HTML. Immutable string/number literal-union parameters can select precompiled static variants (up to 16 combinations); unknown or mutable values retain runtime bindings. Callbacks are never evaluated during compilation. Effects also work inside composed values such as `class="item-${() => state.id}"` and `style="width: ${() => state.width}px"`. Literal whitespace in quoted attributes is preserved.

### Spread Attributes

```typescript
// Spread object as attributes
const spread = (attrs: Attributes) => html`<div ${attrs}></div>`;

// With static attributes
const spreadMixed = (attrs: Attributes) =>
    html`<div class="base" ${attrs}></div>`;

// Inline objects are typed: DOM properties accept a value or an effect
const field = (state: { name: string; locked: boolean }) =>
    html`<input ${{
        disabled: () => state.locked,
        oninput: (e) => (state.name = (e.target as HTMLInputElement).value),
        value: () => state.name
    }}>`;
```

### Nested Templates

```typescript
// Map to nested templates
const list = (items: string[]) =>
    html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`;

// Deeply nested
const nested = (sections: { title: string; items: string[] }[]) =>
    html`<div>
        ${sections.map(section => html`
            <section>
                <h2>${section.title}</h2>
                <ul>${section.items.map(item => html`<li>${item}</li>`)}</ul>
            </section>
        `)}
    </div>`;
```

### Conditional Rendering

```typescript
// Conditional class
const toggle = (active: boolean) =>
    html`<div class="${active ? 'active' : 'inactive'}"></div>`;

// Conditional content
const conditional = (show: boolean, content: string) =>
    html`<div>${show ? content : ''}</div>`;

// Conditional template
const conditionalTemplate = (items: string[] | null) =>
    html`<div>
        ${items ? html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>` : html`<p>No items</p>`}
    </div>`;
```

## Reactive Bindings

### Effect Slots

Function expressions automatically become reactive effect slots:

```typescript
import { html } from '@esportsplus/template';

// Arrow function = reactive
const counter = (state: { count: number }) =>
    html`<div>${() => state.count}</div>`;

// Reactive class
const toggle = (state: { active: boolean }) =>
    html`<div class="${() => state.active ? 'on' : 'off'}"></div>`;

// Reactive style
const progress = (state: { width: number }) =>
    html`<div style="${() => `width: ${state.width}px`}"></div>`;
```

### Array Slots

For reactive arrays, use `html.reactive`:

```typescript
import { html } from '@esportsplus/template';

const todoList = (todos: string[]) =>
    html`<ul>${html.reactive(todos, todo => html`<li>${todo}</li>`)}</ul>`;
```

Array sort and reverse operations use the `moveBefore` DOM API when available, preserving element state (focus, animations, iframe content) during reordering. Falls back to `insertBefore` in older browsers.

### Virtual Slots

For long lists, `html.virtual` renders only the rows near the viewport. Rows may have
any height, heights may change after render, and the array is reactive: push, splice,
sort, and the rest update the list in place without moving what the reader is looking at.

```typescript
import { html } from '@esportsplus/template';

const feed = (posts: Post[]) =>
    html`<div class="feed">${html.virtual(posts, post => html`<article>${post.body}</article>`)}</div>`;
```

The scroller is the nearest ancestor with `overflow-y: auto` or `scroll`, or the window.
The one option is `anchor`. The default `'start'` is a feed: the list opens at the top and
appends never move the viewport. `'end'` is a chat: the list opens at the last row, follows
appends while the reader is at the end, releases as soon as the reader scrolls up, and
re-engages when they return to the end.

```typescript
html`<div class="thread">${html.virtual(messages, message => html`<p>${message.text}</p>`, { anchor: 'end' })}</div>`
``` Row heights are measured with `ResizeObserver` after layout
and before paint, cached on the row element, and used to keep the scrollbar and the
scroll position stable when rows above the viewport change size. Reactive array
mutations work the same way as with `html.reactive`.

Rows must not carry vertical margins, since `ResizeObserver` reports the border box;
use padding on the row or `gap` on the container. The slot sets `overflow-anchor: none`
on the scroller. Inside a `tbody` the spacers are `tr` elements.

The runtime class is `VirtualSlot`; its instance exposes reactive `length` and `range`,
`scrollTo(index, align)` with `start`, `center`, or `end`, and `dispose()`.

### Async Slots

Async functions are supported in effect slots, with an optional fallback callback for loading states:

```typescript
import { html } from '@esportsplus/template';

// Async with fallback content while loading
const asyncContent = () =>
    html`<div>${async (fallback: (content: any) => void) => {
        fallback(html`<span>Loading...</span>`);
        const data = await fetchData();
        return html`<span>${data}</span>`;
    }}</div>`;

// Simple async (no fallback)
const simpleAsync = () =>
    html`<div>${async () => {
        const data = await fetchData();
        return html`<span>${data}</span>`;
    }}</div>`;
```

## Events

### Standard DOM Events

Events use delegation by default for efficiency:

`touchmove`, `touchstart`, and `wheel` listeners are passive, so their handlers cannot call `preventDefault()`: they are
the only events whose listeners can hold up scrolling. Use `onactive{event}` when one must cancel.

```typescript
// Click
const button = (handler: () => void) =>
    html`<button onclick="${handler}">Click</button>`;

// Keyboard
const input = (handler: (e: KeyboardEvent) => void) =>
    html`<input onkeydown="${handler}">`;

// Input
const textbox = (handler: (e: Event) => void) =>
    html`<input oninput="${handler}">`;

// Multiple events
const interactive = (click: () => void, hover: () => void) =>
    html`<div onclick="${click}" onmouseenter="${hover}">Interact</div>`;
```

### Document and Window Events

Use `ondocument{event}` or `onwindow{event}` for a host-wide listener owned by a
template element:

```typescript
const shortcut = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        openSearch();
    }
};

html`<button ondocumentkeydown=${shortcut}>Search</button>`;
html`<button ${{ ondocumentkeydown: shortcut }}>Search</button>`;
html`<div onwindowresize=${() => layout()}></div>`;
```

Host events fire regardless of whether the event originated inside the owning
element. Registration happens when the template binds the element, and template
disposal removes it automatically. An owner out of the document is skipped, and
one removed by native DOM calls is released (see [Removing Template Content](#removing-template-content)).
Multiple owners each receive the event in registration order; register
shared shortcuts once. Handlers receive the owning element as `this`; use
`event.currentTarget` for the document or window.
Replacing an event binding on the same owner removes the previous registration.

### Active Events

`onactive{event}` binds a cancelable listener for one of the passive events, on the element itself and only while a
gesture on it lasts, so the browser waits on script before scrolling only then:

| Event | Bound from | Until |
|---|---|---|
| `touchmove`, `touchstart` | a touch or pen `pointerdown` on the element | the last finger lifts (`touchend` / `touchcancel`) |
| `wheel` | the pointer moving over the element | `pointerleave` |

```typescript
// Stops the page scrolling under a touch drag once it has started
html`<ul onactivetouchmove=${(e: TouchEvent) => dragging && e.preventDefault()}>…</ul>`;
```

A passive event added later without a gesture of its own is cancelable for as long as the element lives. Template
disposal removes every listener.

### Once Events

Prefix any event with `once` to remove the binding before its first invocation:

```typescript
html`<button onceclick=${start}>Start</button>`;
html`<dialog oncedocumentkeydown=${dismiss}></dialog>`;
html`<div oncewindowload=${ready}></div>`;
```

### Lifecycle Events

Custom lifecycle events for DOM attachment:

```typescript
// Called when element is added to DOM
const connect = (handler: (el: HTMLElement) => void) =>
    html`<div onconnect="${handler}">Connected</div>`;

// Called when the content that owns the element is released (see Removing Template Content)
const disconnect = (handler: (el: HTMLElement) => void) =>
    html`<div ondisconnect="${handler}">Will disconnect</div>`;

// Called once, the frame after the element's first paint
const firstpaint = (handler: (el: HTMLElement) => void) =>
    html`<div onfirstpaint="${handler}">Painted</div>`;

// Called on animation frame (with dispose function)
const tick = (handler: (dispose: () => void, el: HTMLElement) => void) =>
    html`<div ontick="${handler}">Animating</div>`;
```

### Ownership and Cleanup

Every binding a template makes (listeners, host events, reactive attributes, lifecycle hooks, nested slots) belongs
to the reactivity owner building it: the `render()` root, an array row, an effect slot's current run, or an HMR
instance. Disposing an owner releases everything nested in it, then its nodes are removed; nothing walks the removed
DOM. Cleanups run in registration order, and compiled templates register descendants first, so a child's cleanups
run before its parent's.

An effect slot's content is built inside the effect, so it belongs to the run that built it: the next run releases it.
A run that returns the same node or array slot as the last one leaves it in place, and a text update rewrites the text
node; neither releases anything the slot does not own. Content the slot shows but did not build (a node built by the
surrounding template) keeps its bindings until its own owner is disposed.

Content built while a reactivity owner runs (a template slot, a `root()` or `effect()` of your own, an `onconnect`
or `onfirstpaint` listener) registers on that owner. Content built with no owner at all (an `html` template called at
module scope, in an event handler, or after an `await`) has nowhere to register, so its cleanups wait on its nodes
until a template insertion that contains them adopts them: `render()` into its root, a static slot into its owner, an
effect or async slot into the content it shows, released when that content is replaced. Cleanups still unadopted at
the next idle sweep stay with their nodes and are released by the idle sweep (see
[Removing Template Content](#removing-template-content)) once the node has been in the document and left it.

### Removing Template Content

**Never remove or replace template-owned nodes by hand**: no `el.remove()`, `replaceWith`, `replaceChildren`,
`removeChild`, `innerHTML`/`outerHTML`/`textContent`/`innerText` writes or `insertAdjacentHTML` on content a template
rendered. Change what is rendered instead: return different content from an effect slot, change a reactive array, or
call the disposer `render()` returned. Template removal releases the bindings first, then removes the nodes; nothing
watches the DOM for other removals, so content removed any other way is only partly reclaimed.

Nodes you create yourself (`document.createElement`, a third-party widget's DOM) are yours: appending them to a
template element and removing them again is fine, as long as the template's own nodes stay where it put them.

What is still healed when other code removes template content, without a `MutationObserver`:

- **A whole root.** An idle sweep (`requestIdleCallback`, `setTimeout` fallback; about once a second, only while
  something is tracked) checks the anchors of top-level slots: `render()` roots, HMR instances, slots created outside
  any template, and nodes holding unadopted cleanups. When a host removes the container, the outermost slot removed
  with it is released, along with everything it owns, including effects nothing they read ever changes again and
  content inside shadow roots.
- **Window and document handlers.** A handler whose element is out of the document is never run; if the element had
  been mounted, the outermost slot removed with it is released at the end of the task.
- **Effects and reactive attributes.** One that reruns on a mounted node now out of the document skips its work and
  is released at the end of the task.
- **Moves.** A node removed and reinserted within the same task is kept, and an effect that skipped a rerun while it
  was out runs again.

What is not healed: an element removed by other code from content whose root is still mounted (a row, a panel inside
a page). Its `ondisconnect` hook, and whatever its `onconnect`/`onfirstpaint` listeners created (observers, timers,
subscriptions), stay alive until the enclosing slot or root is released, unless one of the guards above reaches it
first.

Errors thrown by these cleanups are reported through `reportError` (prefixed `@esportsplus/template:`), not thrown.
Only content once seen in the document is released this way; content built but never inserted is left alone and
stops being watched after about a minute.

**Iframes.** Render within the document the template runs in; an iframe runs its own copy of the template. Content
rendered from this document into an iframe's document still reports `isConnected` after the iframe is removed, so it
is released only by template disposal.

**Templates are factories.** Call a template each time you need its content; do not cache rendered nodes across
effect runs or reinsert detached content. Content kept out of the document past the end of a task, a rerun or a sweep
counts as removed, and content an effect run built is released by the next run, so either comes back with its
bindings released. Static content (no bindings or hooks) is unaffected.

**Compiler warning.** The Vite plugin warns, in `vite` and `vite build` alike, wherever a removal is written directly
on template output: a call to `remove`, `replaceWith`, `replaceChildren`, `removeChild` or `insertAdjacentHTML`, or a
write to `innerHTML`, `outerHTML`, `textContent` or `innerText`, whose target is an `html` result, the element a
lifecycle hook (`onconnect`, `ondisconnect`, `onfirstpaint`, `ontick`) receives, `this` in an event handler written
as a `function`, or a variable initialized from one of those and never reassigned. Only handlers written in the
template itself are followed; anything it cannot trace (a handler passed in by name, a node found by
`querySelector`, nodes you created) is not flagged, so no warning does not mean no violation. The `tsc` plugin does
not warn.

### Direct Attach Events

Some events don't bubble and are attached directly:

- `onfocus`, `onblur`, `onfocusin`, `onfocusout`
- `onload`, `onerror`
- `onmouseenter`, `onmouseleave`
- `onplay`, `onpause`, `onended`, `ontimeupdate`
- `onscroll`, `onsubmit`, `onreset`

```typescript
const input = (focus: () => void, blur: () => void) =>
    html`<input onfocus="${focus}" onblur="${blur}">`;
```

## SVG Support

Use `html` for SVG templates — the compiler handles SVG elements natively:

```typescript
import { html } from '@esportsplus/template';

const circle = (fill: string) =>
    html`<svg width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="${fill}"/>
    </svg>`;
```

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `html` | Template literal tag for HTML and SVG |
| `render` | Mount renderable to DOM element |
| `setList` | Set class/style list attributes with merge support |
| `setProperty` | Set a single element property/attribute |
| `setProperties` | Set multiple properties from an object |
| `delegate` | Register delegated event handler |
| `on` | Register direct-attach event handler |
| `onactive` | Register a cancelable handler for a passive event, bound while a gesture on the element lasts |
| `ondocument` | Register an owner-scoped document event handler |
| `onwindow` | Register an owner-scoped window event handler |
| `onconnect` | Lifecycle: element connected to DOM, just before its first paint |
| `ondisconnect` | Lifecycle: element disconnected from DOM |
| `onfirstpaint` | Lifecycle: once, the frame after the element's first paint |
| `ontick` | Lifecycle: RAF animation loop |
| `runtime` | Route event name to correct handler |
| `slot` | Static slot rendering |
| `ArraySlot` | Reactive array rendering |
| `VirtualSlot` | Virtualized reactive array rendering |
| `EffectSlot` | Reactive effect rendering |
| `clone` | Clone a node (uses `importNode` on Firefox) |
| `EMPTY_FRAGMENT` | Shared empty document fragment |
| `marker` | Slot position comment node |
| `template` | Create cached template factory |
| `text` | Create text node |
| `accept` | HMR accept handler (dev only) |
| `createHotTemplate` | HMR template factory (dev only) |

### Types

```typescript
type Renderable<T> = ArraySlot<T> | DocumentFragment | Effect<T> | Node | NodeList | Primitive | Renderable<T>[];
type Effect<T> = (dispose: VoidFunction) => Renderable<T>;
type Element<T extends HTMLElement = HTMLElement> = T & Attributes<T>;
type Attribute<T extends HTMLElement = HTMLElement> = Primitive | ((element: T) => Primitive | Primitive[]);
type Attributes<T extends HTMLElement = HTMLElement> = {
    class?: Attribute<T> | Attribute<T>[];
    style?: Attribute<T> | Attribute<T>[];
    onconnect?: (element: T) => void;
    ondisconnect?: (element: T) => void;
    onfirstpaint?: (element: T) => void;
    ontick?: (dispose: VoidFunction, element: T) => void;
} & { [K in keyof GlobalEventHandlersEventMap as `on${K}` | `once${K}`]?: (this: T, event: GlobalEventHandlersEventMap[K]) => void }
  & { [K in keyof DocumentEventMap as `ondocument${K}` | `oncedocument${K}`]?: (this: T, event: DocumentEventMap[K]) => void }
  & { [K in keyof WindowEventMap as `onwindow${K}` | `oncewindow${K}`]?: (this: T, event: WindowEventMap[K]) => void }
  & { [K in 'touchmove' | 'touchstart' | 'wheel' as `onactive${K}`]?: (this: T, event: GlobalEventHandlersEventMap[K]) => void }
  & Record<PropertyKey, unknown>;

type Factory<A, C, R> = {
    (): R;
    <T extends A>(attributes: T): R;
    <T extends C>(content: T): R;
    (attributes: A, content?: C): R;
    bind(context: { attributes?: Partial<A>, content?: C }): Factory<A, C, R>;
};
```

`Attributes` types the keys the runtime treats specially: `class`/`style` lists, lifecycle hooks, and event listeners, whose `event` and `this` are typed per event. Every other key (DOM properties, `aria-*`, `data-*`, SVG attributes, custom attributes) falls through to `Record<PropertyKey, unknown>`, so components can declare their own props with any name. `Attributes<HTMLInputElement>` narrows the element passed to listeners, lifecycle hooks, and attribute effects; parameters are checked bivariantly, so `(el: HTMLInputElement) => ...` is accepted where `HTMLElement` is expected.

Content effects receive a disposer that tears down their slot; attribute effects receive the element they are bound to. `component()` returns a `Factory`, whose `bind` presets a partial set of attributes.

### render(parent, factory) / render(parent, attributes, factory)

Calls the factory once, untracked, inside a root of its own and mounts what it returns into the parent; returns a
disposer. Everything the factory builds is owned by that root, so its slots are nested under it. A factory returning a
function renders that function reactively, as any function slot does. Calling the disposer removes the mounted
content, stops its reactive bindings, and unbinds any attributes `render` set on the parent. Pending frame or async
work from the mounted content is dropped.

```typescript
import { html, render } from '@esportsplus/template';

const App = () => html`<div>App</div>`;
const dispose = render(document.getElementById('root'), () => App());

render(document.body, { class: 'dark' }, () => App());
dispose();
```

## Complete Example

```typescript
import { html, render } from '@esportsplus/template';

type Todo = { id: number; text: string; done: boolean };

const TodoItem = (todo: Todo, onToggle: () => void, onDelete: () => void) => html`
    <li class="${() => todo.done ? 'completed' : ''}">
        <input type="checkbox"
            checked="${() => todo.done}"
            onchange="${onToggle}">
        <span>${todo.text}</span>
        <button onclick="${onDelete}">Delete</button>
    </li>
`;

const TodoApp = (state: {
    todos: Todo[];
    input: string;
    addTodo: () => void;
    toggleTodo: (id: number) => void;
    deleteTodo: (id: number) => void;
    setInput: (value: string) => void;
}) => html`
    <div class="todo-app">
        <h1>Todos</h1>
        <form onsubmit="${(e: Event) => { e.preventDefault(); state.addTodo(); }}">
            <input type="text"
                value="${() => state.input}"
                oninput="${(e: Event) => state.setInput((e.target as HTMLInputElement).value)}"
                placeholder="Add todo...">
            <button type="submit">Add</button>
        </form>
        <ul>
            ${html.reactive(state.todos, todo =>
                TodoItem(
                    todo,
                    () => state.toggleTodo(todo.id),
                    () => state.deleteTodo(todo.id)
                )
            )}
        </ul>
    </div>
`;

// Mount
render(document.body, () => TodoApp(/* state */));
```

## How Transformation Works

The transformer converts template literals into optimized code at build time:

**Input:**
```typescript
const greeting = (name: string) => html`<div class="hello">${name}</div>`;
```

**Output (simplified):**
```typescript
const $template = (() => {
    let cached;
    return () => {
        if (!cached) cached = template('<div class="hello"><!--$--></div>');
        return clone(cached);
    };
})();

const greeting = (name: string) => {
    const fragment = $template();
    const $0 = firstChild(fragment);
    slot($0.firstChild, name);
    return fragment;
};
```

Key optimizations:
- Template HTML is parsed once and cached
- Slot positions are computed at compile time
- Type analysis determines optimal slot binding
- No runtime template parsing

## Dependencies

- `@esportsplus/reactivity` - Reactive primitives
- `@esportsplus/queue` - Object pooling
- `@esportsplus/typescript` - TypeScript compiler utilities
- `@esportsplus/utilities` - Utility functions

## License

MIT
