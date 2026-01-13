new TextDecoder();
new TextEncoder();
BigInt.prototype.toJSON = function() {
  return this.toString();
};
new TextEncoder();
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const VALID_CHARACTERS = {};
for (let i = 0, n = ENCODING.length; i < n; i++) {
  let char = ENCODING[i];
  VALID_CHARACTERS[char] = true;
  VALID_CHARACTERS[char.toLowerCase()] = true;
}
crypto.randomUUID.bind(crypto);
const { defineProperty } = Object;
const { isArray } = Array;
const isObject = (value) => {
  return typeof value === "object" && value !== null && value.constructor === Object;
};
const isPromise = (val) => {
  return val instanceof Promise;
};
const COMPUTED = /* @__PURE__ */ Symbol("reactivity.computed");
const PACKAGE_NAME = "@esportsplus/reactivity";
const REACTIVE_ARRAY = /* @__PURE__ */ Symbol("reactivity.reactive.array");
const REACTIVE_OBJECT = /* @__PURE__ */ Symbol("reactivity.reactive.object");
const SIGNAL = /* @__PURE__ */ Symbol("reactivity.signal");
const STABILIZER_IDLE = 0;
const STABILIZER_RESCHEDULE = 1;
const STABILIZER_RUNNING = 2;
const STABILIZER_SCHEDULED = 3;
const STATE_NONE$1 = 0;
const STATE_CHECK = 1 << 0;
const STATE_DIRTY = 1 << 1;
const STATE_RECOMPUTING = 1 << 2;
const STATE_IN_HEAP = 1 << 3;
const STATE_NOTIFY_MASK = STATE_CHECK | STATE_DIRTY;
let depth = 0, heap = new Array(64), heap_i = 0, heap_n = 0, linkPool = [], linkPoolMax = 1e3, microtask = queueMicrotask, notified = false, observer = null, scope = null, stabilizer = STABILIZER_IDLE, version = 0;
function cleanup(computed2) {
  if (!computed2.cleanup) {
    return;
  }
  let value = computed2.cleanup;
  if (typeof value === "function") {
    value();
  } else {
    for (let i = 0, n = value.length; i < n; i++) {
      value[i]();
    }
  }
  computed2.cleanup = null;
}
function deleteFromHeap(computed2) {
  let state = computed2.state;
  if (!(state & STATE_IN_HEAP)) {
    return;
  }
  computed2.state = state & ~STATE_IN_HEAP;
  let height = computed2.height;
  if (computed2.prevHeap === computed2) {
    heap[height] = void 0;
  } else {
    let next = computed2.nextHeap, dhh = heap[height], end = next ?? dhh;
    if (computed2 === dhh) {
      heap[height] = next;
    } else {
      computed2.prevHeap.nextHeap = next;
    }
    end.prevHeap = computed2.prevHeap;
  }
  computed2.nextHeap = void 0;
  computed2.prevHeap = computed2;
}
function insertIntoHeap(computed2) {
  let state = computed2.state;
  if (state & STATE_IN_HEAP) {
    return;
  }
  computed2.state = state | STATE_IN_HEAP;
  let height = computed2.height, heapAtHeight = heap[height];
  if (heapAtHeight === void 0) {
    heap[height] = computed2;
  } else {
    let tail = heapAtHeight.prevHeap;
    tail.nextHeap = computed2;
    computed2.prevHeap = tail;
    heapAtHeight.prevHeap = computed2;
  }
  if (height > heap_n) {
    heap_n = height;
    if (height >= heap.length) {
      heap.length = Math.max(height + 1, Math.ceil(heap.length * 2));
    }
  }
}
function link(dep, sub) {
  let prevDep = sub.depsTail;
  if (prevDep && prevDep.dep === dep) {
    return;
  }
  let nextDep = null;
  if (sub.state & STATE_RECOMPUTING) {
    nextDep = prevDep ? prevDep.nextDep : sub.deps;
    if (nextDep && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
  }
  let prevSub = dep.subsTail;
  if (prevSub && prevSub.version === version && prevSub.sub === sub) {
    return;
  }
  let pooled = linkPool.pop(), newLink = sub.depsTail = dep.subsTail = pooled ? (pooled.dep = dep, pooled.sub = sub, pooled.nextDep = nextDep, pooled.prevSub = prevSub, pooled.nextSub = null, pooled.version = version, pooled) : {
    dep,
    sub,
    nextDep,
    prevSub,
    nextSub: null,
    version
  };
  if (prevDep) {
    prevDep.nextDep = newLink;
  } else {
    sub.deps = newLink;
  }
  if (prevSub) {
    prevSub.nextSub = newLink;
  } else {
    dep.subs = newLink;
  }
}
function notify(computed2, newState = STATE_DIRTY) {
  let state = computed2.state;
  if ((state & STATE_NOTIFY_MASK) >= newState) {
    return;
  }
  computed2.state = state | newState;
  for (let link2 = computed2.subs; link2; link2 = link2.nextSub) {
    notify(link2.sub, STATE_CHECK);
  }
}
function recompute(computed2, del) {
  if (del) {
    deleteFromHeap(computed2);
  } else {
    computed2.nextHeap = void 0;
    computed2.prevHeap = computed2;
  }
  if (computed2.cleanup) {
    cleanup(computed2);
  }
  let o = observer, ok = true, value;
  observer = computed2;
  computed2.depsTail = null;
  computed2.state = STATE_RECOMPUTING;
  depth++;
  version++;
  try {
    value = computed2.fn(onCleanup);
  } catch (e) {
    ok = false;
  }
  depth--;
  observer = o;
  computed2.state = STATE_NONE$1;
  let depsTail = computed2.depsTail, remove2 = depsTail ? depsTail.nextDep : computed2.deps;
  if (remove2) {
    do {
      remove2 = unlink(remove2);
    } while (remove2);
    if (depsTail) {
      depsTail.nextDep = null;
    } else {
      computed2.deps = null;
    }
  }
  if (ok && value !== computed2.value) {
    computed2.value = value;
    for (let c = computed2.subs; c; c = c.nextSub) {
      let s = c.sub, state = s.state;
      if (state & STATE_CHECK) {
        s.state = state | STATE_DIRTY;
      }
      insertIntoHeap(s);
    }
    schedule$1();
  }
}
function schedule$1() {
  if (stabilizer === STABILIZER_SCHEDULED) {
    return;
  }
  if (stabilizer === STABILIZER_IDLE && !depth) {
    stabilizer = STABILIZER_SCHEDULED;
    microtask(stabilize);
  } else if (stabilizer === STABILIZER_RUNNING) {
    stabilizer = STABILIZER_RESCHEDULE;
  }
}
function stabilize() {
  let o = observer;
  observer = null;
  stabilizer = STABILIZER_RUNNING;
  for (heap_i = 0; heap_i <= heap_n; heap_i++) {
    let computed2 = heap[heap_i];
    heap[heap_i] = void 0;
    while (computed2 !== void 0) {
      let next = computed2.nextHeap;
      recompute(computed2, false);
      computed2 = next;
    }
  }
  while (heap_n > 0 && heap[heap_n] === void 0) {
    heap_n--;
  }
  observer = o;
  if (stabilizer === STABILIZER_RESCHEDULE) {
    microtask(stabilize);
  } else {
    stabilizer = STABILIZER_IDLE;
  }
}
function unlink(link2) {
  let dep = link2.dep, nextDep = link2.nextDep, nextSub = link2.nextSub, prevSub = link2.prevSub;
  if (nextSub) {
    nextSub.prevSub = prevSub;
  } else {
    dep.subsTail = prevSub;
  }
  if (prevSub) {
    prevSub.nextSub = nextSub;
  } else if ((dep.subs = nextSub) === null && dep.type === COMPUTED) {
    dispose$1(dep);
  }
  if (linkPool.length < linkPoolMax) {
    link2.dep = link2.sub = null;
    link2.nextDep = link2.nextSub = link2.prevSub = null;
    linkPool.push(link2);
  }
  return nextDep;
}
function update(computed2) {
  if (computed2.state & STATE_CHECK) {
    for (let link2 = computed2.deps; link2; link2 = link2.nextDep) {
      let dep = link2.dep;
      if (dep.type === COMPUTED) {
        update(dep);
        if (computed2.state & STATE_DIRTY) {
          break;
        }
      }
    }
  }
  if (computed2.state & STATE_DIRTY) {
    recompute(computed2, true);
  }
  computed2.state = STATE_NONE$1;
}
const computed = (fn) => {
  let self = {
    cleanup: null,
    deps: null,
    depsTail: null,
    fn,
    height: 0,
    nextHeap: void 0,
    prevHeap: null,
    state: STATE_NONE$1,
    subs: null,
    subsTail: null,
    type: COMPUTED,
    value: void 0
  };
  self.prevHeap = self;
  if (observer) {
    if (observer.depsTail === null) {
      self.height = observer.height;
      recompute(self, false);
    } else {
      self.height = observer.height + 1;
      insertIntoHeap(self);
      schedule$1();
    }
    link(self, observer);
    onCleanup(() => dispose$1(self));
  } else {
    recompute(self, false);
    root.disposables++;
    if (scope) {
      onCleanup(() => dispose$1(self));
    }
  }
  return self;
};
const dispose$1 = (computed2) => {
  deleteFromHeap(computed2);
  let dep = computed2.deps;
  while (dep) {
    dep = unlink(dep);
  }
  computed2.deps = null;
  if (computed2.cleanup) {
    cleanup(computed2);
  }
};
const effect = (fn) => {
  let c = computed(fn);
  return () => {
    dispose$1(c);
  };
};
const onCleanup = (fn) => {
  let parent = observer || scope;
  if (!parent) {
    return fn;
  }
  let cleanup2 = parent.cleanup;
  if (!cleanup2) {
    parent.cleanup = fn;
  } else if (typeof cleanup2 === "function") {
    parent.cleanup = [cleanup2, fn];
  } else {
    cleanup2.push(fn);
  }
  return fn;
};
const read$1 = (node) => {
  if (observer) {
    link(node, observer);
    if (node.type === COMPUTED) {
      let height = node.height;
      if (height >= observer.height) {
        observer.height = height + 1;
      }
      if (height >= heap_i || node.state & STATE_NOTIFY_MASK) {
        if (!notified) {
          notified = true;
          for (let i = 0; i <= heap_n; i++) {
            for (let computed2 = heap[i]; computed2 !== void 0; computed2 = computed2.nextHeap) {
              notify(computed2);
            }
          }
        }
        update(node);
      }
    }
  }
  return node.value;
};
const root = (fn) => {
  let c, d = root.disposables, o = observer, s = scope, self = null, tracking = fn.length, value;
  observer = null;
  root.disposables = 0;
  if (tracking) {
    scope = self = { cleanup: null };
    value = fn(c = () => dispose$1(self));
  } else {
    scope = null;
    value = fn();
  }
  observer = o;
  root.disposables = d;
  scope = s;
  if (c) {
    onCleanup(c);
  }
  return value;
};
root.disposables = 0;
const signal = (value) => {
  return {
    subs: null,
    subsTail: null,
    type: SIGNAL,
    value
  };
};
const write = (signal2, value) => {
  if (signal2.value === value) {
    return;
  }
  notified = false;
  signal2.value = value;
  if (signal2.subs === null) {
    return;
  }
  for (let link2 = signal2.subs; link2; link2 = link2.nextSub) {
    insertIntoHeap(link2.sub);
  }
  schedule$1();
};
class ReactiveObject {
  disposers = null;
  constructor(data) {
    if (data == null) {
      return;
    }
    for (let key in data) {
      let value = data[key], type = typeof value;
      if (type === "function") {
        let node2 = this[COMPUTED](value);
        defineProperty(this, key, {
          enumerable: true,
          get: () => read$1(node2)
        });
        continue;
      }
      if (value == null || type !== "object") ;
      else if (isArray(value)) {
        defineProperty(this, key, {
          enumerable: true,
          value: this[REACTIVE_ARRAY](value)
        });
        continue;
      }
      let node = signal(value);
      defineProperty(this, key, {
        enumerable: true,
        get() {
          return read$1(node);
        },
        set(v) {
          write(node, v);
        }
      });
    }
  }
  [REACTIVE_ARRAY](value) {
    let node = new ReactiveArray(...value);
    (this.disposers ??= []).push(() => node.dispose());
    return node;
  }
  [COMPUTED](value) {
    return root(() => {
      let node = computed(value);
      if (isPromise(node.value)) {
        let factory2 = node, version2 = 0;
        node = signal(void 0);
        (this.disposers ??= []).push(effect(() => {
          let id = ++version2;
          read$1(factory2).then((v) => {
            if (id !== version2) {
              return;
            }
            write(node, v);
          });
        }));
      } else {
        (this.disposers ??= []).push(() => dispose$1(node));
      }
      return node;
    });
  }
  [SIGNAL](value) {
    return signal(value);
  }
  dispose() {
    let disposers = this.disposers, disposer;
    if (!disposers) {
      return;
    }
    while (disposer = disposers.pop()) {
      disposer();
    }
  }
}
Object.defineProperty(ReactiveObject.prototype, REACTIVE_OBJECT, { value: true });
const isReactiveObject = (value) => {
  return typeof value === "object" && value !== null && value[REACTIVE_OBJECT] === true;
};
function dispose(value) {
  if (isReactiveObject(value)) {
    value.dispose();
  }
}
class ReactiveArray extends Array {
  _length;
  listeners = {};
  constructor(...items) {
    super(...items);
    this._length = signal(items.length);
  }
  $length() {
    return read$1(this._length);
  }
  $set(i, value) {
    let prev = this[i];
    if (prev === value) {
      return;
    }
    this[i] = value;
    if (i >= super.length) {
      write(this._length, i + 1);
    }
    this.dispatch("set", { index: i, item: value });
  }
  clear() {
    this.dispose();
    write(this._length, 0);
    this.dispatch("clear");
  }
  concat(...items) {
    let added = [];
    for (let i = 0, n = items.length; i < n; i++) {
      let item = items[i];
      if (isArray(item)) {
        for (let j = 0, o = item.length; j < o; j++) {
          added.push(item[j]);
          super.push(item[j]);
        }
      } else {
        added.push(item);
        super.push(item);
      }
    }
    if (added.length) {
      write(this._length, super.length);
      this.dispatch("concat", { items: added });
    }
    return this;
  }
  dispatch(event, value) {
    let listeners = this.listeners[event];
    if (!listeners) {
      return;
    }
    for (let i = 0, n = listeners.length; i < n; i++) {
      let listener = listeners[i];
      if (listener === null) {
        continue;
      }
      try {
        listener(value);
        if (listener.once !== void 0) {
          listeners[i] = null;
        }
      } catch {
        listeners[i] = null;
      }
    }
    while (listeners.length && listeners[listeners.length - 1] === null) {
      listeners.pop();
    }
  }
  dispose() {
    while (this.length) {
      dispose(super.pop());
    }
    write(this._length, 0);
  }
  on(event, listener) {
    let listeners = this.listeners[event];
    if (listeners === void 0) {
      this.listeners[event] = [listener];
    } else {
      let hole = listeners.length;
      for (let i = 0, n = hole; i < n; i++) {
        let l = listeners[i];
        if (l === listener) {
          return;
        } else if (l === null && hole === n) {
          hole = i;
        }
      }
      listeners[hole] = listener;
      while (listeners.length && listeners[listeners.length - 1] === null) {
        listeners.pop();
      }
    }
  }
  once(event, listener) {
    listener.once = true;
    this.on(event, listener);
  }
  pop() {
    let item = super.pop();
    if (item !== void 0) {
      dispose(item);
      write(this._length, super.length);
      this.dispatch("pop", { item });
    }
    return item;
  }
  push(...items) {
    if (!items.length) {
      return super.length;
    }
    let length = super.push(...items);
    write(this._length, length);
    this.dispatch("push", { items });
    return length;
  }
  reverse() {
    super.reverse();
    this.dispatch("reverse");
    return this;
  }
  shift() {
    let item = super.shift();
    if (item !== void 0) {
      dispose(item);
      write(this._length, super.length);
      this.dispatch("shift", { item });
    }
    return item;
  }
  sort(fn) {
    let before = new Array(this.length);
    for (let i = 0, n = before.length; i < n; i++) {
      before[i] = this[i];
    }
    super.sort(fn);
    let buckets = /* @__PURE__ */ new Map(), cursors = /* @__PURE__ */ new Map(), order = new Array(this.length);
    for (let i = 0, n = before.length; i < n; i++) {
      let value = before[i], list2 = buckets.get(value);
      if (!list2) {
        buckets.set(value, [i]);
      } else {
        list2.push(i);
      }
    }
    for (let i = 0, n = this.length; i < n; i++) {
      let value = this[i], list2 = buckets.get(value);
      if (!list2) {
        order[i] = i;
        continue;
      }
      let cursor = cursors.get(value) || 0;
      order[i] = list2[cursor];
      cursors.set(value, cursor + 1);
    }
    this.dispatch("sort", { order });
    return this;
  }
  splice(start, deleteCount = this.length, ...items) {
    let removed = super.splice(start, deleteCount, ...items);
    if (items.length > 0 || removed.length > 0) {
      write(this._length, super.length);
      for (let i = 0, n = removed.length; i < n; i++) {
        dispose(removed[i]);
      }
      this.dispatch("splice", { deleteCount, items, start });
    }
    return removed;
  }
  unshift(...items) {
    let length = super.unshift(...items);
    write(this._length, length);
    this.dispatch("unshift", { items });
    return length;
  }
}
Object.defineProperty(ReactiveArray.prototype, REACTIVE_ARRAY, { value: true });
function reactive$1(input) {
  let dispose2 = false, value = root(() => {
    let response;
    if (isObject(input)) {
      response = new ReactiveObject(input);
    } else if (isArray(input)) {
      response = new ReactiveArray(...input);
    }
    if (response) {
      if (root.disposables) {
        dispose2 = true;
      }
      return response;
    }
    throw new Error(`${PACKAGE_NAME}: 'reactive' received invalid input - ${JSON.stringify(input)}`);
  });
  if (dispose2) {
    onCleanup(() => value.dispose());
  }
  return value;
}
const ARRAY_SLOT = /* @__PURE__ */ Symbol("template.array.slot");
const ATTRIBUTE_DELIMITERS = {
  class: " ",
  style: ";"
};
const CLEANUP = /* @__PURE__ */ Symbol("template.cleanup");
const SLOT_HTML = "<!--$-->";
const STATE_HYDRATING = 0;
const STATE_NONE = 1;
const STATE_WAITING = 2;
const STORE = /* @__PURE__ */ Symbol("template.store");
let tmpl = document.createElement("template"), txt = document.createTextNode("");
const clone = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox") ? document.importNode.bind(document) : (node, deep = true) => node.cloneNode(deep);
const fragment = (html2) => {
  let element = tmpl.cloneNode();
  element.innerHTML = html2;
  return element.content;
};
const marker = fragment(SLOT_HTML).firstChild;
const raf = globalThis?.requestAnimationFrame;
const template = (html2) => {
  let cached;
  return () => {
    if (!cached) {
      let element = tmpl.cloneNode();
      element.innerHTML = html2;
      cached = element.content;
    }
    return clone(cached, true);
  };
};
const text = (value) => {
  let element = txt.cloneNode();
  if (value !== "") {
    element.nodeValue = value;
  }
  return element;
};
const ondisconnect$1 = (element, fn) => {
  (element[CLEANUP] ??= []).push(fn);
};
const remove = (...groups) => {
  for (let i = 0, n = groups.length; i < n; i++) {
    let fns, fn, group = groups[i], head = group.head, next, tail = group.tail || head;
    while (tail) {
      if (fns = tail[CLEANUP]) {
        while (fn = fns.pop()) {
          fn();
        }
      }
      next = tail.previousSibling;
      tail.remove();
      if (head === tail) {
        break;
      }
      tail = next;
    }
  }
};
const EMPTY_FRAGMENT$1 = fragment("");
function render(anchor, value) {
  if (value == null || value === false || value === "") {
    return EMPTY_FRAGMENT$1;
  }
  if (typeof value !== "object") {
    return text(value);
  }
  if (value[ARRAY_SLOT] === true) {
    return value.fragment;
  }
  if (value.nodeType !== void 0) {
    return value;
  }
  let n = value.length;
  if (typeof n === "number") {
    if (n === 0) {
      return EMPTY_FRAGMENT$1;
    } else if (n === 1) {
      return render(anchor, value[0]);
    }
  }
  if (isArray(value)) {
    let fragment2 = clone(EMPTY_FRAGMENT$1);
    for (let i = 0; i < n; i++) {
      fragment2.append(render(anchor, value[i]));
      anchor = fragment2.lastChild;
    }
    return fragment2;
  }
  if (value instanceof NodeList) {
    let fragment2 = clone(EMPTY_FRAGMENT$1);
    for (let i = 0; i < n; i++) {
      fragment2.append(value[i]);
    }
    return fragment2;
  }
  return text(value);
}
function read(value) {
  if (typeof value === "function") {
    return read(value());
  }
  if (value == null || value === false) {
    return "";
  }
  return value;
}
class EffectSlot {
  anchor;
  disposer;
  group = null;
  scheduled = false;
  textnode = null;
  constructor(anchor, fn) {
    let dispose2 = fn.length ? () => this.dispose() : void 0, value;
    this.anchor = anchor;
    this.disposer = effect(() => {
      value = read(fn(dispose2));
      if (!this.disposer) {
        this.update(value);
      } else if (!this.scheduled) {
        this.scheduled = true;
        raf(() => {
          this.scheduled = false;
          this.update(value);
        });
      }
    });
  }
  dispose() {
    let { anchor, group, textnode } = this;
    if (textnode) {
      group = { head: anchor, tail: textnode };
    } else if (group) {
      group.head = anchor;
    }
    this.disposer();
    if (group) {
      remove(group);
    }
  }
  update(value) {
    let { anchor, group, textnode } = this;
    if (group) {
      remove(group);
      this.group = null;
    }
    if (typeof value !== "object") {
      if (typeof value !== "string") {
        value = String(value);
      }
      if (textnode) {
        textnode.nodeValue = value;
        if (!textnode.isConnected) {
          anchor.after(textnode);
        }
      } else {
        anchor.after(this.textnode = text(value));
      }
    } else {
      let fragment2 = render(anchor, value), head = fragment2.firstChild;
      if (textnode?.isConnected) {
        remove({ head: textnode, tail: textnode });
      }
      if (head) {
        this.group = {
          head,
          tail: fragment2.lastChild
        };
        anchor.after(fragment2);
      }
    }
  }
}
const EMPTY_FRAGMENT = fragment("");
class ArraySlot {
  array;
  marker;
  nodes = [];
  queue = [];
  scheduled = false;
  signal;
  template;
  fragment;
  constructor(array, template2) {
    this.array = array;
    let fragment2 = this.fragment = clone(EMPTY_FRAGMENT);
    this.marker = marker.cloneNode();
    this.signal = signal(array.length);
    this.template = function(data) {
      let dispose2, frag = root((d) => {
        dispose2 = d;
        return template2(data);
      }), group = {
        head: frag.firstChild,
        tail: frag.lastChild
      };
      fragment2.append(frag);
      ondisconnect$1(group.head, dispose2);
      return group;
    };
    fragment2.append(this.marker);
    if (array.length) {
      root(() => {
        this.nodes = array.map(this.template);
      });
    }
    array.on("clear", () => {
      this.queue.length = 0;
      this.schedule({ op: "clear" });
    });
    array.on("concat", ({ items }) => {
      this.schedule({ items, op: "concat" });
    });
    array.on("pop", () => {
      this.schedule({ op: "pop" });
    });
    array.on("push", ({ items }) => {
      this.schedule({ items, op: "push" });
    });
    array.on("reverse", () => {
      this.schedule({ op: "reverse" });
    });
    array.on("shift", () => {
      this.schedule({ op: "shift" });
    });
    array.on("sort", ({ order }) => {
      this.schedule({ op: "sort", order });
    });
    array.on("splice", ({ deleteCount, items, start }) => {
      this.schedule({ deleteCount, items, op: "splice", start });
    });
    array.on("unshift", ({ items }) => {
      this.schedule({ items, op: "unshift" });
    });
  }
  anchor(index = this.nodes.length - 1) {
    let node = this.nodes[index];
    if (node) {
      return node.tail || node.head;
    }
    return this.marker;
  }
  clear() {
    remove(...this.nodes.splice(0));
  }
  pop() {
    let group = this.nodes.pop();
    if (group) {
      remove(group);
    }
  }
  push(items) {
    let anchor = this.anchor();
    this.nodes.push(...items.map(this.template));
    anchor.after(this.fragment);
  }
  schedule(op) {
    this.queue.push(op);
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    raf(() => {
      let queue2 = this.queue;
      this.queue = [];
      this.scheduled = false;
      root(() => {
        for (let i = 0, n = queue2.length; i < n; i++) {
          let op2 = queue2[i];
          switch (op2.op) {
            case "clear":
              this.clear();
              break;
            case "concat":
              this.push(op2.items);
              break;
            case "pop":
              this.pop();
              break;
            case "push":
              this.push(op2.items);
              break;
            case "reverse":
              this.nodes.reverse();
              this.sync();
              break;
            case "shift":
              this.shift();
              break;
            case "sort":
              this.sort(op2.order);
              break;
            case "splice":
              this.splice(op2.start, op2.deleteCount, op2.items);
              break;
            case "unshift":
              this.unshift(op2.items);
              break;
          }
        }
      });
      write(this.signal, this.nodes.length);
    });
  }
  shift() {
    let group = this.nodes.shift();
    if (group) {
      remove(group);
    }
  }
  sort(order) {
    let nodes = this.nodes, n = nodes.length;
    if (n !== order.length) {
      remove(...nodes.splice(0));
      this.nodes = this.array.map(this.template);
      this.marker.after(this.fragment);
      return;
    }
    let sorted = new Array(n);
    for (let i = 0; i < n; i++) {
      sorted[i] = nodes[order[i]];
    }
    this.nodes = sorted;
    this.sync();
  }
  splice(start, stop = this.nodes.length, items) {
    if (!items.length) {
      remove(...this.nodes.splice(start, stop));
      return;
    }
    remove(...this.nodes.splice(start, stop, ...items.map(this.template)));
    this.anchor(start - 1).after(this.fragment);
  }
  sync() {
    let nodes = this.nodes, n = nodes.length;
    if (!n) {
      return;
    }
    for (let i = 0; i < n; i++) {
      let group = nodes[i], next, node = group.head;
      while (node) {
        next = node === group.tail ? null : node.nextSibling;
        this.fragment.append(node);
        node = next;
      }
    }
    this.marker.after(this.fragment);
  }
  unshift(items) {
    this.nodes.unshift(...items.map(this.template));
    this.marker.after(this.fragment);
  }
  get length() {
    return read$1(this.signal);
  }
}
Object.defineProperty(ArraySlot.prototype, ARRAY_SLOT, { value: true });
const slot = (anchor, renderable) => {
  if (typeof renderable === "function") {
    new EffectSlot(anchor, renderable);
  } else {
    anchor.after(render(anchor, renderable));
  }
};
Object.assign(/* @__PURE__ */ new Set(), { running: false });
let controllers = /* @__PURE__ */ new Map(), host = window.document, keys = {}, passive = /* @__PURE__ */ new Set([
  "animationend",
  "animationiteration",
  "animationstart",
  "mousedown",
  "mouseenter",
  "mouseleave",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "mousewheel",
  "pointerenter",
  "pointerleave",
  "pointermove",
  "pointerout",
  "pointerover",
  "scroll",
  "touchcancel",
  "touchend",
  "touchleave",
  "touchmove",
  "touchstart",
  "transitionend",
  "wheel"
]);
["mousemove", "mousewheel", "scroll", "touchend", "touchmove", "touchstart", "wheel"].map((event) => {
  controllers.set(event, null);
});
function register(element, event) {
  let controller = controllers.get(event), signal2;
  if (controller === null) {
    let { abort, signal: signal3 } = new AbortController();
    controllers.set(event, controller = {
      abort,
      signal: signal3,
      listeners: 0
    });
  }
  if (controller) {
    controller.listeners++;
    ondisconnect(element, () => {
      if (--controller.listeners) {
        return;
      }
      controller.abort();
      controllers.set(event, null);
    });
    signal2 = controller.signal;
  }
  let key = keys[event] = /* @__PURE__ */ Symbol();
  host.addEventListener(event, (e) => {
    let fn, node = e.target;
    while (node) {
      fn = node[key];
      if (typeof fn === "function") {
        defineProperty(e, "currentTarget", {
          configurable: true,
          get() {
            return node || window.document;
          }
        });
        return fn.call(node, e);
      }
      node = node.parentElement;
    }
  }, {
    passive: passive.has(event),
    signal: signal2
  });
  return key;
}
const delegate = (element, event, listener) => {
  element[keys[event] || register(element, event)] = listener;
};
const ondisconnect = (element, listener) => {
  ondisconnect$1(element, () => listener(element));
};
let Node$1 = class Node2 {
  data;
  next = null;
  constructor(size) {
    this.data = new Array(size);
  }
};
class Queue {
  head = null;
  headIndex = 0;
  pool = null;
  preallocate;
  size = 0;
  tail = null;
  tailIndex = 0;
  constructor(preallocate) {
    this.preallocate = preallocate;
  }
  allocate() {
    let node = this.pool;
    if (node) {
      this.pool = node.next;
      node.next = null;
      return node;
    }
    return new Node$1(this.preallocate);
  }
  release(node) {
    node.next = this.pool;
    this.pool = node;
  }
  get length() {
    return this.size;
  }
  add(value) {
    let preallocate = this.preallocate, size = this.size, tail = this.tail, tailIndex = this.tailIndex;
    if (tail === null) {
      tail = this.head = this.tail = this.allocate();
      tailIndex = 0;
    } else if (size === 0) {
      tailIndex = 0;
      this.headIndex = 0;
    } else if (tailIndex === preallocate) {
      tail = tail.next = this.allocate();
      tailIndex = 0;
      this.tail = tail;
    }
    tail.data[tailIndex] = value;
    this.tailIndex = tailIndex + 1;
    this.size = size + 1;
  }
  clear() {
    let head = this.head;
    while (head !== null) {
      let next = head.next;
      this.release(head);
      head = next;
    }
    this.head = null;
    this.headIndex = 0;
    this.size = 0;
    this.tail = null;
    this.tailIndex = 0;
  }
  next() {
    let size = this.size;
    if (size === 0) {
      return void 0;
    }
    let head = this.head, headIndex = this.headIndex, preallocate = this.preallocate, value = head.data[headIndex];
    head.data[headIndex] = void 0;
    headIndex++;
    size--;
    if (headIndex === preallocate) {
      let next = head.next;
      this.release(head);
      this.head = next;
      headIndex = 0;
      if (next === null) {
        this.tail = null;
        this.tailIndex = 0;
      }
    }
    this.headIndex = headIndex;
    this.size = size;
    return value;
  }
}
const READY = 0;
const RUNNING = 1;
const SCHEDULED = 2;
class Scheduler {
  lastRunAt = 0;
  queue;
  scheduler;
  state = READY;
  task;
  throttled = null;
  constructor(queue2, scheduler) {
    this.queue = queue2;
    this.scheduler = scheduler;
    this.task = () => this.run();
  }
  run() {
    if (this.state === RUNNING) {
      return;
    }
    this.state = RUNNING;
    let elapsed = Date.now() - this.lastRunAt, throttle = this.throttled;
    if (!throttle || throttle.interval <= elapsed) {
      let q = this.queue, n = throttle?.limit ?? q.length;
      for (let i = 0; i < n; i++) {
        let task2 = q.next();
        if (!task2) {
          break;
        }
        task2();
      }
      this.lastRunAt = Date.now();
    }
    this.state = READY;
    this.schedule();
  }
  get length() {
    return this.queue.length;
  }
  add(task2) {
    this.queue.add(task2);
    this.schedule();
    return this;
  }
  schedule() {
    if (this.state !== READY || !this.queue.length) {
      return this;
    }
    this.state = SCHEDULED;
    this.scheduler(this.task);
    return this;
  }
  throttle(limit, ms) {
    this.throttled = {
      interval: ms / limit,
      limit
    };
    return this;
  }
}
const api = (preallocate = 128) => {
  return new Queue(preallocate);
};
api.immediate = () => {
  let { port1, port2 } = new MessageChannel();
  return new Scheduler(api(), (task2) => {
    if (port1.onmessage !== task2) {
      port1.onmessage = task2;
    }
    port2.postMessage(null);
  });
};
api.micro = () => {
  let queueMicrotask2 = globalThis?.queueMicrotask;
  if (queueMicrotask2) {
    return new Scheduler(api(), (task2) => queueMicrotask2(task2));
  }
  let resolved = Promise.resolve();
  return new Scheduler(api(), (task2) => resolved.then(task2));
};
api.raf = () => {
  let requestAnimationFrame = globalThis?.requestAnimationFrame;
  if (requestAnimationFrame) {
    return new Scheduler(api(), (task2) => requestAnimationFrame(task2));
  }
  return new Scheduler(api(), (task2) => setTimeout(task2, 16));
};
let queue = api(64), scheduled = false;
function apply(element, name, value) {
  if (value == null || value === false || value === "") {
    element.removeAttribute(name);
  } else if (name === "class") {
    element.className = value;
  } else if (name === "style" || name[0] === "d" && name.startsWith("data-") || element["ownerSVGElement"]) {
    element.setAttribute(name, value);
  } else {
    element[name] = value;
  }
}
function context(element) {
  return element[STORE] ??= { element };
}
function list(ctx, element, id, name, state, value) {
  if (value == null || value === false || value === "") {
    value = "";
  }
  let changed = false, delimiter = ATTRIBUTE_DELIMITERS[name], store = (ctx ??= context(element)).store ??= {}, dynamic = store[name];
  if (!dynamic) {
    store[name + ".static"] = (element.getAttribute(name) || "").trim();
    store[name] = dynamic = /* @__PURE__ */ new Set();
  }
  if (id === null) {
    if (value && typeof value === "string") {
      changed = true;
      store[name + ".static"] += (store[name + ".static"] ? delimiter : "") + value;
    }
  } else if (store[id + ".raw"] !== value) {
    let hot = {};
    if (value && typeof value === "string") {
      let part, parts = value.split(delimiter);
      while (part = parts.pop()) {
        part = part.trim();
        if (part === "") {
          continue;
        }
        if (!dynamic.has(part)) {
          changed = true;
          dynamic.add(part);
        }
        hot[part] = true;
      }
    }
    let cold = store[id];
    if (cold !== void 0) {
      for (let part in cold) {
        if (hot[part] === true) {
          continue;
        }
        changed = true;
        dynamic.delete(part);
      }
    }
    store[id + ".raw"] = value;
    store[id] = hot;
  }
  if (!changed) {
    return;
  }
  value = store[name + ".static"];
  for (let key of dynamic) {
    value += (value ? delimiter : "") + key;
  }
  if (state === STATE_HYDRATING) {
    apply(element, name, value);
  } else {
    schedule(ctx, element, name, state, value);
  }
}
function property(ctx, element, id, name, state, value) {
  if (value == null || value === false || value === "") {
    value = "";
  }
  if (id !== null) {
    ctx ??= context(element);
    if (ctx[name] === value) {
      return;
    }
    ctx[name] = value;
  }
  if (state === STATE_HYDRATING) {
    apply(element, name, value);
  } else {
    schedule(ctx, element, name, state, value);
  }
}
function reactive(element, name, state, value) {
  let ctx = context(element), fn = name === "class" || name === "style" ? list : property;
  ctx.effect ??= 0;
  let id = ctx.effect++;
  effect(() => {
    let v = value(element);
    if (v == null || typeof v !== "object") {
      fn(ctx, element, id, name, state, v);
    } else if (isArray(v)) {
      let last = v.length - 1;
      for (let i = 0, n = v.length; i < n; i++) {
        fn(ctx, element, id, name, state === STATE_HYDRATING ? state : i !== last ? STATE_WAITING : state, v[i]);
      }
    }
  });
  state = STATE_NONE;
}
function schedule(ctx, element, name, state, value) {
  ctx ??= context(element);
  (ctx.updates ??= {})[name] = value;
  if (state === STATE_NONE && !ctx.updating) {
    ctx.updating = true;
    queue.add(ctx);
  }
  if (scheduled) {
    return;
  }
  scheduled = true;
  raf(task);
}
function task() {
  let context2, n = queue.length;
  while ((context2 = queue.next()) && n--) {
    let { element, updates } = context2;
    for (let name in updates) {
      apply(element, name, updates[name]);
    }
    context2.updates = {};
    context2.updating = false;
  }
  if (queue.length) {
    raf(task);
  } else {
    scheduled = false;
  }
}
const setList = (element, name, value, attributes = {}) => {
  let ctx = context(element), store = ctx.store ??= {};
  store[name] ??= /* @__PURE__ */ new Set();
  store[name + ".static"] ??= "";
  store[name + ".static"] += `${attributes[name] && store[name + ".static"] ? ATTRIBUTE_DELIMITERS[name] : ""}${attributes[name]}`;
  if (typeof value === "function") {
    reactive(element, name, STATE_HYDRATING, value);
  } else if (typeof value !== "object") {
    list(ctx, element, null, name, STATE_HYDRATING, value);
  } else if (isArray(value)) {
    for (let i = 0, n = value.length; i < n; i++) {
      let v = value[i];
      if (v == null || v === false || v === "") {
        continue;
      }
      list(ctx, element, null, name, STATE_HYDRATING, v);
    }
  }
};
const setProperty = (element, name, value) => {
  if (typeof value === "function") {
    reactive(element, name, STATE_HYDRATING, value);
  } else {
    property(null, element, null, name, STATE_HYDRATING, value);
  }
};
const html = (_literals, ..._values) => {
  throw new Error("html`` templates must be compiled. Ensure vite-plugin is configured.");
};
html.reactive = (_arr, _template) => {
  throw new Error("html.reactive() must be compiled. Ensure vite-plugin is configured.");
};
let factory = template("<svg><use /></svg>");
const svg = html.bind(null);
svg.sprite = (href) => {
  if (href[0] !== "#") {
    href = "#" + href;
  }
  let root2 = factory();
  setProperty(root2.firstChild.firstChild, "href", href);
  return root2;
};
if (typeof Node !== "undefined") {
  Node.prototype[CLEANUP] = null;
  Node.prototype[STORE] = null;
}
const template_77447a9a695040d8bcd63a98c06d66fc3 = template(`<div class="counter"><span class="count"><!--$--></span><span class="enabled"><!--$--></span><span class="message"><!--$--></span><span class="price"><!--$--></span></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc9 = template(`<li><!--$--></li>`);
const template_77447a9a695040d8bcd63a98c06d66fcc = template(`<div class="computed"><h1><!--$--></h1><p>Items: <!--$--></p><p>Total: <!--$--></p><ul><!--$--></ul></div>`);
const template_77447a9a695040d8bcd63a98c06d66fci = template(`<span class="num"><!--$--></span>`);
const template_77447a9a695040d8bcd63a98c06d66fcl = template(`<span class="str"><!--$--></span>`);
const template_77447a9a695040d8bcd63a98c06d66fco = template(`<span class="mix"><!--$--></span>`);
const template_77447a9a695040d8bcd63a98c06d66fcr = template(`<div class="arrays"><section><h2>Numbers</h2><!--$--></section><section><h2>Strings</h2><!--$--></section><section><h2>Mixed</h2><!--$--></section></div>`);
const template_77447a9a695040d8bcd63a98c06d66fcw = template(`<div class="objects"><section class="user"><h2><!--$--></h2><p>Age: <!--$--></p><p>Email: <!--$--></p></section><section class="product"><p>Price: $<!--$--></p><p>Discount: <!--$-->%</p><p>Final: $<!--$--></p></section><section class="config"><p>Theme: <!--$--></p><p>Debug: <!--$--></p></section></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc16 = template(`<div class="item "><span><!--$--></span><input type="checkbox" checked= /></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc1c = template(`<button> Count <!--$-->: <!--$--></button>`);
const template_77447a9a695040d8bcd63a98c06d66fc1h = template(`<div class="complex"><header><span>Total: <!--$--></span><span>Selected: <!--$--></span></header><main><!--$--></main><footer><!--$--></footer></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc1m = template(`<details>Expanded content</details>`);
const template_77447a9a695040d8bcd63a98c06d66fc1n = template(`<summary>Click to expand</summary>`);
const template_77447a9a695040d8bcd63a98c06d66fc1o = template(`<div class="loading">Loading...</div>`);
const template_77447a9a695040d8bcd63a98c06d66fc1p = template(`<div class="error">Error occurred</div>`);
const template_77447a9a695040d8bcd63a98c06d66fc1q = template(`<div class="success">Success!</div>`);
const template_77447a9a695040d8bcd63a98c06d66fc1s = template(`<span>Welcome, <!--$--></span>`);
const template_77447a9a695040d8bcd63a98c06d66fc1u = template(`<span>Please log in</span>`);
const template_77447a9a695040d8bcd63a98c06d66fc1w = template(`<div class="conditional"><!--$--><!--$--><!--$--></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc21 = template(`<li><!--$--><button>Remove</button></li>`);
const template_77447a9a695040d8bcd63a98c06d66fc25 = template(`<div class="events"><button> Clicked <!--$--> times </button><input type="text" value= /><button> Add Item </button><ul><!--$--></ul></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc2c = template(`<div class="attributes"><button class= disabled= data-value= style=> Dynamic Button </button><a href= target="_blank">Dynamic Link</a><input type="text" class= placeholder= /></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc2j = template(`<span><!--$--></span>`);
const template_77447a9a695040d8bcd63a98c06d66fc2m = template(`<div class="mixed"><section><h3>Primitive: <!--$--></h3><h3>Computed: <!--$--></h3></section><section><h3>Object Name: <!--$--></h3><h3>Object Count: <!--$--></h3><h3>Object Double: <!--$--></h3></section><section><h3>Array Length: <!--$--></h3><!--$--></section><section><button> Increment All </button></section></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc2w = template(`<div class="todo "><input type="checkbox" checked= /><span><!--$--></span></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc32 = template(`<div class="todo-app"><header><h1>Todos (<!--$--> completed)</h1><nav><button class=>All</button><button class=>Active</button><button class=>Completed</button></nav></header><main><!--$--></main></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc3c = template(`<div class="leaf"><span><!--$-->: <!--$--></span><button>+</button></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc3h = template(`<div class="branch"><h2><!--$--></h2><!--$--></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc3l = template(`<div class="tree"><h1><!--$--></h1><!--$--></div>`);
const template_77447a9a695040d8bcd63a98c06d66fc3p = template(`<div class="static-dynamic"><p>Static text here</p><p><!--$--> text here</p><span>Static number: 100</span><span>Dynamic number: <!--$--></span><div class="static-class">Static class</div><div>Dynamic class</div><a href="https://static.com">Static link</a><a href=>Dynamic link</a><input type="text" value="static" /><input type="text" value= /></div>`);
function testPrimitiveSignals() {
  let count = reactive$1(0), enabled = reactive$1(true), message = reactive$1("Hello"), price = reactive$1(19.99);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc2 = template_77447a9a695040d8bcd63a98c06d66fc3(), element_77447a9a695040d8bcd63a98c06d66fc4 = root_77447a9a695040d8bcd63a98c06d66fc2.firstChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc5 = root_77447a9a695040d8bcd63a98c06d66fc2.firstChild.firstElementChild.nextElementSibling.firstChild, element_77447a9a695040d8bcd63a98c06d66fc6 = root_77447a9a695040d8bcd63a98c06d66fc2.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild, element_77447a9a695040d8bcd63a98c06d66fc7 = root_77447a9a695040d8bcd63a98c06d66fc2.firstChild.firstElementChild.nextElementSibling.nextElementSibling.nextElementSibling.firstChild;
    slot(element_77447a9a695040d8bcd63a98c06d66fc4, count);
    slot(element_77447a9a695040d8bcd63a98c06d66fc5, enabled);
    slot(element_77447a9a695040d8bcd63a98c06d66fc6, message);
    slot(element_77447a9a695040d8bcd63a98c06d66fc7, price);
    return root_77447a9a695040d8bcd63a98c06d66fc2;
  })();
  count++;
  count--;
  count += 5;
  count -= 2;
  count *= 2;
  enabled = !enabled;
  message = message + " World";
  return { count, enabled, message, price, view };
}
function testComputedValues() {
  let firstName = reactive$1("John"), lastName = reactive$1("Doe"), items = reactive$1([1, 2, 3, 4, 5]);
  let fullName = reactive$1(() => `${firstName} ${lastName}`), itemCount = reactive$1(() => items.length), doubled = reactive$1(() => items.map((x) => x * 2)), total = reactive$1(() => items.reduce((a, b) => a + b, 0));
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fcb = template_77447a9a695040d8bcd63a98c06d66fcc(), element_77447a9a695040d8bcd63a98c06d66fcd = root_77447a9a695040d8bcd63a98c06d66fcb.firstChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fce = root_77447a9a695040d8bcd63a98c06d66fcb.firstChild.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fcf = root_77447a9a695040d8bcd63a98c06d66fcb.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fcg = root_77447a9a695040d8bcd63a98c06d66fcb.firstChild.firstElementChild.nextElementSibling.nextElementSibling.nextElementSibling.firstChild;
    slot(element_77447a9a695040d8bcd63a98c06d66fcd, fullName);
    slot(element_77447a9a695040d8bcd63a98c06d66fce, itemCount);
    slot(element_77447a9a695040d8bcd63a98c06d66fcf, total);
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fcg, () => doubled.map((n) => {
      let root_77447a9a695040d8bcd63a98c06d66fc8 = template_77447a9a695040d8bcd63a98c06d66fc9(), element_77447a9a695040d8bcd63a98c06d66fca = root_77447a9a695040d8bcd63a98c06d66fc8.firstChild.firstChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fca, n);
      return root_77447a9a695040d8bcd63a98c06d66fc8;
    }));
    return root_77447a9a695040d8bcd63a98c06d66fcb;
  })();
  firstName = "Jane";
  items.push(6);
  return { doubled, firstName, fullName, itemCount, items, lastName, total, view };
}
function testReactiveArrays() {
  let numbers = reactive$1([1, 2, 3]), strings = reactive$1(["a", "b", "c"]), mixed = reactive$1([1, "two", 3, "four"]);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fcq = template_77447a9a695040d8bcd63a98c06d66fcr(), element_77447a9a695040d8bcd63a98c06d66fcs = root_77447a9a695040d8bcd63a98c06d66fcq.firstChild.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fct = root_77447a9a695040d8bcd63a98c06d66fcq.firstChild.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fcu = root_77447a9a695040d8bcd63a98c06d66fcq.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling;
    element_77447a9a695040d8bcd63a98c06d66fcs.parentNode.insertBefore(new ArraySlot(numbers, (n) => {
      let root_77447a9a695040d8bcd63a98c06d66fch = template_77447a9a695040d8bcd63a98c06d66fci(), element_77447a9a695040d8bcd63a98c06d66fcj = root_77447a9a695040d8bcd63a98c06d66fch.firstChild.firstChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fcj, n);
      return root_77447a9a695040d8bcd63a98c06d66fch;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fcs);
    element_77447a9a695040d8bcd63a98c06d66fct.parentNode.insertBefore(new ArraySlot(strings, (s) => {
      let root_77447a9a695040d8bcd63a98c06d66fck = template_77447a9a695040d8bcd63a98c06d66fcl(), element_77447a9a695040d8bcd63a98c06d66fcm = root_77447a9a695040d8bcd63a98c06d66fck.firstChild.firstChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fcm, s);
      return root_77447a9a695040d8bcd63a98c06d66fck;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fct);
    element_77447a9a695040d8bcd63a98c06d66fcu.parentNode.insertBefore(new ArraySlot(mixed, (m) => {
      let root_77447a9a695040d8bcd63a98c06d66fcn = template_77447a9a695040d8bcd63a98c06d66fco(), element_77447a9a695040d8bcd63a98c06d66fcp = root_77447a9a695040d8bcd63a98c06d66fcn.firstChild.firstChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fcp, m);
      return root_77447a9a695040d8bcd63a98c06d66fcn;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fcu);
    return root_77447a9a695040d8bcd63a98c06d66fcq;
  })();
  numbers.push(4);
  numbers.unshift(0);
  numbers[2] = 99;
  strings.pop();
  strings.shift();
  strings.splice(0, 0, "inserted");
  let numLen = numbers.length, strLen = strings.length;
  return { mixed, numLen, numbers, strLen, strings, view };
}
function testReactiveObjects() {
  let user = reactive$1({
    age: 25,
    email: "john@example.com",
    name: "John"
  });
  let product = reactive$1({
    discount: 0.1,
    finalPrice: () => product.price * (1 - product.discount),
    price: 100
  });
  let config = reactive$1({
    debug: false,
    features: {
      darkMode: true,
      notifications: false
    },
    theme: "light"
  });
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fcv = template_77447a9a695040d8bcd63a98c06d66fcw(), element_77447a9a695040d8bcd63a98c06d66fcx = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fcy = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fcz = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc10 = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.nextElementSibling.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc11 = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc12 = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc13 = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc14 = root_77447a9a695040d8bcd63a98c06d66fcv.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.nextElementSibling.firstChild.nextSibling;
    slot(element_77447a9a695040d8bcd63a98c06d66fcx, user.name);
    slot(element_77447a9a695040d8bcd63a98c06d66fcy, user.age);
    slot(element_77447a9a695040d8bcd63a98c06d66fcz, user.email);
    slot(element_77447a9a695040d8bcd63a98c06d66fc10, product.price);
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc11, () => product.discount * 100);
    slot(element_77447a9a695040d8bcd63a98c06d66fc12, product.finalPrice);
    slot(element_77447a9a695040d8bcd63a98c06d66fc13, config.theme);
    slot(element_77447a9a695040d8bcd63a98c06d66fc14, config.debug);
    return root_77447a9a695040d8bcd63a98c06d66fcv;
  })();
  user.name = "Jane";
  user.age++;
  product.price = 150;
  product.discount = 0.2;
  config.theme = "dark";
  config.debug = true;
  return { config, product, user, view };
}
function testComplexNested() {
  let state = reactive$1({
    counts: reactive$1([0, 0, 0]),
    currentIndex: 0,
    increment: () => {
      state.counts[state.currentIndex]++;
    },
    items: reactive$1([
      { id: 1, name: "Item 1", selected: false },
      { id: 2, name: "Item 2", selected: true },
      { id: 3, name: "Item 3", selected: false }
    ]),
    selectedCount: () => state.items.filter((i) => i.selected).length,
    total: () => state.counts.reduce((a, b) => a + b, 0)
  });
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc1g = template_77447a9a695040d8bcd63a98c06d66fc1h(), element_77447a9a695040d8bcd63a98c06d66fc1i = root_77447a9a695040d8bcd63a98c06d66fc1g.firstChild.firstElementChild.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc1j = root_77447a9a695040d8bcd63a98c06d66fc1g.firstChild.firstElementChild.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc1k = root_77447a9a695040d8bcd63a98c06d66fc1g.firstChild.firstElementChild.nextElementSibling.firstChild, element_77447a9a695040d8bcd63a98c06d66fc1l = root_77447a9a695040d8bcd63a98c06d66fc1g.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild;
    slot(element_77447a9a695040d8bcd63a98c06d66fc1i, state.total);
    slot(element_77447a9a695040d8bcd63a98c06d66fc1j, state.selectedCount);
    element_77447a9a695040d8bcd63a98c06d66fc1k.parentNode.insertBefore(new ArraySlot(state.items, (item) => {
      let root_77447a9a695040d8bcd63a98c06d66fc15 = template_77447a9a695040d8bcd63a98c06d66fc16(), element_77447a9a695040d8bcd63a98c06d66fc17 = root_77447a9a695040d8bcd63a98c06d66fc15.firstChild, element_77447a9a695040d8bcd63a98c06d66fc18 = element_77447a9a695040d8bcd63a98c06d66fc17.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc19 = element_77447a9a695040d8bcd63a98c06d66fc17.firstElementChild.nextElementSibling, attributes_77447a9a695040d8bcd63a98c06d66fc1a = { "class": "item" };
      setList(element_77447a9a695040d8bcd63a98c06d66fc17, "class", () => item.selected ? "selected" : "", attributes_77447a9a695040d8bcd63a98c06d66fc1a);
      slot(element_77447a9a695040d8bcd63a98c06d66fc18, item.name);
      setProperty(element_77447a9a695040d8bcd63a98c06d66fc19, "checked", () => item.selected);
      return root_77447a9a695040d8bcd63a98c06d66fc15;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fc1k);
    element_77447a9a695040d8bcd63a98c06d66fc1l.parentNode.insertBefore(new ArraySlot(state.counts, (count, i) => {
      let root_77447a9a695040d8bcd63a98c06d66fc1b = template_77447a9a695040d8bcd63a98c06d66fc1c(), element_77447a9a695040d8bcd63a98c06d66fc1d = root_77447a9a695040d8bcd63a98c06d66fc1b.firstChild, element_77447a9a695040d8bcd63a98c06d66fc1e = element_77447a9a695040d8bcd63a98c06d66fc1d.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc1f = element_77447a9a695040d8bcd63a98c06d66fc1e.nextSibling.nextSibling;
      delegate(element_77447a9a695040d8bcd63a98c06d66fc1d, "click", () => {
        state.currentIndex = i;
        state.increment();
      });
      slot(element_77447a9a695040d8bcd63a98c06d66fc1e, i);
      slot(element_77447a9a695040d8bcd63a98c06d66fc1f, count);
      return root_77447a9a695040d8bcd63a98c06d66fc1b;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fc1l);
    return root_77447a9a695040d8bcd63a98c06d66fc1g;
  })();
  state.items[0].selected = true;
  state.counts[0] = 5;
  state.currentIndex = 1;
  return { state, view };
}
function testConditionalRendering() {
  let showDetails = reactive$1(false), status = reactive$1("loading"), user = reactive$1(null);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc1v = template_77447a9a695040d8bcd63a98c06d66fc1w(), element_77447a9a695040d8bcd63a98c06d66fc1x = root_77447a9a695040d8bcd63a98c06d66fc1v.firstChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc1y = element_77447a9a695040d8bcd63a98c06d66fc1x.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc1z = element_77447a9a695040d8bcd63a98c06d66fc1y.nextSibling;
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc1x, () => showDetails ? template_77447a9a695040d8bcd63a98c06d66fc1m() : template_77447a9a695040d8bcd63a98c06d66fc1n());
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc1y, () => {
      if (status === "loading") {
        return template_77447a9a695040d8bcd63a98c06d66fc1o();
      }
      if (status === "error") {
        return template_77447a9a695040d8bcd63a98c06d66fc1p();
      }
      return template_77447a9a695040d8bcd63a98c06d66fc1q();
    });
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc1z, () => user ? (() => {
      let root_77447a9a695040d8bcd63a98c06d66fc1r = template_77447a9a695040d8bcd63a98c06d66fc1s(), element_77447a9a695040d8bcd63a98c06d66fc1t = root_77447a9a695040d8bcd63a98c06d66fc1r.firstChild.firstChild.nextSibling;
      slot(element_77447a9a695040d8bcd63a98c06d66fc1t, user.name);
      return root_77447a9a695040d8bcd63a98c06d66fc1r;
    })() : template_77447a9a695040d8bcd63a98c06d66fc1u());
    return root_77447a9a695040d8bcd63a98c06d66fc1v;
  })();
  showDetails = true;
  status = "success";
  user = { name: "Alice" };
  return { showDetails, status, user, view };
}
function testEventHandlers() {
  let clicks = reactive$1(0), inputValue = reactive$1(""), items = reactive$1([]);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc24 = template_77447a9a695040d8bcd63a98c06d66fc25(), element_77447a9a695040d8bcd63a98c06d66fc26 = root_77447a9a695040d8bcd63a98c06d66fc24.firstChild.firstElementChild, element_77447a9a695040d8bcd63a98c06d66fc27 = element_77447a9a695040d8bcd63a98c06d66fc26.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc28 = element_77447a9a695040d8bcd63a98c06d66fc26.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc29 = element_77447a9a695040d8bcd63a98c06d66fc28.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc2a = element_77447a9a695040d8bcd63a98c06d66fc29.nextElementSibling.firstChild;
    delegate(element_77447a9a695040d8bcd63a98c06d66fc26, "click", () => clicks++);
    slot(element_77447a9a695040d8bcd63a98c06d66fc27, clicks);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc28, "value", inputValue);
    delegate(element_77447a9a695040d8bcd63a98c06d66fc28, "input", (e) => {
      inputValue = e.target.value;
    });
    delegate(element_77447a9a695040d8bcd63a98c06d66fc29, "click", () => {
      if (inputValue) {
        items.push(inputValue);
        inputValue = "";
      }
    });
    element_77447a9a695040d8bcd63a98c06d66fc2a.parentNode.insertBefore(new ArraySlot(items, (item, index) => {
      let root_77447a9a695040d8bcd63a98c06d66fc20 = template_77447a9a695040d8bcd63a98c06d66fc21(), element_77447a9a695040d8bcd63a98c06d66fc22 = root_77447a9a695040d8bcd63a98c06d66fc20.firstChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc23 = root_77447a9a695040d8bcd63a98c06d66fc20.firstChild.firstElementChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fc22, item);
      delegate(element_77447a9a695040d8bcd63a98c06d66fc23, "click", () => items.splice(index, 1));
      return root_77447a9a695040d8bcd63a98c06d66fc20;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fc2a);
    return root_77447a9a695040d8bcd63a98c06d66fc24;
  })();
  clicks++;
  clicks++;
  inputValue = "Test item";
  items.push("First");
  items.push("Second");
  return { clicks, inputValue, items, view };
}
function testAttributeBindings() {
  let isDisabled = reactive$1(false), classes = reactive$1("primary"), styles = reactive$1("color: red"), href = reactive$1("https://example.com"), dataValue = reactive$1(42);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc2b = template_77447a9a695040d8bcd63a98c06d66fc2c(), element_77447a9a695040d8bcd63a98c06d66fc2d = root_77447a9a695040d8bcd63a98c06d66fc2b.firstChild.firstElementChild, element_77447a9a695040d8bcd63a98c06d66fc2e = element_77447a9a695040d8bcd63a98c06d66fc2d.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc2f = element_77447a9a695040d8bcd63a98c06d66fc2e.nextElementSibling, attributes_77447a9a695040d8bcd63a98c06d66fc2g = {}, attributes_77447a9a695040d8bcd63a98c06d66fc2h = {};
    setList(element_77447a9a695040d8bcd63a98c06d66fc2d, "class", classes, attributes_77447a9a695040d8bcd63a98c06d66fc2g);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc2d, "disabled", isDisabled);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc2d, "data-value", dataValue);
    setList(element_77447a9a695040d8bcd63a98c06d66fc2d, "style", styles, attributes_77447a9a695040d8bcd63a98c06d66fc2g);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc2e, "href", href);
    setList(element_77447a9a695040d8bcd63a98c06d66fc2f, "class", () => isDisabled ? "disabled-input" : "active-input", attributes_77447a9a695040d8bcd63a98c06d66fc2h);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc2f, "placeholder", () => `Value: ${dataValue}`);
    return root_77447a9a695040d8bcd63a98c06d66fc2b;
  })();
  isDisabled = true;
  classes = "secondary active";
  styles = "color: blue; font-weight: bold";
  href = "https://updated.com";
  dataValue = 100;
  return { classes, dataValue, href, isDisabled, styles, view };
}
function testMixedReactiveTypes() {
  let primitive = reactive$1(0), computed2 = reactive$1(() => primitive * 2), array = reactive$1([1, 2, 3]), object = reactive$1({
    count: 0,
    double: () => object.count * 2,
    name: "Test"
  });
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc2l = template_77447a9a695040d8bcd63a98c06d66fc2m(), element_77447a9a695040d8bcd63a98c06d66fc2n = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2o = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2p = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2q = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2r = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2s = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2t = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc2u = root_77447a9a695040d8bcd63a98c06d66fc2l.firstChild.firstElementChild.nextElementSibling.nextElementSibling.nextElementSibling.firstElementChild;
    slot(element_77447a9a695040d8bcd63a98c06d66fc2n, primitive);
    slot(element_77447a9a695040d8bcd63a98c06d66fc2o, computed2);
    slot(element_77447a9a695040d8bcd63a98c06d66fc2p, object.name);
    slot(element_77447a9a695040d8bcd63a98c06d66fc2q, object.count);
    slot(element_77447a9a695040d8bcd63a98c06d66fc2r, object.double);
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc2s, () => array.length);
    element_77447a9a695040d8bcd63a98c06d66fc2t.parentNode.insertBefore(new ArraySlot(array, (n) => {
      let root_77447a9a695040d8bcd63a98c06d66fc2i = template_77447a9a695040d8bcd63a98c06d66fc2j(), element_77447a9a695040d8bcd63a98c06d66fc2k = root_77447a9a695040d8bcd63a98c06d66fc2i.firstChild.firstChild;
      slot(element_77447a9a695040d8bcd63a98c06d66fc2k, n);
      return root_77447a9a695040d8bcd63a98c06d66fc2i;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fc2t);
    delegate(element_77447a9a695040d8bcd63a98c06d66fc2u, "click", () => {
      primitive++;
      object.count++;
      array.push(array.length + 1);
    });
    return root_77447a9a695040d8bcd63a98c06d66fc2l;
  })();
  primitive = 5;
  object.name = "Updated";
  object.count = 10;
  array.push(4, 5, 6);
  return { array, computed: computed2, object, primitive, view };
}
function testTypedReactive() {
  let state = reactive$1({
    addTodo: (text2) => {
      state.todos.push({
        completed: false,
        id: state.nextId++,
        text: text2
      });
    },
    completedCount: () => state.todos.filter((t) => t.completed).length,
    filter: "all",
    filteredTodos: () => {
      if (state.filter === "active") {
        return state.todos.filter((t) => !t.completed);
      }
      if (state.filter === "completed") {
        return state.todos.filter((t) => t.completed);
      }
      return state.todos;
    },
    nextId: 1,
    todos: [],
    toggleTodo: (id) => {
      let todo = state.todos.find((t) => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    }
  });
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc31 = template_77447a9a695040d8bcd63a98c06d66fc32(), element_77447a9a695040d8bcd63a98c06d66fc33 = root_77447a9a695040d8bcd63a98c06d66fc31.firstChild.firstElementChild.firstElementChild.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc34 = root_77447a9a695040d8bcd63a98c06d66fc31.firstChild.firstElementChild.firstElementChild.nextElementSibling.firstElementChild, element_77447a9a695040d8bcd63a98c06d66fc35 = element_77447a9a695040d8bcd63a98c06d66fc34.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc36 = element_77447a9a695040d8bcd63a98c06d66fc35.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc37 = root_77447a9a695040d8bcd63a98c06d66fc31.firstChild.firstElementChild.nextElementSibling.firstChild, attributes_77447a9a695040d8bcd63a98c06d66fc38 = {}, attributes_77447a9a695040d8bcd63a98c06d66fc39 = {}, attributes_77447a9a695040d8bcd63a98c06d66fc3a = {};
    slot(element_77447a9a695040d8bcd63a98c06d66fc33, state.completedCount);
    setList(element_77447a9a695040d8bcd63a98c06d66fc34, "class", () => state.filter === "all" ? "active" : "", attributes_77447a9a695040d8bcd63a98c06d66fc38);
    delegate(element_77447a9a695040d8bcd63a98c06d66fc34, "click", () => {
      state.filter = "all";
    });
    setList(element_77447a9a695040d8bcd63a98c06d66fc35, "class", () => state.filter === "active" ? "active" : "", attributes_77447a9a695040d8bcd63a98c06d66fc39);
    delegate(element_77447a9a695040d8bcd63a98c06d66fc35, "click", () => {
      state.filter = "active";
    });
    setList(element_77447a9a695040d8bcd63a98c06d66fc36, "class", () => state.filter === "completed" ? "active" : "", attributes_77447a9a695040d8bcd63a98c06d66fc3a);
    delegate(element_77447a9a695040d8bcd63a98c06d66fc36, "click", () => {
      state.filter = "completed";
    });
    new EffectSlot(element_77447a9a695040d8bcd63a98c06d66fc37, () => state.filteredTodos().map((todo) => {
      let root_77447a9a695040d8bcd63a98c06d66fc2v = template_77447a9a695040d8bcd63a98c06d66fc2w(), element_77447a9a695040d8bcd63a98c06d66fc2x = root_77447a9a695040d8bcd63a98c06d66fc2v.firstChild, element_77447a9a695040d8bcd63a98c06d66fc2y = element_77447a9a695040d8bcd63a98c06d66fc2x.firstElementChild, element_77447a9a695040d8bcd63a98c06d66fc2z = element_77447a9a695040d8bcd63a98c06d66fc2y.nextElementSibling.firstChild, attributes_77447a9a695040d8bcd63a98c06d66fc30 = { "class": "todo" };
      setList(element_77447a9a695040d8bcd63a98c06d66fc2x, "class", todo.completed ? "completed" : "", attributes_77447a9a695040d8bcd63a98c06d66fc30);
      setProperty(element_77447a9a695040d8bcd63a98c06d66fc2y, "checked", todo.completed);
      delegate(element_77447a9a695040d8bcd63a98c06d66fc2y, "change", () => state.toggleTodo(todo.id));
      slot(element_77447a9a695040d8bcd63a98c06d66fc2z, todo.text);
      return root_77447a9a695040d8bcd63a98c06d66fc2v;
    }));
    return root_77447a9a695040d8bcd63a98c06d66fc31;
  })();
  state.addTodo("Learn TypeScript");
  state.addTodo("Build app");
  state.addTodo("Write tests");
  state.toggleTodo(1);
  return { state, view };
}
function testDeeplyNested() {
  let level1 = reactive$1({
    items: reactive$1([
      {
        children: reactive$1([
          { name: "Leaf 1", value: reactive$1(1) },
          { name: "Leaf 2", value: reactive$1(2) }
        ]),
        name: "Child 1"
      },
      {
        children: reactive$1([
          { name: "Leaf 3", value: reactive$1(3) }
        ]),
        name: "Child 2"
      }
    ]),
    name: "Root"
  });
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc3k = template_77447a9a695040d8bcd63a98c06d66fc3l(), element_77447a9a695040d8bcd63a98c06d66fc3m = root_77447a9a695040d8bcd63a98c06d66fc3k.firstChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc3n = root_77447a9a695040d8bcd63a98c06d66fc3k.firstChild.firstChild.nextSibling;
    slot(element_77447a9a695040d8bcd63a98c06d66fc3m, level1.name);
    element_77447a9a695040d8bcd63a98c06d66fc3n.parentNode.insertBefore(new ArraySlot(level1.items, (item) => {
      let root_77447a9a695040d8bcd63a98c06d66fc3g = template_77447a9a695040d8bcd63a98c06d66fc3h(), element_77447a9a695040d8bcd63a98c06d66fc3i = root_77447a9a695040d8bcd63a98c06d66fc3g.firstChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc3j = root_77447a9a695040d8bcd63a98c06d66fc3g.firstChild.firstChild.nextSibling;
      slot(element_77447a9a695040d8bcd63a98c06d66fc3i, item.name);
      element_77447a9a695040d8bcd63a98c06d66fc3j.parentNode.insertBefore(new ArraySlot(item.children, (child) => {
        let root_77447a9a695040d8bcd63a98c06d66fc3b = template_77447a9a695040d8bcd63a98c06d66fc3c(), element_77447a9a695040d8bcd63a98c06d66fc3d = root_77447a9a695040d8bcd63a98c06d66fc3b.firstChild.firstElementChild.firstChild, element_77447a9a695040d8bcd63a98c06d66fc3e = element_77447a9a695040d8bcd63a98c06d66fc3d.nextSibling.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc3f = root_77447a9a695040d8bcd63a98c06d66fc3b.firstChild.firstElementChild.nextElementSibling;
        slot(element_77447a9a695040d8bcd63a98c06d66fc3d, child.name);
        slot(element_77447a9a695040d8bcd63a98c06d66fc3e, child.value);
        delegate(element_77447a9a695040d8bcd63a98c06d66fc3f, "click", () => child.value++);
        return root_77447a9a695040d8bcd63a98c06d66fc3b;
      }).fragment, element_77447a9a695040d8bcd63a98c06d66fc3j);
      return root_77447a9a695040d8bcd63a98c06d66fc3g;
    }).fragment, element_77447a9a695040d8bcd63a98c06d66fc3n);
    return root_77447a9a695040d8bcd63a98c06d66fc3k;
  })();
  level1.items[0].children[0].value++;
  level1.items.push({
    children: reactive$1([{ name: "Leaf 4", value: reactive$1(4) }]),
    name: "Child 3"
  });
  return { level1, view };
}
function testStaticVsDynamic() {
  let dynamicText = reactive$1("Dynamic"), dynamicNum = reactive$1(42), dynamicBool = reactive$1(true);
  let view = (() => {
    let root_77447a9a695040d8bcd63a98c06d66fc3o = template_77447a9a695040d8bcd63a98c06d66fc3p(), element_77447a9a695040d8bcd63a98c06d66fc3q = root_77447a9a695040d8bcd63a98c06d66fc3o.firstChild.firstElementChild.nextElementSibling.firstChild, element_77447a9a695040d8bcd63a98c06d66fc3r = root_77447a9a695040d8bcd63a98c06d66fc3o.firstChild.firstElementChild.nextElementSibling.nextElementSibling.nextElementSibling.firstChild.nextSibling, element_77447a9a695040d8bcd63a98c06d66fc3s = root_77447a9a695040d8bcd63a98c06d66fc3o.firstChild.firstElementChild.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc3t = element_77447a9a695040d8bcd63a98c06d66fc3s.nextElementSibling.nextElementSibling, element_77447a9a695040d8bcd63a98c06d66fc3u = element_77447a9a695040d8bcd63a98c06d66fc3t.nextElementSibling.nextElementSibling, attributes_77447a9a695040d8bcd63a98c06d66fc3v = { "class": "" };
    slot(element_77447a9a695040d8bcd63a98c06d66fc3q, dynamicText);
    slot(element_77447a9a695040d8bcd63a98c06d66fc3r, dynamicNum);
    setList(element_77447a9a695040d8bcd63a98c06d66fc3s, "class", () => dynamicBool ? "dynamic-true" : "dynamic-false", attributes_77447a9a695040d8bcd63a98c06d66fc3v);
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc3t, "href", () => dynamicBool ? "https://true.com" : "https://false.com");
    setProperty(element_77447a9a695040d8bcd63a98c06d66fc3u, "value", dynamicText);
    return root_77447a9a695040d8bcd63a98c06d66fc3o;
  })();
  dynamicText = "Updated";
  dynamicNum = 100;
  dynamicBool = false;
  return { dynamicBool, dynamicNum, dynamicText, view };
}
const tests = {
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
const results = Object.entries(tests).map(([name, fn]) => {
  try {
    let result = fn();
    console.log(`✓ ${name} passed`);
    return { name, result, status: "passed" };
  } catch (error) {
    console.error(`✗ ${name} failed:`, error);
    return { error, name, status: "failed" };
  }
});
console.log(`
Tests completed: ${results.filter((r) => r.status === "passed").length}/${results.length} passed`);
export {
  results,
  tests
};
//# sourceMappingURL=test.js.map
