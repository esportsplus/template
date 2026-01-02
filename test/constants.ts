// Test Constants - Imported values for template testing
// Tests that imported constants are properly handled during compilation


// String constants
export const APP_NAME = 'Template Test App';
export const VERSION = '1.0.0';
export const DEFAULT_CLASS = 'container mx-auto p-4';
export const ACTIVE_CLASS = 'active bg-blue-500 text-white';
export const INACTIVE_CLASS = 'inactive bg-gray-200 text-gray-600';

// Style constants
export const FLEX_CENTER = 'display: flex; align-items: center; justify-content: center;';
export const HIDDEN_STYLE = 'display: none; visibility: hidden;';

// Number constants
export const MAX_ITEMS = 100;
export const DEFAULT_TIMEOUT = 3000;
export const COLUMNS = 3;

// Object constants
export const DEFAULT_ATTRS = {
    class: 'default-element',
    'data-testid': 'test-element',
    tabindex: 0
};

export const BUTTON_ATTRS = {
    class: 'btn btn-primary',
    type: 'button',
    'data-action': 'click'
};

// Array constants
export const NAV_ITEMS = ['Home', 'About', 'Products', 'Contact'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Enum-like constants
export const STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
} as const;

export const THEME = {
    LIGHT: 'theme-light',
    DARK: 'theme-dark',
    SYSTEM: 'theme-system'
} as const;

// Function constants (for event handlers)
export const noop = () => {};
export const preventDefault = (e: Event) => e.preventDefault();
export const stopPropagation = (e: Event) => e.stopPropagation();

// Complex object for spread testing
export type CardData = {
    class: string;
    'data-id': number;
    'data-type': string;
    onclick?: () => void;
};

export const createCardAttrs = (id: number, type: string): CardData => ({
    class: `card card-${type}`,
    'data-id': id,
    'data-type': type
});
