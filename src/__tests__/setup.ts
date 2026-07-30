import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView or scrollTo
// Guard against node environment where these are not defined
if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView = () => {};
}
if (typeof window !== "undefined") {
    window.scrollTo = () => {};
}
