import { effect, reactive } from '@esportsplus/reactivity';
import { delegate } from '../../src/event';
import { template, text } from '../../src/utilities';
import { VirtualSlot } from '../../src/virtual';
import { offset } from '../../src/virtual/cache';


type Row = {
    color: string;
    expanded: boolean;
    id: number;
    kind: 'card' | 'note' | 'quote';
    words: number;
};


const CARD = template('<div class="row card"><div class="head"><span class="id"></span><span class="meta"></span></div><p class="body"></p><button class="grow">grow / shrink</button></div>');

const NOTE = template('<div class="row note"><span class="id"></span><span class="body"></span></div>');

const QUOTE = template('<blockquote class="row quote"><span class="id"></span><p class="body"></p></blockquote>');

const ROWS = 50000;

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');


let id = 1,
    seed = 7;


function build(n: number): Row[] {
    let rows = new Array<Row>(n);

    for (let i = 0; i < n; i++) {
        let kind = random(3);

        rows[i] = {
            color: `hsl(${random(360)} 70% 92%)`,
            expanded: false,
            id: id++,
            kind: kind === 0 ? 'card' : kind === 1 ? 'note' : 'quote',
            words: kind === 1 ? 3 + random(12) : 8 + random(90)
        };
    }

    return rows;
}

function prose(count: number): string {
    let out = new Array<string>(count);

    for (let i = 0; i < count; i++) {
        out[i] = WORDS[random(WORDS.length)];
    }

    return out.join(' ');
}

function random(max: number) {
    seed = (seed * 1664525 + 1013904223) >>> 0;

    return seed % max;
}

function row(data: Row): DocumentFragment {
    let fragment = (data.kind === 'card' ? CARD : data.kind === 'note' ? NOTE : QUOTE)() as DocumentFragment,
        element = fragment.firstChild as HTMLElement,
        body = element.querySelector('.body')!,
        label = element.querySelector('.id')!;

    element.style.background = data.color;
    label.appendChild(text('#' + data.id));
    body.appendChild(text(prose(data.words)));

    if (data.kind === 'card') {
        element.querySelector('.meta')!.appendChild(text(`${data.words} words`));

        delegate(element.querySelector('.grow') as any, 'click', () => {
            data.expanded = !data.expanded;
            body.textContent = prose(data.expanded ? data.words * 3 : data.words);
        });
    }

    return fragment;
}


let chat = location.search.includes('chat'),
    rows = reactive(build(chat ? 2000 : ROWS)),
    slot = new VirtualSlot(rows, row, chat ? { anchor: 'end' } : undefined),
    scroller = document.getElementById('scroller')!,
    status = document.getElementById('status')!;

scroller.appendChild(slot.fragment);

effect(() => {
    let [start, end] = slot.range;

    status.textContent = `rows ${slot.length} · rendered ${start} to ${end} · nodes ${scroller.querySelectorAll('*').length}`;
});

let trace: string[] = [],
    traced = ['writeScroll', 'applyJump', 'settle', 'resized', 'inserted', 'onScroll', 'render'];

for (let i = 0, n = traced.length; i < n; i++) {
    let name = traced[i],
        original = (slot as any)[name];

    (slot as any)[name] = function (this: any, ...args: unknown[]) {
        let result = original.apply(this, args),
            cache = this.cache;

        trace.push(`${name}(${args.map(a => typeof a === 'number' ? Math.round(a) : a).join(',')}) -> offset ${Math.round(this.offset)} jump ${Math.round(this.jump)} written ${Math.round(this.written)} range ${this.start}-${this.end} total ${Math.round(offset(cache, cache.length))} scrollTop ${Math.round(scroller.scrollTop)} pending ${this.pending ? this.pending.index : '-'}`);

        if (trace.length > 30) {
            trace.shift();
        }

        document.getElementById('trace')!.textContent = trace.join('\n');

        return result;
    };
}

let debug = document.getElementById('debug')!,
    report = () => {
        let top = scroller.querySelector('div:first-child') as HTMLElement,
            spacers = Array.from(scroller.children).filter(c => (c as HTMLElement).style.height && !(c as HTMLElement).className) as HTMLElement[];

        let s = slot as any,
            cache = s.cache;

        debug.textContent = `scrollTop ${Math.round(scroller.scrollTop)} · scrollHeight ${scroller.scrollHeight} · client ${scroller.clientHeight} · spacers ${spacers.map(s => s.style.height).join(' / ')} · first ${top?.style.height ?? '-'} | offset ${Math.round(s.offset)} dir ${s.direction} start ${s.start} end ${s.end} written ${Math.round(s.written)} jump ${s.jump} pinned ${s.pinned} pending ${s.pending ? s.pending.index + '/' + s.pending.align : '-'} | cache total ${Math.round(offset(cache, cache.length))} off(start) ${Math.round(offset(cache, s.start))} off(end) ${Math.round(offset(cache, s.end))} est ${Math.round(cache.estimate)} measured ${cache.measured} computed ${cache.computed}`;
    };

scroller.addEventListener('scroll', () => requestAnimationFrame(report), { passive: true });
setInterval(report, 500);

document.getElementById('mode')!.textContent = chat ? 'chat mode (anchor: end) · switch to feed' : 'feed mode · switch to chat';
document.getElementById('mode')!.setAttribute('href', chat ? location.pathname : location.pathname + '?chat');
document.getElementById('one')!.addEventListener('click', () => rows.push(...build(1)));
document.getElementById('push')!.addEventListener('click', () => rows.push(...build(1000)));
document.getElementById('unshift')!.addEventListener('click', () => rows.unshift(...build(100)));
document.getElementById('splice')!.addEventListener('click', () => {
    let [start] = slot.range;

    rows.splice(Math.max(0, start - 500), 200, ...build(50));
});
document.getElementById('sort')!.addEventListener('click', () => rows.sort((a, b) => a.words - b.words));
document.getElementById('reverse')!.addEventListener('click', () => rows.reverse());
document.getElementById('jump')!.addEventListener('click', () => slot.scrollTo(random(rows.length), 'start'));
document.getElementById('end')!.addEventListener('click', () => slot.scrollTo(rows.length - 1, 'end'));
document.getElementById('top')!.addEventListener('click', () => slot.scrollTo(0));
