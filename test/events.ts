// Event Templates - Event handler routing
// Tests delegate, direct, and lifecycle event detection


import { html } from '../src';


// =============================================================================
// DELEGATE EVENTS (most common - bubbles up)
// =============================================================================

// Click event
export const eventClick = (handler: () => void) =>
    html`<button onclick="${handler}">Click me</button>`;

// Double click
export const eventDblClick = (handler: () => void) =>
    html`<div ondblclick="${handler}">Double click</div>`;

// Context menu
export const eventContextMenu = (handler: (e: MouseEvent) => void) =>
    html`<div oncontextmenu="${handler}">Right click</div>`;

// Keyboard events
export const eventKeydown = (handler: (e: KeyboardEvent) => void) =>
    html`<input type="text" onkeydown="${handler}">`;

export const eventKeyup = (handler: (e: KeyboardEvent) => void) =>
    html`<input type="text" onkeyup="${handler}">`;

export const eventKeypress = (handler: (e: KeyboardEvent) => void) =>
    html`<input type="text" onkeypress="${handler}">`;

// Input events
export const eventInput = (handler: (e: Event) => void) =>
    html`<input type="text" oninput="${handler}">`;

export const eventChange = (handler: (e: Event) => void) =>
    html`<select onchange="${handler}"><option>A</option><option>B</option></select>`;

// Mouse button events
export const eventMousedown = (handler: (e: MouseEvent) => void) =>
    html`<div onmousedown="${handler}">Mouse down</div>`;

export const eventMouseup = (handler: (e: MouseEvent) => void) =>
    html`<div onmouseup="${handler}">Mouse up</div>`;


// =============================================================================
// DIRECT ATTACH EVENTS (don't bubble, need direct listener)
// =============================================================================

// Focus events
export const eventFocus = (handler: (e: FocusEvent) => void) =>
    html`<input type="text" onfocus="${handler}">`;

export const eventBlur = (handler: (e: FocusEvent) => void) =>
    html`<input type="text" onblur="${handler}">`;

export const eventFocusin = (handler: (e: FocusEvent) => void) =>
    html`<div onfocusin="${handler}"><input type="text"></div>`;

export const eventFocusout = (handler: (e: FocusEvent) => void) =>
    html`<div onfocusout="${handler}"><input type="text"></div>`;

// Media events
export const eventPlay = (handler: () => void) =>
    html`<video onplay="${handler}"><source src="video.mp4"></video>`;

export const eventPause = (handler: () => void) =>
    html`<video onpause="${handler}"><source src="video.mp4"></video>`;

export const eventEnded = (handler: () => void) =>
    html`<video onended="${handler}"><source src="video.mp4"></video>`;

export const eventTimeupdate = (handler: (e: Event) => void) =>
    html`<video ontimeupdate="${handler}"><source src="video.mp4"></video>`;

// Form events
export const eventSubmit = (handler: (e: Event) => void) =>
    html`<form onsubmit="${handler}"><button type="submit">Submit</button></form>`;

export const eventReset = (handler: () => void) =>
    html`<form onreset="${handler}"><button type="reset">Reset</button></form>`;

// Resource events
export const eventLoad = (handler: () => void) =>
    html`<img onload="${handler}" src="image.png">`;

export const eventError = (handler: () => void) =>
    html`<img onerror="${handler}" src="missing.png">`;

// Scroll event
export const eventScroll = (handler: (e: Event) => void) =>
    html`<div onscroll="${handler}" style="overflow: auto; height: 100px">Content</div>`;


// =============================================================================
// LIFECYCLE EVENTS (custom template events)
// =============================================================================

// onconnect - element added to DOM
export const eventConnect = (handler: (el: HTMLElement) => void) =>
    html`<div onconnect="${handler}">Connected</div>`;

// ondisconnect - element removed from DOM
export const eventDisconnect = (handler: (el: HTMLElement) => void) =>
    html`<div ondisconnect="${handler}">Will disconnect</div>`;

// onrender - after template renders
export const eventRender = (handler: (el: HTMLElement) => void) =>
    html`<div onrender="${handler}">Rendered</div>`;

// onresize - element resized
export const eventResize = (handler: (el: HTMLElement) => void) =>
    html`<div onresize="${handler}">Resizable</div>`;

// ontick - animation frame tick
export const eventTick = (handler: (dispose: () => void, el: HTMLElement) => void) =>
    html`<div ontick="${handler}">Animating</div>`;


// =============================================================================
// MULTIPLE EVENTS - SAME ELEMENT
// =============================================================================

// Mouse enter/leave
export const eventMouseEnterLeave = (
    enter: (e: MouseEvent) => void,
    leave: (e: MouseEvent) => void
) => html`<div onmouseenter="${enter}" onmouseleave="${leave}">Hover me</div>`;

// Click and context menu
export const eventClickContext = (
    click: () => void,
    context: (e: MouseEvent) => void
) => html`<div onclick="${click}" oncontextmenu="${context}">Click or right-click</div>`;

// Input handlers
export const eventInputFull = (
    input: (e: Event) => void,
    focus: () => void,
    blur: () => void
) => html`<input type="text" oninput="${input}" onfocus="${focus}" onblur="${blur}">`;

// Lifecycle combo
export const eventLifecycleFull = (
    connect: (el: HTMLElement) => void,
    disconnect: (el: HTMLElement) => void,
    render: (el: HTMLElement) => void
) => html`<div
    onconnect="${connect}"
    ondisconnect="${disconnect}"
    onrender="${render}"
>Lifecycle element</div>`;


// =============================================================================
// EVENTS WITH ATTRIBUTES
// =============================================================================

// Event with class
export const eventWithClass = (cls: string, handler: () => void) =>
    html`<button class="${cls}" onclick="${handler}">Styled button</button>`;

// Event with multiple attributes
export const eventWithMultiAttr = (
    id: string,
    cls: string,
    handler: () => void
) => html`<button id="${id}" class="${cls}" onclick="${handler}">Action</button>`;

// Event with data attributes
export const eventWithData = (
    itemId: string,
    handler: (e: MouseEvent) => void
) => html`<button data-item-id="${itemId}" onclick="${handler}">Item action</button>`;


// =============================================================================
// EVENTS IN NESTED TEMPLATES
// =============================================================================

// Click handler in map
export const eventInMap = (items: { text: string; onClick: () => void }[]) =>
    html`<ul>${items.map(item =>
        html`<li onclick="${item.onClick}">${item.text}</li>`
    )}</ul>`;

// Multiple events in map
export const eventMultipleInMap = (items: {
    text: string;
    onClick: () => void;
    onMouseEnter: () => void;
}[]) => html`<ul>${items.map(item =>
    html`<li onclick="${item.onClick}" onmouseenter="${item.onMouseEnter}">${item.text}</li>`
)}</ul>`;

// Lifecycle in map
export const eventLifecycleInMap = (items: {
    text: string;
    onConnect: (el: HTMLElement) => void;
}[]) => html`<ul>${items.map(item =>
    html`<li onconnect="${item.onConnect}">${item.text}</li>`
)}</ul>`;


// =============================================================================
// EVENT HANDLER PATTERNS
// =============================================================================

// Inline arrow handler
export const eventInlineArrow = (state: { count: number }) =>
    html`<button onclick="${() => state.count++}">Increment</button>`;

// Method reference
export const eventMethodRef = (controller: { handleClick: () => void }) =>
    html`<button onclick="${controller.handleClick}">Controller action</button>`;

// Bound method
export const eventBoundMethod = (obj: { value: number; increment: () => void }) =>
    html`<button onclick="${obj.increment.bind(obj)}">Bound increment</button>`;


// =============================================================================
// COMPLEX EVENT PATTERNS
// =============================================================================

// Interactive card
export const eventInteractiveCard = (card: {
    title: string;
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}) => html`
    <div class="card"
        onclick="${card.onClick}"
        onmouseenter="${card.onMouseEnter}"
        onmouseleave="${card.onMouseLeave}"
    >
        <h3>${card.title}</h3>
    </div>
`;

// Form with events
export const eventForm = (form: {
    onSubmit: (e: Event) => void;
    onReset: () => void;
    onInputChange: (e: Event) => void;
}) => html`
    <form onsubmit="${form.onSubmit}" onreset="${form.onReset}">
        <input type="text" oninput="${form.onInputChange}">
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
    </form>
`;

// Draggable element
export const eventDraggable = (handlers: {
    onDragStart: (e: DragEvent) => void;
    onDrag: (e: DragEvent) => void;
    onDragEnd: (e: DragEvent) => void;
}) => html`
    <div draggable="true"
        ondragstart="${handlers.onDragStart}"
        ondrag="${handlers.onDrag}"
        ondragend="${handlers.onDragEnd}"
    >Drag me</div>
`;

// Drop zone
export const eventDropZone = (handlers: {
    onDragOver: (e: DragEvent) => void;
    onDragEnter: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
}) => html`
    <div class="drop-zone"
        ondragover="${handlers.onDragOver}"
        ondragenter="${handlers.onDragEnter}"
        ondragleave="${handlers.onDragLeave}"
        ondrop="${handlers.onDrop}"
    >Drop here</div>
`;


// =============================================================================
// TOUCH EVENTS (for mobile)
// =============================================================================

export const eventTouch = (handlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
}) => html`
    <div
        ontouchstart="${handlers.onTouchStart}"
        ontouchmove="${handlers.onTouchMove}"
        ontouchend="${handlers.onTouchEnd}"
    >Touch area</div>
`;


// =============================================================================
// POINTER EVENTS
// =============================================================================

export const eventPointer = (handlers: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
}) => html`
    <div
        onpointerdown="${handlers.onPointerDown}"
        onpointermove="${handlers.onPointerMove}"
        onpointerup="${handlers.onPointerUp}"
    >Pointer area</div>
`;
