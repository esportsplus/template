// Test Templates for Compilation Benchmark
// Wide variety of template patterns for performance testing

import { html } from '../src';


// =============================================================================
// STATIC TEMPLATES (no slots)
// =============================================================================

// 1. Simple static element
export const staticSimple = () => html`<div>Hello World</div>`;

// 2. Static with classes
export const staticClasses = () => html`<div class="container mx-auto p-4">Static content</div>`;

// 3. Static nested
export const staticNested = () => html`
    <div class="wrapper">
        <header class="header">Title</header>
        <main class="content">Body</main>
        <footer class="footer">Footer</footer>
    </div>
`;

// 4. Static list
export const staticList = () => html`
    <ul class="list">
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
    </ul>
`;

// 5. Static table
export const staticTable = () => html`
    <table class="table">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
            <tr><td>1</td><td>Alice</td></tr>
            <tr><td>2</td><td>Bob</td></tr>
        </tbody>
    </table>
`;


// =============================================================================
// SINGLE SLOT TEMPLATES
// =============================================================================

// 6. Single text slot
export const singleText = (text: string) => html`<div>${text}</div>`;

// 7. Single attribute
export const singleAttr = (cls: string) => html`<div class="${cls}"></div>`;

// 8. Single id attribute
export const singleId = (id: string) => html`<div id="${id}"></div>`;

// 9. Single style
export const singleStyle = (style: string) => html`<div style="${style}"></div>`;

// 10. Single data attribute
export const singleData = (value: string) => html`<div data-value="${value}"></div>`;


// =============================================================================
// MULTIPLE SLOT TEMPLATES
// =============================================================================

// 11. Multiple attributes same element
export const multiAttrSame = (id: string, cls: string, style: string) =>
    html`<div id="${id}" class="${cls}" style="${style}"></div>`;

// 12. Multiple text slots
export const multiText = (a: string, b: string, c: string) =>
    html`<div><span>${a}</span><span>${b}</span><span>${c}</span></div>`;

// 13. Mixed attributes and text
export const mixedSlots = (cls: string, text: string) =>
    html`<div class="${cls}">${text}</div>`;

// 14. Multiple elements with slots
export const multiElement = (title: string, body: string) =>
    html`<article><h1>${title}</h1><p>${body}</p></article>`;

// 15. Form inputs
export const formInputs = (name: string, email: string, placeholder: string) =>
    html`<form>
        <input type="text" value="${name}" placeholder="${placeholder}">
        <input type="email" value="${email}">
    </form>`;


// =============================================================================
// NESTED TEMPLATES
// =============================================================================

// 16. Simple nested template
export const nestedSimple = (items: string[]) =>
    html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`;

// 17. Nested with attributes
export const nestedWithAttrs = (items: { cls: string; text: string }[]) =>
    html`<ul>${items.map(item => html`<li class="${item.cls}">${item.text}</li>`)}</ul>`;

// 18. Deeply nested templates
export const nestedDeep = (sections: { title: string; items: string[] }[]) =>
    html`<div class="container">
        ${sections.map(section => html`
            <section>
                <h2>${section.title}</h2>
                <ul>${section.items.map(item => html`<li>${item}</li>`)}</ul>
            </section>
        `)}
    </div>`;

// 19. Table with nested rows
export const nestedTable = (rows: { id: number; name: string; email: string }[]) =>
    html`<table>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th></tr></thead>
        <tbody>
            ${rows.map(row => html`<tr>
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.email}</td>
            </tr>`)}
        </tbody>
    </table>`;

// 20. Card grid
export const nestedCards = (cards: { title: string; body: string; footer: string }[]) =>
    html`<div class="grid">
        ${cards.map(card => html`
            <div class="card">
                <div class="card-header">${card.title}</div>
                <div class="card-body">${card.body}</div>
                <div class="card-footer">${card.footer}</div>
            </div>
        `)}
    </div>`;


// =============================================================================
// SPREAD ATTRIBUTE TEMPLATES
// =============================================================================

// 21. Simple spread
export const spreadSimple = (attrs: Record<string, unknown>) =>
    html`<div ${attrs}></div>`;

// 22. Spread with static
export const spreadWithStatic = (attrs: Record<string, unknown>) =>
    html`<div class="base" ${attrs}></div>`;

// 23. Spread in nested
export const spreadNested = (items: Record<string, unknown>[]) =>
    html`<ul>${items.map(attrs => html`<li ${attrs}>Item</li>`)}</ul>`;


// =============================================================================
// EVENT HANDLER TEMPLATES
// =============================================================================

// 24. Single event
export const eventSingle = (handler: () => void) =>
    html`<button onclick="${handler}">Click</button>`;

// 25. Multiple events
export const eventMultiple = (click: () => void, hover: () => void) =>
    html`<button onclick="${click}" onmouseover="${hover}">Interact</button>`;

// 26. Event with attributes
export const eventWithAttrs = (cls: string, handler: () => void) =>
    html`<button class="${cls}" onclick="${handler}">Action</button>`;


// =============================================================================
// DEEPLY NESTED DOM TEMPLATES
// =============================================================================

// 27. 4-level nesting with slot at leaf
export const deepNest4 = (text: string) =>
    html`<div><div><div><div>${text}</div></div></div></div>`;

// 28. 6-level nesting
export const deepNest6 = (text: string) =>
    html`<div><div><div><div><div><div>${text}</div></div></div></div></div></div>`;

// 29. Wide and deep
export const wideAndDeep = (a: string, b: string, c: string, d: string) =>
    html`<div class="level-1">
        <div class="level-2">
            <div class="level-3">
                <span>${a}</span>
                <span>${b}</span>
            </div>
        </div>
        <div class="level-2">
            <div class="level-3">
                <span>${c}</span>
                <span>${d}</span>
            </div>
        </div>
    </div>`;


// =============================================================================
// SIBLING SLOT TEMPLATES (path optimization test)
// =============================================================================

// 30. Adjacent siblings
export const siblingAdjacent = (a: string, b: string, c: string) =>
    html`<div>${a}${b}${c}</div>`;

// 31. Sibling elements
export const siblingElements = (a: string, b: string, c: string, d: string, e: string) =>
    html`<div>
        <span>${a}</span>
        <span>${b}</span>
        <span>${c}</span>
        <span>${d}</span>
        <span>${e}</span>
    </div>`;

// 32. Many siblings (10)
export const sibling10 = (values: string[]) =>
    html`<div>
        <span>${values[0]}</span>
        <span>${values[1]}</span>
        <span>${values[2]}</span>
        <span>${values[3]}</span>
        <span>${values[4]}</span>
        <span>${values[5]}</span>
        <span>${values[6]}</span>
        <span>${values[7]}</span>
        <span>${values[8]}</span>
        <span>${values[9]}</span>
    </div>`;


// =============================================================================
// COMPLEX REAL-WORLD TEMPLATES
// =============================================================================

// 33. Navigation menu
export const navMenu = (items: { href: string; text: string; active: boolean }[]) =>
    html`<nav class="nav">
        <ul class="nav-list">
            ${items.map(item => html`
                <li class="${item.active ? 'active' : ''}">
                    <a href="${item.href}">${item.text}</a>
                </li>
            `)}
        </ul>
    </nav>`;

// 34. Blog post card
export const blogCard = (post: {
    title: string;
    author: string;
    date: string;
    excerpt: string;
    imageUrl: string;
    tags: string[];
}) => html`
    <article class="blog-card">
        <img src="${post.imageUrl}" alt="${post.title}">
        <div class="blog-card-content">
            <h2>${post.title}</h2>
            <p class="meta">By ${post.author} on ${post.date}</p>
            <p>${post.excerpt}</p>
            <div class="tags">
                ${post.tags.map(tag => html`<span class="tag">${tag}</span>`)}
            </div>
        </div>
    </article>
`;

// 35. Product listing
export const productListing = (products: {
    id: number;
    name: string;
    price: number;
    inStock: boolean;
    rating: number;
}[]) => html`
    <div class="product-grid">
        ${products.map(product => html`
            <div class="product-card" data-id="${product.id}">
                <h3>${product.name}</h3>
                <p class="price">$${product.price}</p>
                <span class="${product.inStock ? 'in-stock' : 'out-of-stock'}">
                    ${product.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
                <div class="rating">${'★'.repeat(product.rating)}${'☆'.repeat(5 - product.rating)}</div>
            </div>
        `)}
    </div>
`;

// 36. Comment thread
export const commentThread = (comments: {
    author: string;
    avatar: string;
    text: string;
    date: string;
    replies: { author: string; text: string; date: string }[];
}[]) => html`
    <div class="comments">
        ${comments.map(comment => html`
            <div class="comment">
                <img src="${comment.avatar}" class="avatar">
                <div class="comment-content">
                    <p class="author">${comment.author}</p>
                    <p class="date">${comment.date}</p>
                    <p class="text">${comment.text}</p>
                    ${comment.replies.length > 0 ? html`
                        <div class="replies">
                            ${comment.replies.map(reply => html`
                                <div class="reply">
                                    <p class="author">${reply.author}</p>
                                    <p class="text">${reply.text}</p>
                                </div>
                            `)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `)}
    </div>
`;

// 37. Dashboard widget
export const dashboardWidget = (widget: {
    title: string;
    value: number;
    change: number;
    chartData: number[];
}) => html`
    <div class="widget">
        <h3>${widget.title}</h3>
        <p class="value">${widget.value}</p>
        <p class="${widget.change >= 0 ? 'positive' : 'negative'}">
            ${widget.change >= 0 ? '+' : ''}${widget.change}%
        </p>
        <div class="chart">
            ${widget.chartData.map(point => html`
                <div class="bar" style="height: ${point}%"></div>
            `)}
        </div>
    </div>
`;


// =============================================================================
// CONDITIONAL RENDERING
// =============================================================================

// 38. Conditional class
export const conditionalClass = (isActive: boolean) =>
    html`<div class="${isActive ? 'active' : 'inactive'}">Status</div>`;

// 39. Conditional content
export const conditionalContent = (show: boolean, content: string) =>
    html`<div>${show ? content : ''}</div>`;

// 40. Conditional nested template
export const conditionalNested = (items: string[] | null) =>
    html`<div>
        ${items ? html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>` : html`<p>No items</p>`}
    </div>`;


// =============================================================================
// STRESS TEST TEMPLATES
// =============================================================================

// 41. 20 slots
export const stressSlots20 = (values: string[]) =>
    html`<div>
        <p>${values[0]}</p><p>${values[1]}</p><p>${values[2]}</p><p>${values[3]}</p>
        <p>${values[4]}</p><p>${values[5]}</p><p>${values[6]}</p><p>${values[7]}</p>
        <p>${values[8]}</p><p>${values[9]}</p><p>${values[10]}</p><p>${values[11]}</p>
        <p>${values[12]}</p><p>${values[13]}</p><p>${values[14]}</p><p>${values[15]}</p>
        <p>${values[16]}</p><p>${values[17]}</p><p>${values[18]}</p><p>${values[19]}</p>
    </div>`;

// 42. 50 item list
export const stressList50 = (items: string[]) =>
    html`<ul>${items.slice(0, 50).map(item => html`<li>${item}</li>`)}</ul>`;

// 43. 100 item list
export const stressList100 = (items: string[]) =>
    html`<ul>${items.slice(0, 100).map(item => html`<li>${item}</li>`)}</ul>`;

// 44. Complex nested structure
export const stressComplex = (data: {
    header: { title: string; subtitle: string };
    sections: {
        title: string;
        items: { name: string; value: string }[];
    }[];
    footer: string;
}) => html`
    <div class="complex">
        <header>
            <h1>${data.header.title}</h1>
            <p>${data.header.subtitle}</p>
        </header>
        <main>
            ${data.sections.map(section => html`
                <section>
                    <h2>${section.title}</h2>
                    <dl>
                        ${section.items.map(item => html`
                            <dt>${item.name}</dt>
                            <dd>${item.value}</dd>
                        `)}
                    </dl>
                </section>
            `)}
        </main>
        <footer>${data.footer}</footer>
    </div>
`;


// =============================================================================
// SVG TEMPLATES
// =============================================================================

// 45. Simple SVG
export const svgSimple = (fill: string) =>
    html`<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="${fill}"/></svg>`;

// 46. SVG with multiple elements
export const svgMultiple = (colors: { circle: string; rect: string }) =>
    html`<svg width="200" height="100">
        <circle cx="50" cy="50" r="40" fill="${colors.circle}"/>
        <rect x="100" y="10" width="80" height="80" fill="${colors.rect}"/>
    </svg>`;

// 47. SVG path
export const svgPath = (d: string, stroke: string) =>
    html`<svg viewBox="0 0 100 100"><path d="${d}" stroke="${stroke}" fill="none"/></svg>`;


// =============================================================================
// VOID ELEMENT TEMPLATES
// =============================================================================

// 48. Input with all attributes
export const inputComplete = (attrs: {
    type: string;
    name: string;
    value: string;
    placeholder: string;
    cls: string;
}) => html`<input
    type="${attrs.type}"
    name="${attrs.name}"
    value="${attrs.value}"
    placeholder="${attrs.placeholder}"
    class="${attrs.cls}">`;

// 49. Image
export const imageSrc = (src: string, alt: string) =>
    html`<img src="${src}" alt="${alt}" loading="lazy">`;

// 50. Meta tags
export const metaTags = (tags: { name: string; content: string }[]) =>
    html`<head>${tags.map(t => html`<meta name="${t.name}" content="${t.content}">`)}</head>`;
