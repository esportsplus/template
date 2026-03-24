/**
 * Extensive compiler integration tests
 * Tests both reactivity and template compilers working together
 */
import { html, reactive } from '@esportsplus/frontend';


// ============================================================================
// Test 1: Primitive Signals in Templates
// ============================================================================

function testPrimitiveSignals() {
    let count = reactive(0),
        enabled = reactive(true),
        message = reactive('Hello'),
        price = reactive(19.99);

    // Template with primitive expressions
    let view = html`
        <div class="counter">
            <span class="count">${count}</span>
            <span class="enabled">${enabled}</span>
            <span class="message">${message}</span>
            <span class="price">${price}</span>
        </div>
    `;

    // Increment/decrement operations
    count++;
    count--;
    count += 5;
    count -= 2;
    count *= 2;

    // Boolean toggle
    enabled = !enabled;

    // String operations
    message = message + ' World';

    return { count, enabled, message, price, view };
}


// ============================================================================
// Test 2: Computed Values in Templates
// ============================================================================

function testComputedValues() {
    let firstName = reactive('John'),
        lastName = reactive('Doe'),
        items = reactive([1, 2, 3, 4, 5] as number[]);

    // Computed values
    let fullName = reactive(() => `${firstName} ${lastName}`),
        itemCount = reactive(() => items.length),
        doubled = reactive(() => items.map(x => x * 2)),
        total = reactive(() => items.reduce((a, b) => a + b, 0));

    let view = html`
        <div class="computed">
            <h1>${fullName}</h1>
            <p>Items: ${itemCount}</p>
            <p>Total: ${total}</p>
            <ul>
                ${() => doubled.map(n => html`<li>${n}</li>`)}
            </ul>
        </div>
    `;

    // Trigger reactivity
    firstName = 'Jane';
    items.push(6);

    return { doubled, firstName, fullName, itemCount, items, lastName, total, view };
}


// ============================================================================
// Test 3: Reactive Arrays in Templates
// ============================================================================

function testReactiveArrays() {
    let numbers = reactive([1, 2, 3] as number[]),
        strings = reactive(['a', 'b', 'c'] as string[]),
        mixed = reactive([1, 'two', 3, 'four'] as (number | string)[]);

    // Array with reactive rendering
    let view = html`
        <div class="arrays">
            <section>
                <h2>Numbers</h2>
                ${html.reactive(numbers, (n) => html`<span class="num">${n}</span>`)}
            </section>
            <section>
                <h2>Strings</h2>
                ${html.reactive(strings, (s) => html`<span class="str">${s}</span>`)}
            </section>
            <section>
                <h2>Mixed</h2>
                ${html.reactive(mixed, (m) => html`<span class="mix">${m}</span>`)}
            </section>
        </div>
    `;

    // Array mutations
    numbers.push(4);
    numbers.unshift(0);
    numbers[2] = 99;

    strings.pop();
    strings.shift();
    strings.splice(0, 0, 'inserted');

    // Length access (reactive)
    let numLen = numbers.length,
        strLen = strings.length;

    return { mixed, numLen, numbers, strLen, strings, view };
}


// ============================================================================
// Test 4: Reactive Objects in Templates
// ============================================================================

function testReactiveObjects() {
    // Simple reactive object
    let user = reactive({
        age: 25,
        email: 'john@example.com',
        name: 'John'
    });

    // Reactive object with computed
    let product = reactive({
        discount: 0.1,
        finalPrice: () => product.price * (1 - product.discount),
        price: 100
    });

    // Nested data in reactive object
    let config = reactive({
        debug: false,
        features: {
            darkMode: true,
            notifications: false
        },
        theme: 'light'
    });

    let view = html`
        <div class="objects">
            <section class="user">
                <h2>${user.name}</h2>
                <p>Age: ${user.age}</p>
                <p>Email: ${user.email}</p>
            </section>
            <section class="product">
                <p>Price: $${product.price}</p>
                <p>Discount: ${() => product.discount * 100}%</p>
                <p>Final: $${product.finalPrice}</p>
            </section>
            <section class="config">
                <p>Theme: ${config.theme}</p>
                <p>Debug: ${config.debug}</p>
            </section>
        </div>
    `;

    // Object mutations
    user.name = 'Jane';
    user.age++;

    product.price = 150;
    product.discount = 0.2;

    config.theme = 'dark';
    config.debug = true;

    return { config, product, user, view };
}


// ============================================================================
// Test 5: Complex Nested Reactivity
// ============================================================================

function testComplexNested() {
    let state = reactive({
        counts: reactive([0, 0, 0] as number[]),
        currentIndex: 0,
        increment: () => {
            state.counts[state.currentIndex]++;
        },
        items: reactive([
            { id: 1, name: 'Item 1', selected: false },
            { id: 2, name: 'Item 2', selected: true },
            { id: 3, name: 'Item 3', selected: false }
        ] as { id: number; name: string; selected: boolean }[]),
        selectedCount: () => state.items.filter(i => i.selected).length,
        total: () => state.counts.reduce((a, b) => a + b, 0)
    });

    let view = html`
        <div class="complex">
            <header>
                <span>Total: ${state.total}</span>
                <span>Selected: ${state.selectedCount}</span>
            </header>
            <main>
                ${html.reactive(state.items, (item) => html`
                    <div class="item ${() => item.selected ? 'selected' : ''}">
                        <span>${item.name}</span>
                        <input type="checkbox" checked=${() => item.selected} />
                    </div>
                `)}
            </main>
            <footer>
                ${html.reactive(state.counts, (count, i) => html`
                    <button onclick=${() => { state.currentIndex = i; state.increment(); }}>
                        Count ${i}: ${count}
                    </button>
                `)}
            </footer>
        </div>
    `;

    // Trigger updates
    state.items[0].selected = true;
    state.counts[0] = 5;
    state.currentIndex = 1;

    return { state, view };
}


// ============================================================================
// Test 6: Conditional Rendering with Reactivity
// ============================================================================

function testConditionalRendering() {
    let showDetails = reactive(false),
        status = reactive<'loading' | 'error' | 'success'>('loading'),
        user = reactive<{ name: string } | null>(null);

    let view = html`
        <div class="conditional">
            ${() => showDetails ? html`<details>Expanded content</details>` : html`<summary>Click to expand</summary>`}

            ${() => {
                if (status === 'loading') {
                    return html`<div class="loading">Loading...</div>`;
                }

                if (status === 'error') {
                    return html`<div class="error">Error occurred</div>`;
                }

                return html`<div class="success">Success!</div>`;
            }}

            ${() => user ? html`<span>Welcome, ${user.name}</span>` : html`<span>Please log in</span>`}
        </div>
    `;

    // Toggle states
    showDetails = true;
    status = 'success';
    user = { name: 'Alice' };

    return { showDetails, status, user, view };
}


// ============================================================================
// Test 7: Event Handlers with Reactive State
// ============================================================================

function testEventHandlers() {
    let clicks = reactive(0),
        inputValue = reactive(''),
        items = reactive([] as string[]);

    let view = html`
        <div class="events">
            <button onclick=${() => clicks++}>
                Clicked ${clicks} times
            </button>

            <input
                type="text"
                value=${inputValue}
                oninput=${(e: Event) => { inputValue = (e.target as HTMLInputElement).value; }}
            />

            <button onclick=${() => {
                if (inputValue) {
                    items.push(inputValue);
                    inputValue = '';
                }
            }}>
                Add Item
            </button>

            <ul>
                ${html.reactive(items, (item, index) => html`
                    <li>
                        ${item}
                        <button onclick=${() => items.splice(index, 1)}>Remove</button>
                    </li>
                `)}
            </ul>
        </div>
    `;

    // Simulate interactions
    clicks++;
    clicks++;
    inputValue = 'Test item';
    items.push('First');
    items.push('Second');

    return { clicks, inputValue, items, view };
}


// ============================================================================
// Test 8: Attribute Bindings with Reactivity
// ============================================================================

function testAttributeBindings() {
    let isDisabled = reactive(false),
        classes = reactive('primary'),
        styles = reactive('color: red'),
        href = reactive('https://example.com'),
        dataValue = reactive(42);

    let view = html`
        <div class="attributes">
            <button
                class=${classes}
                disabled=${isDisabled}
                data-value=${dataValue}
                style=${styles}
            >
                Dynamic Button
            </button>

            <a href=${href} target="_blank">Dynamic Link</a>

            <input
                type="text"
                class=${() => isDisabled ? 'disabled-input' : 'active-input'}
                placeholder=${() => `Value: ${dataValue}`}
            />
        </div>
    `;

    // Update attributes
    isDisabled = true;
    classes = 'secondary active';
    styles = 'color: blue; font-weight: bold';
    href = 'https://updated.com';
    dataValue = 100;

    return { classes, dataValue, href, isDisabled, styles, view };
}


// ============================================================================
// Test 9: Mixed Reactive Types in Single Template
// ============================================================================

function testMixedReactiveTypes() {
    // All types in one component
    let primitive = reactive(0),
        computed = reactive(() => primitive * 2),
        array = reactive([1, 2, 3] as number[]),
        object = reactive({
            count: 0,
            double: () => object.count * 2,
            name: 'Test'
        });

    let view = html`
        <div class="mixed">
            <section>
                <h3>Primitive: ${primitive}</h3>
                <h3>Computed: ${computed}</h3>
            </section>

            <section>
                <h3>Object Name: ${object.name}</h3>
                <h3>Object Count: ${object.count}</h3>
                <h3>Object Double: ${object.double}</h3>
            </section>

            <section>
                <h3>Array Length: ${() => array.length}</h3>
                ${html.reactive(array, (n) => html`<span>${n}</span>`)}
            </section>

            <section>
                <button onclick=${() => {
                    primitive++;
                    object.count++;
                    array.push(array.length + 1);
                }}>
                    Increment All
                </button>
            </section>
        </div>
    `;

    // Trigger all types
    primitive = 5;
    object.name = 'Updated';
    object.count = 10;
    array.push(4, 5, 6);

    return { array, computed, object, primitive, view };
}


// ============================================================================
// Test 10: Typed Reactive with Generics
// ============================================================================

interface Todo {
    completed: boolean;
    id: number;
    text: string;
}

interface AppState {
    addTodo: (text: string) => void;
    completedCount: () => number;
    filter: 'all' | 'active' | 'completed';
    filteredTodos: () => Todo[];
    nextId: number;
    todos: Todo[];
    toggleTodo: (id: number) => void;
}

function testTypedReactive() {
    let state = reactive<AppState>({
        addTodo: (text: string) => {
            state.todos.push({
                completed: false,
                id: state.nextId++,
                text
            });
        },
        completedCount: () => state.todos.filter(t => t.completed).length,
        filter: 'all',
        filteredTodos: () => {
            if (state.filter === 'active') {
                return state.todos.filter(t => !t.completed);
            }

            if (state.filter === 'completed') {
                return state.todos.filter(t => t.completed);
            }

            return state.todos;
        },
        nextId: 1,
        todos: [],
        toggleTodo: (id: number) => {
            let todo = state.todos.find(t => t.id === id);

            if (todo) {
                todo.completed = !todo.completed;
            }
        }
    });

    let view = html`
        <div class="todo-app">
            <header>
                <h1>Todos (${state.completedCount} completed)</h1>
                <nav>
                    <button
                        class=${() => state.filter === 'all' ? 'active' : ''}
                        onclick=${() => { state.filter = 'all'; }}
                    >All</button>
                    <button
                        class=${() => state.filter === 'active' ? 'active' : ''}
                        onclick=${() => { state.filter = 'active'; }}
                    >Active</button>
                    <button
                        class=${() => state.filter === 'completed' ? 'active' : ''}
                        onclick=${() => { state.filter = 'completed'; }}
                    >Completed</button>
                </nav>
            </header>

            <main>
                ${() => state.filteredTodos().map(todo => html`
                    <div class="todo ${todo.completed ? 'completed' : ''}">
                        <input
                            type="checkbox"
                            checked=${todo.completed}
                            onchange=${() => state.toggleTodo(todo.id)}
                        />
                        <span>${todo.text}</span>
                    </div>
                `)}
            </main>
        </div>
    `;

    // Add some todos
    state.addTodo('Learn TypeScript');
    state.addTodo('Build app');
    state.addTodo('Write tests');
    state.toggleTodo(1);

    return { state, view };
}


// ============================================================================
// Test 11: Deeply Nested Templates with Reactivity
// ============================================================================

function testDeeplyNested() {
    let level1 = reactive({
        items: reactive([
            {
                children: reactive([
                    { name: 'Leaf 1', value: reactive(1) },
                    { name: 'Leaf 2', value: reactive(2) }
                ] as { name: string; value: number }[]),
                name: 'Child 1'
            },
            {
                children: reactive([
                    { name: 'Leaf 3', value: reactive(3) }
                ] as { name: string; value: number }[]),
                name: 'Child 2'
            }
        ] as { children: { name: string; value: number }[]; name: string }[]),
        name: 'Root'
    });

    let view = html`
        <div class="tree">
            <h1>${level1.name}</h1>
            ${html.reactive(level1.items, (item) => html`
                <div class="branch">
                    <h2>${item.name}</h2>
                    ${html.reactive(item.children, (child) => html`
                        <div class="leaf">
                            <span>${child.name}: ${child.value}</span>
                            <button onclick=${() => child.value++}>+</button>
                        </div>
                    `)}
                </div>
            `)}
        </div>
    `;

    // Mutate nested values
    level1.items[0].children[0].value++;
    level1.items.push({
        children: reactive([{ name: 'Leaf 4', value: reactive(4) }]),
        name: 'Child 3'
    });

    return { level1, view };
}


// ============================================================================
// Test 12: Static vs Dynamic Content
// ============================================================================

function testStaticVsDynamic() {
    let dynamicText = reactive('Dynamic'),
        dynamicNum = reactive(42),
        dynamicBool = reactive(true);

    // Mix of static and dynamic content
    let view = html`
        <div class="static-dynamic">
            <p>Static text here</p>
            <p>${dynamicText} text here</p>

            <span>Static number: 100</span>
            <span>Dynamic number: ${dynamicNum}</span>

            <div class="static-class">Static class</div>
            <div class="${() => dynamicBool ? 'dynamic-true' : 'dynamic-false'}">Dynamic class</div>

            <a href="https://static.com">Static link</a>
            <a href=${() => dynamicBool ? 'https://true.com' : 'https://false.com'}>Dynamic link</a>

            <input type="text" value="static" />
            <input type="text" value=${dynamicText} />
        </div>
    `;

    dynamicText = 'Updated';
    dynamicNum = 100;
    dynamicBool = false;

    return { dynamicBool, dynamicNum, dynamicText, view };
}


// ============================================================================
// Run All Tests
// ============================================================================

export const tests = {
    testAttributeBindings,
    testComplexNested,
    testComputedValues,
    testConditionalRendering,
    testDeeplyNested,
    testEventHandlers,
    testMixedReactiveTypes,
    testPrimitiveSignals,
    testReactiveArrays,
    testReactiveObjects,
    testStaticVsDynamic,
    testTypedReactive
};

// Execute all tests to verify compilation
export const results = Object.entries(tests).map(([name, fn]) => {
    try {
        let result = fn();

        console.log(`✓ ${name} passed`);

        return { name, result, status: 'passed' };
    }
    catch (error) {
        console.error(`✗ ${name} failed:`, error);

        return { error, name, status: 'failed' };
    }
});

console.log(`\nTests completed: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
