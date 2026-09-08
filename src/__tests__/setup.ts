import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { resetDiffLineSelection } from "~/components/diff/use-diff-line-selection";

// Diff line selection is a module-level store (one selection per page), so it
// outlives a test's render.
afterEach(() => {
    resetDiffLineSelection();
});

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
