import { PACKAGE_NAME } from '~/constants';
import { Element } from '~/types';


type Target = {
    commit(): void;
    resized(index: number, height: number): void;
    viewport(height: number): void;
};


const INDEX = Symbol.for(`${PACKAGE_NAME}/virtual.index`);

const SIZE = Symbol.for(`${PACKAGE_NAME}/virtual.size`);

const SLOT = Symbol.for(`${PACKAGE_NAME}/virtual.slot`);


let observer: ResizeObserver | null = null;


function instance(): ResizeObserver {
    if (!observer) {
        observer = new ResizeObserver((entries) => {
            let touched = new Set<Target>();

            for (let i = 0, n = entries.length; i < n; i++) {
                let entry = entries[i],
                    target = entry.target as any,
                    slot = target[SLOT] as Target | undefined,
                    viewport = target[INDEX] === undefined,
                    box = viewport
                        ? (entry.contentBoxSize && entry.contentBoxSize.length ? entry.contentBoxSize[0].blockSize : entry.contentRect.height)
                        : (entry.borderBoxSize && entry.borderBoxSize.length ? entry.borderBoxSize[0].blockSize : entry.contentRect.height),
                    size = Math.round(box * 4) / 4;

                target[SIZE] = size;

                if (!slot) {
                    continue;
                }

                if (viewport) {
                    slot.viewport(size);
                }
                else {
                    slot.resized(target[INDEX] as number, size);
                }

                touched.add(slot);
            }

            for (let slot of touched) {
                slot.commit();
            }
        });
    }

    return observer;
}

const observe = (element: Element, slot: Target, index?: number): void => {
    let target = element as any;

    target[SLOT] = slot;
    target[INDEX] = index;

    instance().observe(element as unknown as Element);
};

const unobserve = (element: Element): void => {
    observer?.unobserve(element as unknown as Element);
};


export { INDEX, observe, SIZE, SLOT, unobserve };
