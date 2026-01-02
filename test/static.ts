// Static Templates - No dynamic slots
// Tests template parsing and factory hoisting for pure HTML


import { html } from '../src';


// Simple static element
export const staticSimple = () => html`<div>Hello World</div>`;

// Static with classes
export const staticClasses = () => html`<div class="container mx-auto p-4">Static content</div>`;

// Static with multiple attributes
export const staticMultiAttr = () =>
    html`<div id="main" class="wrapper" data-testid="static-test">Content</div>`;

// Static nested structure
export const staticNested = () => html`
    <div class="wrapper">
        <header class="header">Title</header>
        <main class="content">Body</main>
        <footer class="footer">Footer</footer>
    </div>
`;

// Static list
export const staticList = () => html`
    <ul class="list">
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
    </ul>
`;

// Static table
export const staticTable = () => html`
    <table class="table">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
            <tr><td>1</td><td>Alice</td></tr>
            <tr><td>2</td><td>Bob</td></tr>
        </tbody>
    </table>
`;

// Static form
export const staticForm = () => html`
    <form action="/submit" method="POST">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" required>
        <button type="submit">Submit</button>
    </form>
`;

// Static with void elements
export const staticVoid = () => html`
    <div>
        <img src="/image.png" alt="Test">
        <br>
        <hr>
        <input type="hidden" name="token" value="abc123">
    </div>
`;

// Static deeply nested (8 levels)
export const staticDeepNest = () => html`
    <div class="l1">
        <div class="l2">
            <div class="l3">
                <div class="l4">
                    <div class="l5">
                        <div class="l6">
                            <div class="l7">
                                <div class="l8">Deep content</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

// Static wide structure (many siblings)
export const staticWide = () => html`
    <div class="container">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
    </div>
`;

// Static SVG
export const staticSvg = () => html`
    <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="blue"/>
        <rect x="10" y="10" width="20" height="20" fill="red"/>
    </svg>
`;

// Static with comments preserved in output
export const staticComments = () => html`
    <div>
        <!-- Header section -->
        <header>Header</header>
        <!-- Main content -->
        <main>Content</main>
    </div>
`;

// Identical templates - tests deduplication
export const staticDupe1 = () => html`<div class="dupe">Duplicate content</div>`;
export const staticDupe2 = () => html`<div class="dupe">Duplicate content</div>`;
export const staticDupe3 = () => html`<div class="dupe">Duplicate content</div>`;
