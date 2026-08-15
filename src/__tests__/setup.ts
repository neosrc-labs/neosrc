import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView or scrollTo
// Guard against node environment where these are not defined
if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView = () => {};
}
if (typeof window !== "undefined") {
    window.scrollTo = () => {};
}

// jsdom doesn't implement ResizeObserver, which Radix popper content
// (tooltips, popovers) relies on to measure its trigger when it opens
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom doesn't implement IntersectionObserver, which the changes page uses
// to progressively mount file diffs as they scroll into view
class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver =
        IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
