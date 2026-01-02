// Effect Templates - Reactive bindings and slot type detection
// Tests EffectSlot detection for arrow functions and reactive patterns


import { html } from '../src';


// =============================================================================
// ARROW FUNCTION EFFECTS (should detect as EffectSlot)
// =============================================================================

// Simple arrow function text
export const effectTextArrow = (getValue: () => string) =>
    html`<div>${getValue}</div>`;

// Arrow function class
export const effectClassArrow = (getClass: () => string) =>
    html`<div class="${getClass}"></div>`;

// Arrow function style
export const effectStyleArrow = (getStyle: () => string) =>
    html`<div style="${getStyle}"></div>`;

// Arrow function in nested element
export const effectNestedArrow = (getValue: () => string) =>
    html`<div><span><strong>${getValue}</strong></span></div>`;

// Multiple effect slots
export const effectMultiple = (getA: () => string, getB: () => string) =>
    html`<div><span>${getA}</span><span>${getB}</span></div>`;


// =============================================================================
// FUNCTION EXPRESSION EFFECTS
// =============================================================================

// Function returning string
export const effectFunctionString = (fn: () => string) =>
    html`<div>${fn}</div>`;

// Function returning number
export const effectFunctionNumber = (fn: () => number) =>
    html`<div>${fn}</div>`;

// Function returning boolean (conditional display)
export const effectFunctionBool = (fn: () => boolean) =>
    html`<div>${fn}</div>`;


// =============================================================================
// INLINE ARROW FUNCTIONS
// =============================================================================

// Inline arrow for text
export const effectInlineArrow = (state: { count: number }) =>
    html`<div>${() => state.count}</div>`;

// Inline arrow for computed class
export const effectInlineClass = (state: { active: boolean }) =>
    html`<div class="${() => state.active ? 'active' : 'inactive'}"></div>`;

// Inline arrow for computed style
export const effectInlineStyle = (state: { width: number }) =>
    html`<div style="${() => `width: ${state.width}px`}"></div>`;

// Multiple inline arrows
export const effectMultipleInline = (state: { x: number; y: number }) =>
    html`<div data-x="${() => state.x}" data-y="${() => state.y}">
        ${() => `Position: ${state.x}, ${state.y}`}
    </div>`;


// =============================================================================
// MIXED STATIC AND EFFECT
// =============================================================================

// Static class, effect text
export const mixedStaticEffect = (getValue: () => string) =>
    html`<div class="static-class">${getValue}</div>`;

// Effect class, static text
export const mixedEffectStatic = (getClass: () => string) =>
    html`<div class="${getClass}">Static text</div>`;

// Effect class with static prefix
export const mixedEffectClassPrefix = (getDynamic: () => string) =>
    html`<div class="base-class ${getDynamic}">Content</div>`;

// Multiple mixed
export const mixedMultiple = (
    staticValue: string,
    getEffectValue: () => string,
    getEffectClass: () => string
) => html`
    <div class="${getEffectClass}">
        <span>${staticValue}</span>
        <span>${getEffectValue}</span>
    </div>
`;


// =============================================================================
// EFFECTS IN NESTED TEMPLATES
// =============================================================================

// Effect inside map
export const effectInMap = (items: { getValue: () => string }[]) =>
    html`<ul>${items.map(item => html`<li>${item.getValue}</li>`)}</ul>`;

// Effect class inside map
export const effectClassInMap = (items: { getClass: () => string; text: string }[]) =>
    html`<ul>${items.map(item =>
        html`<li class="${item.getClass}">${item.text}</li>`
    )}</ul>`;

// Nested with multiple effects
export const effectNestedMultiple = (sections: {
    getTitle: () => string;
    items: { getValue: () => string }[];
}[]) => html`<div>${sections.map(section => html`
    <section>
        <h2>${section.getTitle}</h2>
        <ul>${section.items.map(item => html`<li>${item.getValue}</li>`)}</ul>
    </section>
`)}</div>`;


// =============================================================================
// CONDITIONAL EFFECTS
// =============================================================================

// Ternary with effects
export const effectTernary = (condition: () => boolean, a: () => string, b: () => string) =>
    html`<div>${() => condition() ? a() : b()}</div>`;

// Effect returning conditional class
export const effectConditionalClass = (getActive: () => boolean) =>
    html`<div class="${() => getActive() ? 'visible' : 'hidden'}"></div>`;


// =============================================================================
// STATIC VALUE DETECTION (should use textContent, not EffectSlot)
// =============================================================================

// String literal
export const staticString = () => html`<div>${'static text'}</div>`;

// Number literal
export const staticNumber = () => html`<div>${42}</div>`;

// Template literal (no substitutions)
export const staticTemplate = () => html`<div>${`static template`}</div>`;


// =============================================================================
// PRIMITIVE DETECTION (should use runtime slot)
// =============================================================================

// Variable string
export const primitiveString = (text: string) => html`<div>${text}</div>`;

// Variable number
export const primitiveNumber = (num: number) => html`<div>${num}</div>`;

// Template literal with substitution
export const primitiveTemplate = (name: string) =>
    html`<div>${`Hello, ${name}!`}</div>`;


// =============================================================================
// DOCUMENT FRAGMENT DETECTION (nested html)
// =============================================================================

// Nested html template
export const fragmentNested = (content: string) =>
    html`<div>${html`<span>${content}</span>`}</div>`;

// Conditional nested html
export const fragmentConditional = (show: boolean, content: string) =>
    html`<div>${show ? html`<span>${content}</span>` : html`<span>Hidden</span>`}</div>`;


// =============================================================================
// COMPLEX REACTIVE PATTERNS
// =============================================================================

// Counter component pattern
export const counterPattern = (state: { count: number; increment: () => void }) =>
    html`<div class="counter">
        <span>${() => state.count}</span>
        <button onclick="${state.increment}">+</button>
    </div>`;

// Toggle component pattern
export const togglePattern = (state: { active: boolean; toggle: () => void }) =>
    html`<div class="${() => state.active ? 'on' : 'off'}">
        <button onclick="${state.toggle}">Toggle</button>
    </div>`;

// Form field pattern
export const formFieldPattern = (field: {
    value: () => string;
    error: () => string | null;
    onInput: (e: Event) => void;
}) => html`
    <div class="field">
        <input type="text" value="${field.value}" oninput="${field.onInput}">
        <span class="${() => field.error() ? 'error visible' : 'error'}">${field.error}</span>
    </div>
`;

// Dynamic list pattern
export const dynamicListPattern = (list: {
    items: () => string[];
    addItem: () => void;
}) => html`
    <div class="dynamic-list">
        <ul>${() => list.items().map(item => html`<li>${item}</li>`)}</ul>
        <button onclick="${list.addItem}">Add Item</button>
    </div>
`;


// =============================================================================
// STRESS TESTS
// =============================================================================

// Many effect slots
export const stressEffects = (getters: (() => string)[]) =>
    html`<div>
        ${getters[0]}${getters[1]}${getters[2]}${getters[3]}${getters[4]}
        ${getters[5]}${getters[6]}${getters[7]}${getters[8]}${getters[9]}
    </div>`;

// Deep effect nesting
export const stressDeepEffect = (getValue: () => string) =>
    html`<div><div><div><div><div>${getValue}</div></div></div></div></div>`;
