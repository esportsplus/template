// Imported Values Templates - Using constants from external modules
// Tests that imported values are preserved correctly during compilation


import { html } from '../src';
import {
    ACTIVE_CLASS,
    APP_NAME,
    BUTTON_ATTRS,
    COLUMNS,
    createCardAttrs,
    DEFAULT_ATTRS,
    DEFAULT_CLASS,
    DEFAULT_TIMEOUT,
    FLEX_CENTER,
    HIDDEN_STYLE,
    INACTIVE_CLASS,
    MAX_ITEMS,
    NAV_ITEMS,
    noop,
    preventDefault,
    PRIORITIES,
    STATUS,
    stopPropagation,
    THEME,
    VERSION
} from './constants';


// =============================================================================
// IMPORTED STRING CONSTANTS
// =============================================================================

// Using imported string in text slot
export const importedTextSlot = () =>
    html`<h1>${APP_NAME}</h1>`;

// Using imported string in attribute
export const importedClassAttr = () =>
    html`<div class="${DEFAULT_CLASS}">Content</div>`;

// Using imported style string
export const importedStyleAttr = () =>
    html`<div style="${FLEX_CENTER}">Centered</div>`;

// Multiple imported strings
export const importedMultipleStrings = () =>
    html`<div class="${DEFAULT_CLASS}" style="${FLEX_CENTER}">
        <span>${APP_NAME}</span>
        <span>${VERSION}</span>
    </div>`;


// =============================================================================
// IMPORTED NUMBER CONSTANTS
// =============================================================================

// Number in text slot
export const importedNumberText = () =>
    html`<span>Max items: ${MAX_ITEMS}</span>`;

// Number in data attribute
export const importedNumberData = () =>
    html`<div data-timeout="${DEFAULT_TIMEOUT}">Timeout element</div>`;

// Number in style (grid columns)
export const importedNumberStyle = () =>
    html`<div style="grid-template-columns: repeat(${COLUMNS}, 1fr)">Grid</div>`;


// =============================================================================
// IMPORTED OBJECT CONSTANTS
// =============================================================================

// Spread with imported object
export const importedSpreadObject = () =>
    html`<div ${DEFAULT_ATTRS}>Default element</div>`;

// Spread with imported button attrs
export const importedSpreadButton = () =>
    html`<button ${BUTTON_ATTRS}>Action</button>`;

// Accessing object properties
export const importedObjectProperty = () =>
    html`<div class="${STATUS.ACTIVE}">Active status</div>`;

// Using enum-like constant
export const importedThemeClass = () =>
    html`<div class="${THEME.DARK}">Dark themed</div>`;


// =============================================================================
// IMPORTED ARRAY CONSTANTS
// =============================================================================

// Mapping over imported array
export const importedArrayMap = () =>
    html`<nav>
        <ul>${NAV_ITEMS.map(item => html`<li>${item}</li>`)}</ul>
    </nav>`;

// Using array with index
export const importedArrayIndex = () =>
    html`<ul>${NAV_ITEMS.map((item, i) =>
        html`<li data-index="${i}">${item}</li>`
    )}</ul>`;

// Priorities list
export const importedPriorities = () =>
    html`<select>
        ${PRIORITIES.map(p => html`<option value="${p}">${p}</option>`)}
    </select>`;


// =============================================================================
// IMPORTED FUNCTION CONSTANTS
// =============================================================================

// Using noop handler
export const importedNoopHandler = () =>
    html`<button onclick="${noop}">No-op button</button>`;

// Using preventDefault handler
export const importedPreventDefault = () =>
    html`<form onsubmit="${preventDefault}">
        <button type="submit">Submit</button>
    </form>`;

// Using stopPropagation handler
export const importedStopPropagation = () =>
    html`<div onclick="${stopPropagation}">
        <button>Contained click</button>
    </div>`;


// =============================================================================
// IMPORTED FUNCTION THAT RETURNS OBJECT (Factory)
// =============================================================================

// Using factory function for spread
export const importedFactory = () =>
    html`<div ${createCardAttrs(123, 'user')}>Card 123</div>`;

// Factory in list
export const importedFactoryInList = (ids: number[]) =>
    html`<div>${ids.map(id =>
        html`<div ${createCardAttrs(id, 'item')}>Item ${id}</div>`
    )}</div>`;


// =============================================================================
// CONDITIONAL USING IMPORTED VALUES
// =============================================================================

// Conditional class with imported constants
export const importedConditionalClass = (isActive: boolean) =>
    html`<div class="${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}">Status</div>`;

// Conditional style with imported constants
export const importedConditionalStyle = (isHidden: boolean) =>
    html`<div style="${isHidden ? HIDDEN_STYLE : FLEX_CENTER}">Visibility</div>`;

// Conditional with STATUS enum
export const importedConditionalEnum = (status: string) =>
    html`<div class="${
        status === STATUS.ACTIVE ? 'active' :
        status === STATUS.PENDING ? 'pending' :
        status === STATUS.COMPLETED ? 'completed' :
        'cancelled'
    }">${status}</div>`;


// =============================================================================
// TEMPLATE LITERALS WITH IMPORTED VALUES
// =============================================================================

// Interpolated in template literal text
export const importedInterpolatedText = () =>
    html`<p>${`Welcome to ${APP_NAME} v${VERSION}`}</p>`;

// Interpolated in class
export const importedInterpolatedClass = (variant: string) =>
    html`<button class="${`btn ${variant} ${DEFAULT_CLASS}`}">Button</button>`;


// =============================================================================
// COMPLEX COMBINATIONS
// =============================================================================

// Full component using multiple imports
export const importedFullComponent = (isActive: boolean) =>
    html`<div class="${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}" style="${FLEX_CENTER}">
        <h1>${APP_NAME}</h1>
        <nav>
            <ul>${NAV_ITEMS.map(item => html`<li>${item}</li>`)}</ul>
        </nav>
        <span>Version: ${VERSION}</span>
    </div>`;

// Card with imported factory and constants
export const importedCard = (id: number, type: string, title: string) =>
    html`<article ${createCardAttrs(id, type)}>
        <header class="${DEFAULT_CLASS}">
            <h2>${title}</h2>
            <span class="${THEME.LIGHT}">${type}</span>
        </header>
        <footer onclick="${noop}">
            <span>${APP_NAME}</span>
        </footer>
    </article>`;

// Priority list with theme
export const importedPriorityList = (currentPriority: string) =>
    html`<div class="${THEME.SYSTEM}">
        <h3>Select Priority</h3>
        <ul>${PRIORITIES.map(p =>
            html`<li class="${p === currentPriority ? ACTIVE_CLASS : INACTIVE_CLASS}">${p}</li>`
        )}</ul>
    </div>`;


// =============================================================================
// STRESS TESTS
// =============================================================================

// Many imported values
export const importedStress = () =>
    html`<div
        class="${DEFAULT_CLASS}"
        style="${FLEX_CENTER}"
        data-app="${APP_NAME}"
        data-version="${VERSION}"
        data-max="${MAX_ITEMS}"
        data-timeout="${DEFAULT_TIMEOUT}"
        onclick="${noop}"
    >
        ${NAV_ITEMS.map(item => html`<span>${item}</span>`)}
    </div>`;

// Nested with many imports
export const importedNestedStress = () =>
    html`<div class="${THEME.DARK}">
        ${PRIORITIES.map(priority =>
            html`<section class="${priority === 'critical' ? ACTIVE_CLASS : INACTIVE_CLASS}">
                <h2>${priority}</h2>
                ${NAV_ITEMS.map(item =>
                    html`<div ${DEFAULT_ATTRS} onclick="${stopPropagation}">
                        ${item} - ${priority}
                    </div>`
                )}
            </section>`
        )}
    </div>`;
