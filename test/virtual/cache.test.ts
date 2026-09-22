import { describe, expect, it } from 'vitest';
import { create, index, insert, offset, remove, reorder, set, size } from '../../src/virtual/cache';


describe('virtual/cache', () => {
    describe('create', () => {
        it('starts with no valid offsets, no measurements, and the given estimate', () => {
            let cache = create(4, 10);

            expect(cache.computed).toBe(-1);
            expect(cache.estimate).toBe(10);
            expect(cache.length).toBe(4);
            expect(cache.measured).toBe(0);
            expect(cache.total).toBe(0);
            expect(cache.offsets[0]).toBe(0);
            expect(cache.sizes.length).toBe(4);
        });

        it('supports an empty list', () => {
            let cache = create(0, 10);

            expect(cache.length).toBe(0);
            expect(cache.sizes.length).toBe(0);
            expect(offset(cache, 0)).toBe(0);
        });
    });

    describe('size', () => {
        it('falls back to the estimate for unmeasured rows', () => {
            let cache = create(2, 12);

            expect(size(cache, 0)).toBe(12);
            expect(size(cache, 1)).toBe(12);

            set(cache, 0, 30);

            expect(size(cache, 0)).toBe(30);
            expect(size(cache, 1)).toBe(30);
        });
    });

    describe('offset', () => {
        it('extends the prefix sum on demand and reports the total at offset(length)', () => {
            let cache = create(4, 10);

            set(cache, 0, 10);
            set(cache, 1, 20);

            expect(cache.estimate).toBe(15);
            expect(offset(cache, 0)).toBe(0);
            expect(offset(cache, 1)).toBe(10);
            expect(offset(cache, 2)).toBe(30);
            expect(offset(cache, 3)).toBe(45);
            expect(offset(cache, 4)).toBe(60);
            expect(cache.computed).toBe(4);
        });

        it('recomputes from the last valid offset after invalidation', () => {
            let cache = create(3, 10);

            expect(offset(cache, 3)).toBe(30);
            expect(cache.computed).toBe(3);

            set(cache, 1, 100);

            expect(cache.computed).toBe(-1);
            expect(offset(cache, 3)).toBe(300);
        });

        it('reuses valid offsets below the change', () => {
            let cache = create(3, 10);

            offset(cache, 3);
            set(cache, 0, 25);

            expect(cache.computed).toBe(-1);
            expect(offset(cache, 3)).toBe(75);
        });
    });

    describe('set', () => {
        it('returns the delta against the previously effective size', () => {
            let cache = create(3, 10);

            expect(set(cache, 0, 25)).toBe(15);
            expect(set(cache, 0, 30)).toBe(5);
            expect(set(cache, 1, 20)).toBe(-10);
        });

        it('uses the mean of measured sizes while calibrating', () => {
            let cache = create(4, 100);

            expect(set(cache, 0, 50)).toBe(-50);
            expect(cache.estimate).toBe(50);
            expect(cache.computed).toBe(-1);

            set(cache, 1, 150);

            expect(cache.estimate).toBe(100);

            set(cache, 2, 100);

            expect(cache.estimate).toBe(100);
        });

        it('lowers computed to the row before the changed index once calibrated', () => {
            let cache = create(40, 10);

            for (let i = 0; i < 32; i++) {
                set(cache, i, 10);
            }

            offset(cache, 39);

            expect(cache.computed).toBe(39);

            set(cache, 20, 10);

            expect(cache.estimate).toBe(10);
            expect(cache.computed).toBe(19);
        });

        it('only recomputes the estimate after calibration when the mean drifts by more than 20 percent', () => {
            let cache = create(40, 100);

            for (let i = 0; i < 32; i++) {
                set(cache, i, 100);
            }

            offset(cache, 39);

            expect(cache.estimate).toBe(100);

            set(cache, 20, 110);

            expect(cache.estimate).toBe(100);
            expect(cache.computed).toBe(19);

            set(cache, 20, 1000);

            expect(cache.estimate).toBeCloseTo(4100 / 32);
            expect(cache.computed).toBe(-1);
        });
    });

    describe('index', () => {
        it('finds the last index at or before the target from a hint below it', () => {
            let cache = create(10, 10);

            expect(index(cache, 25, 0)).toBe(2);
            expect(index(cache, 0, 0)).toBe(0);
            expect(index(cache, 55, 4)).toBe(5);
            expect(index(cache, 95, 0)).toBe(9);
            expect(index(cache, 1000, 0)).toBe(9);
        });

        it('finds the last index at or before the target from a hint above it', () => {
            let cache = create(10, 10);

            expect(index(cache, 25, 9)).toBe(2);
            expect(index(cache, 55, 9)).toBe(5);
            expect(index(cache, 95, 9)).toBe(9);
        });

        it('recovers when offsets move under the hint', () => {
            let cache = create(10, 10);

            expect(index(cache, 45, 0)).toBe(4);

            reorder(cache, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);

            expect(index(cache, 45, 4)).toBe(0);
            expect(index(cache, 320, 0)).toBe(6);
        });

        it('clamps below zero, above the total, and an out-of-range hint', () => {
            let cache = create(3, 10);

            expect(index(cache, -5, 2)).toBe(0);
            expect(index(cache, 1000, 0)).toBe(2);
            expect(index(cache, 1000, 2)).toBe(2);
            expect(index(cache, 15, -4)).toBe(1);
            expect(index(cache, 15, 40)).toBe(1);
        });

        it('returns -1 for an empty cache', () => {
            expect(index(create(0, 10), 0, 0)).toBe(-1);
        });
    });

    describe('insert', () => {
        it('shifts entries, marks inserted rows unmeasured, and grows capacity by doubling', () => {
            let cache = create(2, 10);

            set(cache, 0, 10);
            set(cache, 1, 20);

            expect(cache.sizes.length).toBe(2);

            insert(cache, 1, 1);

            expect(cache.length).toBe(3);
            expect(cache.sizes.length).toBe(4);
            expect(cache.measured).toBe(2);
            expect(cache.total).toBe(30);
            expect(cache.sizes[0]).toBe(10);
            expect(cache.sizes[1]).toBe(0);
            expect(cache.sizes[2]).toBe(20);
            expect(offset(cache, 3)).toBe(45);

            insert(cache, 0, 3);

            expect(cache.length).toBe(6);
            expect(cache.sizes.length).toBe(8);
            expect(cache.sizes[3]).toBe(10);
            expect(cache.sizes[5]).toBe(20);
        });

        it('invalidates computed up to the insertion point', () => {
            let cache = create(4, 10);

            offset(cache, 4);

            expect(cache.computed).toBe(4);

            insert(cache, 2, 1);

            expect(cache.computed).toBe(1);
        });
    });

    describe('remove', () => {
        it('drops removed measurements, shifts entries, and invalidates computed', () => {
            let cache = create(3, 10);

            set(cache, 0, 10);
            set(cache, 1, 20);
            set(cache, 2, 30);

            offset(cache, 3);

            expect(cache.computed).toBe(3);

            remove(cache, 1, 1);

            expect(cache.length).toBe(2);
            expect(cache.measured).toBe(2);
            expect(cache.total).toBe(40);
            expect(cache.computed).toBe(0);
            expect(cache.sizes[0]).toBe(10);
            expect(cache.sizes[1]).toBe(30);
            expect(offset(cache, 2)).toBe(40);
        });

        it('clamps an overflowing removal to the end', () => {
            let cache = create(3, 10);

            set(cache, 2, 30);

            remove(cache, 1, 10);

            expect(cache.length).toBe(1);
            expect(cache.measured).toBe(0);
            expect(cache.total).toBe(0);
            expect(cache.sizes[0]).toBe(0);
        });
    });

    describe('reorder', () => {
        it('copies sizes, recounts measurements, and resets computed', () => {
            let cache = create(3, 10);

            set(cache, 0, 10);
            set(cache, 1, 20);
            set(cache, 2, 30);

            offset(cache, 3);

            expect(cache.computed).toBe(3);

            reorder(cache, [30, 0, 10]);

            expect(cache.sizes[0]).toBe(30);
            expect(cache.sizes[1]).toBe(0);
            expect(cache.sizes[2]).toBe(10);
            expect(cache.measured).toBe(2);
            expect(cache.total).toBe(40);
            expect(cache.computed).toBe(-1);
        });

        it('accepts a typed array of sizes', () => {
            let cache = create(2, 10);

            reorder(cache, new Float32Array([15, 25]));

            expect(cache.sizes[0]).toBe(15);
            expect(cache.sizes[1]).toBe(25);
            expect(cache.measured).toBe(2);
            expect(cache.total).toBe(40);
        });
    });
});
