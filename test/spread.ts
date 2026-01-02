// Spread Templates - Object spread attribute unpacking
// Tests compile-time unpacking of spread attributes


import { html } from '../src';


// =============================================================================
// SIMPLE SPREAD - OBJECT LITERAL (compile-time unpacking)
// =============================================================================

// Single property spread
export const spreadSingle = () =>
    html`<div ${{ class: 'spread-class' }}></div>`;

// Two property spread
export const spreadTwo = () =>
    html`<div ${{ id: 'my-id', class: 'my-class' }}></div>`;

// Multiple property spread
export const spreadMultiple = () =>
    html`<div ${{
        id: 'element-id',
        class: 'element-class',
        'data-id': '123',
        title: 'Element title'
    }}></div>`;


// =============================================================================
// SPREAD WITH CLASS AND STYLE
// =============================================================================

// Spread with class
export const spreadClass = () =>
    html`<div ${{ class: 'btn btn-primary' }}></div>`;

// Spread with style
export const spreadStyle = () =>
    html`<div ${{ style: 'color: red; font-size: 16px;' }}></div>`;

// Spread with both class and style
export const spreadClassStyle = () =>
    html`<div ${{
        class: 'container mx-auto',
        style: 'padding: 20px; margin: 10px;'
    }}></div>`;


// =============================================================================
// SPREAD WITH EVENTS (compile-time key detection)
// =============================================================================

// Spread with click event
export const spreadClickEvent = (onClick: () => void) =>
    html`<button ${{ onclick: onClick }}>Click</button>`;

// Spread with multiple events
export const spreadMultipleEvents = (
    onClick: () => void,
    onMouseEnter: () => void
) => html`<div ${{
    onclick: onClick,
    onmouseenter: onMouseEnter
}}>Interactive</div>`;

// Spread with lifecycle event
export const spreadLifecycleEvent = (onConnect: () => void) =>
    html`<div ${{ onconnect: onConnect }}>Lifecycle</div>`;


// =============================================================================
// SPREAD WITH DATA ATTRIBUTES
// =============================================================================

// Single data attribute
export const spreadDataSingle = () =>
    html`<div ${{ 'data-id': '123' }}></div>`;

// Multiple data attributes
export const spreadDataMultiple = () =>
    html`<div ${{
        'data-id': '123',
        'data-type': 'user',
        'data-action': 'view'
    }}></div>`;


// =============================================================================
// SPREAD - VARIABLE REFERENCE (TypeChecker unpacking)
// =============================================================================

// Typed object variable
type ButtonAttrs = {
    class: string;
    type: string;
    disabled?: boolean;
};

export const spreadTypedVar = (attrs: ButtonAttrs) =>
    html`<button ${attrs}>Button</button>`;

// Record type variable
export const spreadRecordVar = (attrs: Record<string, string>) =>
    html`<div ${attrs}></div>`;

// Partial type variable
type CardAttrs = {
    id?: string;
    class?: string;
    'data-card-id'?: string;
};

export const spreadPartialVar = (attrs: CardAttrs) =>
    html`<div ${attrs}></div>`;


// =============================================================================
// SPREAD WITH STATIC ATTRIBUTES
// =============================================================================

// Static before spread
export const spreadAfterStatic = (attrs: Record<string, unknown>) =>
    html`<div class="base" ${attrs}></div>`;

// Static after spread
export const spreadBeforeStatic = (attrs: Record<string, unknown>) =>
    html`<div ${attrs} class="override"></div>`;

// Spread between statics
export const spreadBetweenStatics = (attrs: Record<string, unknown>) =>
    html`<div id="fixed" ${attrs} class="also-fixed"></div>`;


// =============================================================================
// SPREAD IN NESTED TEMPLATES
// =============================================================================

// Spread in list items
export const spreadInList = (items: Record<string, unknown>[]) =>
    html`<ul>${items.map(attrs => html`<li ${attrs}>Item</li>`)}</ul>`;

// Spread with content
export const spreadInListWithContent = (items: { attrs: Record<string, unknown>; text: string }[]) =>
    html`<ul>${items.map(item => html`<li ${item.attrs}>${item.text}</li>`)}</ul>`;

// Typed spread in list
type ListItemAttrs = {
    class: string;
    'data-id': number;
};

export const spreadTypedInList = (items: { attrs: ListItemAttrs; text: string }[]) =>
    html`<ul>${items.map(item => html`<li ${item.attrs}>${item.text}</li>`)}</ul>`;


// =============================================================================
// COMPLEX SPREAD PATTERNS
// =============================================================================

// Spread with computed values in object literal
export const spreadComputed = (isActive: boolean, id: number) =>
    html`<div ${{
        class: isActive ? 'active' : 'inactive',
        'data-id': id.toString()
    }}></div>`;

// Multiple spreads on same element (edge case)
export const spreadDouble = (
    baseAttrs: Record<string, unknown>,
    extraAttrs: Record<string, unknown>
) => html`<div ${baseAttrs} ${extraAttrs}></div>`;


// =============================================================================
// SPREAD WITH INLINE HANDLERS
// =============================================================================

// Spread with inline arrow function
export const spreadInlineHandler = (state: { count: number }) =>
    html`<button ${{
        class: 'btn',
        onclick: () => state.count++
    }}>Increment</button>`;

// Spread with method reference
export const spreadMethodRef = (controller: {
    handleClick: () => void;
    handleHover: () => void;
}) => html`<div ${{
    onclick: controller.handleClick,
    onmouseenter: controller.handleHover
}}>Controller element</div>`;


// =============================================================================
// SPREAD - FALLBACK (runtime spread when can't unpack)
// =============================================================================

// Dynamic spread (can't unpack at compile time)
export const spreadDynamic = (getDynamicAttrs: () => Record<string, unknown>) =>
    html`<div ${getDynamicAttrs()}></div>`;

// Conditional spread
export const spreadConditional = (useAttrs: boolean, attrs: Record<string, unknown>) =>
    html`<div ${useAttrs ? attrs : {}}></div>`;


// =============================================================================
// REAL-WORLD SPREAD PATTERNS
// =============================================================================

// Input component with spread
type InputProps = {
    type: string;
    name: string;
    value: string;
    placeholder?: string;
    class?: string;
};

export const inputComponent = (props: InputProps) =>
    html`<input ${props}>`;

// Button component with spread
type ButtonProps = {
    class: string;
    type: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    onclick?: () => void;
};

export const buttonComponent = (props: ButtonProps, label: string) =>
    html`<button ${props}>${label}</button>`;

// Link component with spread
type LinkProps = {
    href: string;
    class?: string;
    target?: string;
    rel?: string;
};

export const linkComponent = (props: LinkProps, children: string) =>
    html`<a ${props}>${children}</a>`;

// Card component with spread
type CardProps = {
    class?: string;
    'data-card-id'?: string;
    onclick?: () => void;
};

export const cardComponent = (
    props: CardProps,
    content: { title: string; body: string }
) => html`
    <div ${props}>
        <h3>${content.title}</h3>
        <p>${content.body}</p>
    </div>
`;


// =============================================================================
// SPREAD STRESS TESTS
// =============================================================================

// Many properties
export const spreadManyProps = () =>
    html`<div ${{
        id: 'stress-id',
        class: 'stress-class-1 stress-class-2 stress-class-3',
        style: 'color: red; background: blue; padding: 10px;',
        'data-a': '1',
        'data-b': '2',
        'data-c': '3',
        'data-d': '4',
        'data-e': '5',
        title: 'Stress test element',
        tabindex: '0'
    }}></div>`;

// Spread in deep nesting
export const spreadDeepNesting = (attrs: Record<string, unknown>) =>
    html`<div><div><div><div ${attrs}>Deep</div></div></div></div>`;

// Many spreads in list
export const spreadManyInList = (items: Record<string, unknown>[]) =>
    html`<div>${items.slice(0, 20).map(attrs => html`<span ${attrs}>Item</span>`)}</div>`;
