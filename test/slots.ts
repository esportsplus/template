// Slot Templates - Single and multiple slot bindings
// Tests text slots, attribute slots, and mixed combinations


import { html } from '../src';


// =============================================================================
// SINGLE TEXT SLOTS
// =============================================================================

// Basic text slot
export const textSimple = (text: string) => html`<div>${text}</div>`;

// Text in span
export const textInSpan = (text: string) => html`<span>${text}</span>`;

// Text in paragraph
export const textInParagraph = (text: string) => html`<p>${text}</p>`;

// Text in heading
export const textInHeading = (text: string) => html`<h1>${text}</h1>`;

// Text in button
export const textInButton = (text: string) => html`<button>${text}</button>`;

// Text in nested element
export const textNested = (text: string) =>
    html`<div><span><strong>${text}</strong></span></div>`;


// =============================================================================
// SINGLE ATTRIBUTE SLOTS
// =============================================================================

// Class attribute
export const attrClass = (cls: string) => html`<div class="${cls}"></div>`;

// ID attribute
export const attrId = (id: string) => html`<div id="${id}"></div>`;

// Style attribute
export const attrStyle = (style: string) => html`<div style="${style}"></div>`;

// Data attribute
export const attrData = (value: string) => html`<div data-value="${value}"></div>`;

// Custom data attribute
export const attrDataCustom = (id: string) => html`<div data-item-id="${id}"></div>`;

// Href attribute
export const attrHref = (url: string) => html`<a href="${url}">Link</a>`;

// Src attribute
export const attrSrc = (src: string) => html`<img src="${src}" alt="image">`;

// Value attribute
export const attrValue = (val: string) => html`<input type="text" value="${val}">`;

// Placeholder attribute
export const attrPlaceholder = (text: string) =>
    html`<input type="text" placeholder="${text}">`;


// =============================================================================
// MIXED STATIC AND DYNAMIC ATTRIBUTES
// =============================================================================

// Class with static prefix
export const attrClassWithStatic = (dynamic: string) =>
    html`<div class="base-class ${dynamic}"></div>`;

// Style with static prefix
export const attrStyleWithStatic = (dynamic: string) =>
    html`<div style="display: flex; ${dynamic}"></div>`;

// Multiple statics, one dynamic
export const attrMixedStatics = (cls: string) =>
    html`<div id="fixed-id" class="${cls}" data-static="value"></div>`;


// =============================================================================
// MULTIPLE TEXT SLOTS
// =============================================================================

// Two text slots
export const textTwo = (a: string, b: string) =>
    html`<div><span>${a}</span><span>${b}</span></div>`;

// Three text slots
export const textThree = (a: string, b: string, c: string) =>
    html`<div><span>${a}</span><span>${b}</span><span>${c}</span></div>`;

// Five text slots
export const textFive = (a: string, b: string, c: string, d: string, e: string) =>
    html`<div>
        <span>${a}</span>
        <span>${b}</span>
        <span>${c}</span>
        <span>${d}</span>
        <span>${e}</span>
    </div>`;

// Adjacent text slots (no element separators)
export const textAdjacent = (a: string, b: string, c: string) =>
    html`<div>${a}${b}${c}</div>`;


// =============================================================================
// MULTIPLE ATTRIBUTE SLOTS - SAME ELEMENT
// =============================================================================

// Two attributes
export const attrTwo = (id: string, cls: string) =>
    html`<div id="${id}" class="${cls}"></div>`;

// Three attributes
export const attrThree = (id: string, cls: string, style: string) =>
    html`<div id="${id}" class="${cls}" style="${style}"></div>`;

// All common attributes
export const attrFull = (
    id: string,
    cls: string,
    style: string,
    dataId: string,
    title: string
) => html`<div
    id="${id}"
    class="${cls}"
    style="${style}"
    data-id="${dataId}"
    title="${title}"
></div>`;


// =============================================================================
// MULTIPLE ATTRIBUTE SLOTS - DIFFERENT ELEMENTS
// =============================================================================

// Attributes on sibling elements
export const attrSiblings = (cls1: string, cls2: string) =>
    html`<div><span class="${cls1}">First</span><span class="${cls2}">Second</span></div>`;

// Attributes on nested elements
export const attrNested = (outerCls: string, innerCls: string) =>
    html`<div class="${outerCls}"><span class="${innerCls}">Content</span></div>`;


// =============================================================================
// MIXED TEXT AND ATTRIBUTE SLOTS
// =============================================================================

// Attribute and text on same element
export const mixedSame = (cls: string, text: string) =>
    html`<div class="${cls}">${text}</div>`;

// Multiple mixed on same element
export const mixedSameFull = (id: string, cls: string, style: string, text: string) =>
    html`<div id="${id}" class="${cls}" style="${style}">${text}</div>`;

// Mixed across elements
export const mixedAcross = (cls: string, text: string) =>
    html`<article class="${cls}"><p>${text}</p></article>`;

// Complex mixed pattern
export const mixedComplex = (
    wrapperCls: string,
    headerText: string,
    bodyCls: string,
    bodyText: string,
    footerText: string
) => html`
    <article class="${wrapperCls}">
        <header>${headerText}</header>
        <main class="${bodyCls}">${bodyText}</main>
        <footer>${footerText}</footer>
    </article>
`;


// =============================================================================
// FORM INPUT SLOTS
// =============================================================================

// Text input
export const inputText = (name: string, value: string, placeholder: string) =>
    html`<input type="text" name="${name}" value="${value}" placeholder="${placeholder}">`;

// Email input
export const inputEmail = (value: string) =>
    html`<input type="email" value="${value}" placeholder="email@example.com">`;

// Checkbox input
export const inputCheckbox = (name: string, value: string, label: string) =>
    html`<label><input type="checkbox" name="${name}" value="${value}"> ${label}</label>`;

// Full form
export const formComplete = (
    name: string,
    email: string,
    message: string,
    submitText: string
) => html`
    <form>
        <input type="text" name="name" value="${name}" placeholder="Name">
        <input type="email" name="email" value="${email}" placeholder="Email">
        <textarea name="message">${message}</textarea>
        <button type="submit">${submitText}</button>
    </form>
`;


// =============================================================================
// DEEP PATH SLOTS (path ancestor caching test)
// =============================================================================

// Slot at depth 4
export const deepPath4 = (text: string) =>
    html`<div><div><div><div>${text}</div></div></div></div>`;

// Slot at depth 6
export const deepPath6 = (text: string) =>
    html`<div><div><div><div><div><div>${text}</div></div></div></div></div></div>`;

// Multiple slots at same depth (should share ancestors)
export const deepPathShared = (a: string, b: string) =>
    html`<div><div><div><span>${a}</span><span>${b}</span></div></div></div>`;

// Slots at different depths
export const deepPathMixed = (shallow: string, deep: string) =>
    html`<div>
        <span>${shallow}</span>
        <div><div><div><span>${deep}</span></div></div></div>
    </div>`;


// =============================================================================
// WIDE SIBLING SLOTS (nextSibling traversal test)
// =============================================================================

// 10 sibling text slots
export const wideSiblings10 = (v: string[]) =>
    html`<div>
        <span>${v[0]}</span><span>${v[1]}</span><span>${v[2]}</span>
        <span>${v[3]}</span><span>${v[4]}</span><span>${v[5]}</span>
        <span>${v[6]}</span><span>${v[7]}</span><span>${v[8]}</span>
        <span>${v[9]}</span>
    </div>`;

// Alternating slots and static content
export const wideAlternating = (a: string, b: string, c: string) =>
    html`<div>
        <span>${a}</span>
        <span>static</span>
        <span>${b}</span>
        <span>static</span>
        <span>${c}</span>
    </div>`;
