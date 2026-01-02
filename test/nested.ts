// Nested Templates - Template hoisting and depth sorting
// Tests nested html`` calls, array mapping, and conditional templates


import { html } from '../src';


// =============================================================================
// SIMPLE NESTED TEMPLATES
// =============================================================================

// Basic nested template in slot
export const nestedSimple = (items: string[]) =>
    html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`;

// Nested with static content
export const nestedStatic = (items: string[]) =>
    html`<ul class="list">${items.map(item => html`<li class="item">${item}</li>`)}</ul>`;

// Nested with index
export const nestedWithIndex = (items: string[]) =>
    html`<ul>${items.map((item, i) => html`<li data-index="${i}">${item}</li>`)}</ul>`;


// =============================================================================
// NESTED WITH ATTRIBUTES
// =============================================================================

// Nested template with dynamic class
export const nestedAttrClass = (items: { cls: string; text: string }[]) =>
    html`<ul>${items.map(item => html`<li class="${item.cls}">${item.text}</li>`)}</ul>`;

// Nested template with multiple attributes
export const nestedAttrMultiple = (items: { id: string; cls: string; text: string }[]) =>
    html`<ul>${items.map(item =>
        html`<li id="${item.id}" class="${item.cls}">${item.text}</li>`
    )}</ul>`;

// Nested with data attributes
export const nestedAttrData = (items: { id: number; value: string }[]) =>
    html`<div>${items.map(item =>
        html`<span data-id="${item.id}" data-value="${item.value}">${item.value}</span>`
    )}</div>`;


// =============================================================================
// DEEPLY NESTED TEMPLATES (2+ levels)
// =============================================================================

// Two levels of nesting
export const nestedTwoLevel = (sections: { title: string; items: string[] }[]) =>
    html`<div>${sections.map(section => html`
        <section>
            <h2>${section.title}</h2>
            <ul>${section.items.map(item => html`<li>${item}</li>`)}</ul>
        </section>
    `)}</div>`;

// Three levels of nesting
export const nestedThreeLevel = (groups: {
    name: string;
    sections: { title: string; items: string[] }[];
}[]) => html`<div>${groups.map(group => html`
    <div class="group">
        <h1>${group.name}</h1>
        ${group.sections.map(section => html`
            <section>
                <h2>${section.title}</h2>
                <ul>${section.items.map(item => html`<li>${item}</li>`)}</ul>
            </section>
        `)}
    </div>
`)}</div>`;


// =============================================================================
// TABLE STRUCTURES
// =============================================================================

// Simple table rows
export const tableRows = (rows: { id: number; name: string }[]) =>
    html`<table>
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>${rows.map(row => html`<tr><td>${row.id}</td><td>${row.name}</td></tr>`)}</tbody>
    </table>`;

// Table with multiple columns
export const tableMultiColumn = (rows: { id: number; name: string; email: string; role: string }[]) =>
    html`<table>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>${rows.map(row => html`
            <tr>
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.email}</td>
                <td>${row.role}</td>
            </tr>
        `)}</tbody>
    </table>`;

// Grouped table
export const tableGrouped = (groups: { category: string; items: { name: string; value: number }[] }[]) =>
    html`<table>
        <tbody>${groups.map(group => html`
            <tr class="group-header"><th colspan="2">${group.category}</th></tr>
            ${group.items.map(item => html`<tr><td>${item.name}</td><td>${item.value}</td></tr>`)}
        `)}</tbody>
    </table>`;


// =============================================================================
// LIST STRUCTURES
// =============================================================================

// Definition list
export const definitionList = (items: { term: string; definition: string }[]) =>
    html`<dl>${items.map(item => html`<dt>${item.term}</dt><dd>${item.definition}</dd>`)}</dl>`;

// Nested list (ul > li > ul)
export const nestedList = (items: { text: string; children: string[] }[]) =>
    html`<ul>${items.map(item => html`
        <li>
            ${item.text}
            ${item.children.length > 0 ? html`<ul>${item.children.map(c => html`<li>${c}</li>`)}</ul>` : ''}
        </li>
    `)}</ul>`;

// Ordered list with nesting
export const orderedNestedList = (items: { text: string; subItems: string[] }[]) =>
    html`<ol>${items.map(item => html`
        <li>
            <span>${item.text}</span>
            <ol>${item.subItems.map(sub => html`<li>${sub}</li>`)}</ol>
        </li>
    `)}</ol>`;


// =============================================================================
// CARD/GRID LAYOUTS
// =============================================================================

// Card grid
export const cardGrid = (cards: { title: string; body: string; footer: string }[]) =>
    html`<div class="grid">${cards.map(card => html`
        <div class="card">
            <div class="card-header">${card.title}</div>
            <div class="card-body">${card.body}</div>
            <div class="card-footer">${card.footer}</div>
        </div>
    `)}</div>`;

// Product grid
export const productGrid = (products: {
    id: number;
    name: string;
    price: number;
    image: string;
}[]) => html`<div class="products">${products.map(p => html`
    <div class="product" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <span class="price">$${p.price}</span>
    </div>
`)}</div>`;


// =============================================================================
// CONDITIONAL NESTED TEMPLATES
// =============================================================================

// Conditional inner template
export const conditionalNested = (items: string[] | null) =>
    html`<div>
        ${items
            ? html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
            : html`<p>No items</p>`
        }
    </div>`;

// Conditional based on length
export const conditionalLength = (items: string[]) =>
    html`<div>
        ${items.length > 0
            ? html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
            : html`<p class="empty">Empty list</p>`
        }
    </div>`;

// Conditional class in nested
export const conditionalClassNested = (items: { text: string; active: boolean }[]) =>
    html`<ul>${items.map(item =>
        html`<li class="${item.active ? 'active' : 'inactive'}">${item.text}</li>`
    )}</ul>`;


// =============================================================================
// COMPLEX REAL-WORLD PATTERNS
// =============================================================================

// Navigation menu
export const navMenu = (items: { href: string; text: string; active: boolean }[]) =>
    html`<nav class="nav">
        <ul class="nav-list">${items.map(item => html`
            <li class="${item.active ? 'active' : ''}">
                <a href="${item.href}">${item.text}</a>
            </li>
        `)}</ul>
    </nav>`;

// Blog post card
export const blogCard = (post: {
    title: string;
    author: string;
    date: string;
    excerpt: string;
    tags: string[];
}) => html`
    <article class="blog-card">
        <h2>${post.title}</h2>
        <p class="meta">By ${post.author} on ${post.date}</p>
        <p>${post.excerpt}</p>
        <div class="tags">${post.tags.map(tag => html`<span class="tag">${tag}</span>`)}</div>
    </article>
`;

// Comment thread
export const commentThread = (comments: {
    author: string;
    text: string;
    replies: { author: string; text: string }[];
}[]) => html`
    <div class="comments">${comments.map(comment => html`
        <div class="comment">
            <p class="author">${comment.author}</p>
            <p class="text">${comment.text}</p>
            ${comment.replies.length > 0 ? html`
                <div class="replies">${comment.replies.map(reply => html`
                    <div class="reply">
                        <p class="author">${reply.author}</p>
                        <p class="text">${reply.text}</p>
                    </div>
                `)}</div>
            ` : ''}
        </div>
    `)}</div>
`;

// Dashboard widget
export const dashboardWidget = (widget: {
    title: string;
    value: number;
    chartData: number[];
}) => html`
    <div class="widget">
        <h3>${widget.title}</h3>
        <p class="value">${widget.value}</p>
        <div class="chart">${widget.chartData.map(point =>
            html`<div class="bar" style="height: ${point}%"></div>`
        )}</div>
    </div>
`;


// =============================================================================
// STRESS TESTS
// =============================================================================

// 50 item list
export const stressList50 = (items: string[]) =>
    html`<ul>${items.slice(0, 50).map(item => html`<li>${item}</li>`)}</ul>`;

// 100 item list
export const stressList100 = (items: string[]) =>
    html`<ul>${items.slice(0, 100).map(item => html`<li>${item}</li>`)}</ul>`;

// Complex nested structure
export const stressComplex = (data: {
    header: { title: string; subtitle: string };
    sections: { title: string; items: { name: string; value: string }[] }[];
    footer: string;
}) => html`
    <div class="complex">
        <header>
            <h1>${data.header.title}</h1>
            <p>${data.header.subtitle}</p>
        </header>
        <main>${data.sections.map(section => html`
            <section>
                <h2>${section.title}</h2>
                <dl>${section.items.map(item => html`
                    <dt>${item.name}</dt>
                    <dd>${item.value}</dd>
                `)}</dl>
            </section>
        `)}</main>
        <footer>${data.footer}</footer>
    </div>
`;
