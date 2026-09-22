type Cache = {
    computed: number;
    estimate: number;
    length: number;
    measured: number;
    offsets: Float64Array;
    sizes: Float32Array;
    total: number;
};


const CALIBRATION = 32;

const DRIFT = 0.2;


function fill(cache: Cache, i: number): void {
    let computed = cache.computed;

    if (i <= computed) {
        return;
    }

    let offsets = cache.offsets,
        start = computed < 0 ? 1 : computed + 1;

    offsets[0] = 0;

    for (let j = start; j <= i; j++) {
        offsets[j] = offsets[j - 1] + size(cache, j - 1);
    }

    cache.computed = i;
}

function grow(cache: Cache, capacity: number): void {
    let sizes = cache.sizes,
        current = sizes.length;

    if (capacity <= current) {
        return;
    }

    let next = current > 0 ? current : 1;

    while (next < capacity) {
        next *= 2;
    }

    let grown = new Float32Array(next);

    grown.set(sizes);

    let offsets = new Float64Array(next + 1);

    offsets.set(cache.offsets);

    cache.offsets = offsets;
    cache.sizes = grown;
}


const create = (length: number, estimate: number): Cache => ({
    computed: -1,
    estimate,
    length,
    measured: 0,
    offsets: new Float64Array(length + 1),
    sizes: new Float32Array(length),
    total: 0
});

// The hint is the previous answer; one offset read decides which side of it the target now
// lies on, so a cache change that moved offsets (estimate drift, reorder) cannot strand the search
const index = (cache: Cache, target: number, hint: number): number => {
    let length = cache.length;

    if (length === 0) {
        return -1;
    }

    if (hint < 0) {
        hint = 0;
    }

    if (hint > length - 1) {
        hint = length - 1;
    }

    let lo = 0,
        hi = hint,
        result: number;

    if (offset(cache, hint) <= target) {
        lo = hint;
        hi = length - 1;
    }

    result = lo - 1;

    while (lo <= hi) {
        let mid = (lo + hi) >> 1;

        if (offset(cache, mid) <= target) {
            lo = mid + 1;
            result = mid;
        }
        else {
            hi = mid - 1;
        }
    }

    if (result < 0) {
        result = 0;
    }

    if (result > length - 1) {
        result = length - 1;
    }

    return result;
};

const insert = (cache: Cache, at: number, count: number): void => {
    if (count <= 0) {
        return;
    }

    let length = cache.length;

    if (at < 0) {
        at = 0;
    }

    if (at > length) {
        at = length;
    }

    let next = length + count;

    grow(cache, next);

    let sizes = cache.sizes,
        offsets = cache.offsets;

    sizes.copyWithin(at + count, at, length);
    sizes.fill(0, at, at + count);

    offsets.copyWithin(at + count, at, length + 1);

    cache.length = next;
    cache.computed = Math.min(cache.computed, at - 1);
};

const offset = (cache: Cache, i: number): number => {
    if (i < 0) {
        return 0;
    }

    fill(cache, i);

    return cache.offsets[i];
};

const remove = (cache: Cache, at: number, count: number): void => {
    let length = cache.length;

    if (count <= 0 || length === 0) {
        return;
    }

    if (at < 0) {
        at = 0;
    }

    if (at >= length) {
        return;
    }

    let end = at + count;

    if (end > length) {
        end = length;
    }

    let sizes = cache.sizes,
        offsets = cache.offsets;

    for (let i = at; i < end; i++) {
        let value = sizes[i];

        if (value !== 0) {
            cache.measured -= 1;
            cache.total -= value;
        }
    }

    sizes.copyWithin(at, end, length);
    sizes.fill(0, length - (end - at), length);

    offsets.copyWithin(at, end, length + 1);

    cache.length = length - (end - at);
    cache.computed = Math.min(cache.computed, at - 1);
};

const reorder = (cache: Cache, values: ArrayLike<number>): void => {
    let length = cache.length,
        sizes = cache.sizes;

    cache.measured = 0;
    cache.total = 0;

    for (let i = 0; i < length; i++) {
        let value = i < values.length ? values[i] : 0;

        sizes[i] = value;

        if (value !== 0) {
            cache.measured += 1;
            cache.total += value;
        }
    }

    cache.computed = -1;
};

const set = (cache: Cache, i: number, value: number): number => {
    if (i < 0 || i >= cache.length) {
        return 0;
    }

    let sizes = cache.sizes,
        previous = sizes[i] || cache.estimate;

    if (sizes[i] !== 0) {
        cache.measured -= 1;
        cache.total -= sizes[i];
    }

    if (value !== 0) {
        cache.measured += 1;
        cache.total += value;
    }

    sizes[i] = value;
    cache.computed = Math.min(cache.computed, i - 1);

    if (cache.measured > 0) {
        let mean = cache.total / cache.measured;

        if (cache.measured < CALIBRATION || Math.abs(mean - cache.estimate) > cache.estimate * DRIFT) {
            cache.estimate = mean;
            cache.computed = -1;
        }
    }

    return value - previous;
};

const size = (cache: Cache, i: number): number => cache.sizes[i] || cache.estimate;


export { create, index, insert, offset, remove, reorder, set, size };
export type { Cache };
