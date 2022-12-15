import marker from './marker';


let regex = {
        attributes: /(?<key>[\w-]+)\s*=\s*(["'])(?<value>[^>'"]*{{slot}}[^>'"]*)\2/g,
        marker: /{{slot}}/g,
        tags: /<!--(?<comment>[\S\s]*?)-->|<[\S\s]*?\/?[\S\s]*?(?<name>[\w-]+)(?<properties>.*?\/?[\S\s]*?)>/g
    },
    skip = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);


function generatePath(parent) {
    return [...parent.path, parent.children];
}

function parseTag(data, parent, slots, tag) {
    if (tag.properties.includes(marker.text)) {
        for (let i = 0, n = tag.properties.length; i < n; i += marker.text.length) {
            if ((i = tag.properties.indexOf(marker.text, i)) === -1) {
                break;
            }

            registerSlot(data, parent, slots.shift());
        }

        data.content = data.content.replace(tag.properties, tag.properties.replace(regex.marker, ''));
    }

    return {
        children: 0,
        path: generatePath(parent),
        skip: skip.has(tag.name.toLowerCase()) || tag.properties.charAt(tag.properties.length - 2) === '/'
    };
};

function parseText(data, html, parent, start) {
    let content = html.slice(start, (html.indexOf('<', start) || 0));

    if (content.includes(marker.text)) {
        let i;

        while ((i = content.indexOf(marker.text)) !== -1) {
            if (content.slice(0, i).trim()) {
                parent.children++;
            }

            content = content.slice(i + marker.text.length);
            registerSlot(data, parent, 'node');
            parent.children++;
        }
    }

    if (content.trim()) {
        parent.children++;
    }
};

function registerSlot(data, parent, type) {
    data.slots.push({
        path: generatePath(parent),
        type
    });
}


const parse = (str) => {
    let data = {
            content: str
                .replace(/[\r\n]/g, '')
                .replace(/  +/g, ' ')
                .replace(/>\s*</g, '><')
                .trim(),
            slots: [],
            type: str.indexOf('</') !== -1 || str.indexOf('/>') !== -1 ? 'html' : 'text'
        };

    if (data.content.indexOf(marker.text) === -1) {
        return data;
    }

    let cache = [],
        current,
        html = `<div>${data.content}</div>`,
        level = -1,
        slots = [],
        total = html.match(regex.marker).length;

    // Find attribute slots
    for (let match of html.matchAll(regex.attributes)) {
        let key = match?.groups?.key || match[1],
            value = match?.groups?.value || match[3];

        for (let i = 0, n = value.length; i < n; i += marker.text.length) {
            if ((i = value.indexOf(marker.text, i)) === -1) {
                break;
            }

            slots.push(key);
        }
    }

    // Find node slots
    for (let match of html.matchAll(regex.tags)) {
        let isComment = match[0].slice(0, 4) === '<!--',
            isOpen = match[0][1] !== '/',
            parent = cache[level] || { children: 0, path: [] },
            start = match.index + match[0].length;

        // Skip self closing
        if (match[0].slice(-2) === '/>') {
            continue;
        }

        if (!isComment && isOpen) {
            level++;

            current = parseTag(data, parent, slots, {
                name: match?.groups?.name || match[2],
                properties: match?.groups?.properties || match[3]
            });

            // Skip div wrapper on `html`
            if (level === 0) {
                current.path = [];
            }

            if (!current.skip && html[start] && html[start] !== '<') {
                parseText(data, html, current, start);
            }

            cache[level] = current;
            parent.children++;
        }

        if (isComment) {
            parent.children++;
        }

        if (current.skip || isComment || !isOpen) {
            if (!isComment) {
                level--;
            }

            // Trailing text node
            if (html[start] && html[start] !== '<') {
                parseText(data, html, (level === -1 ? current : cache[level]), start);
            }
        }

        if (data.slots.length >= total) {
            break;
        }
    }

    data.content = data.content
        .replace(regex.marker, marker.node)
        .replace(/>\s*</g, '><');

    return data;
};


export default { parse };
export { parse };
