# @esportsplus/template

High-performance, compiler-optimized HTML templating library for JavaScript/TypeScript. Templates are transformed at build time into optimized DOM manipulation code with zero runtime parsing overhead.

## Features

- **Compile-time transformation** - Templates converted to optimized code during build
- **Zero runtime parsing** - No template parsing at runtime
- **Reactive integration** - Works with `@esportsplus/reactivity` for dynamic updates
- **Event delegation** - Efficient event handling with automatic delegation
- **Lifecycle events** - `onconnect`, `ondisconnect`, `onrender`, `onresize`, `ontick`
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
    plugins: [template]
});
```

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

// Render to DOM
render(document.body, greeting);
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

### Spread Attributes

```typescript
// Spread object as attributes
const spread = (attrs: Record<string, unknown>) => html`<div ${attrs}></div>`;

// With static attributes
const spreadMixed = (attrs: Record<string, unknown>) =>
    html`<div class="base" ${attrs}></div>`;
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

## Events

### Standard DOM Events

Events use delegation by default for efficiency:

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

### Lifecycle Events

Custom lifecycle events for DOM attachment:

```typescript
// Called when element is added to DOM
const connect = (handler: (el: HTMLElement) => void) =>
    html`<div onconnect="${handler}">Connected</div>`;

// Called when element is removed from DOM
const disconnect = (handler: (el: HTMLElement) => void) =>
    html`<div ondisconnect="${handler}">Will disconnect</div>`;

// Called after template renders
const render = (handler: (el: HTMLElement) => void) =>
    html`<div onrender="${handler}">Rendered</div>`;

// Called on element resize
const resize = (handler: (el: HTMLElement) => void) =>
    html`<div onresize="${handler}">Resizable</div>`;

// Called on animation frame (with dispose function)
const tick = (handler: (dispose: () => void, el: HTMLElement) => void) =>
    html`<div ontick="${handler}">Animating</div>`;
```

### Direct Attach Events

Some events don't bubble and are attached directly:

- `onfocus`, `onblur`, `onfocusin`, `onfocusout`
- `onload`, `onerror`
- `onplay`, `onpause`, `onended`, `ontimeupdate`
- `onscroll`

```typescript
const input = (focus: () => void, blur: () => void) =>
    html`<input onfocus="${focus}" onblur="${blur}">`;
```

## SVG Support

Use `svg` for SVG templates:

```typescript
import { svg } from '@esportsplus/template';

const circle = (fill: string) =>
    svg`<svg width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="${fill}"/>
    </svg>`;
```

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `html` | Template literal tag for HTML |
| `svg` | Template literal tag for SVG |
| `render` | Mount renderable to DOM element |
| `attributes` | Attribute manipulation utilities |
| `event` | Event system |
| `slot` | Slot rendering |
| `ArraySlot` | Reactive array rendering |
| `EffectSlot` | Reactive effect rendering |

### Types

```typescript
type Renderable = DocumentFragment | Node | string | number | null | undefined;
type Element = HTMLElement & { [STORE]?: Record<string, unknown> };
type Attributes = Record<string, unknown>;
```

### render(parent, renderable)

Mounts a renderable to a parent element.

```typescript
import { html, render } from '@esportsplus/template';

const app = html`<div>App</div>`;
render(document.getElementById('root'), app);
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
render(document.body, TodoApp(/* state */));
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
