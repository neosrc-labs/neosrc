import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView or scrollTo
Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};
