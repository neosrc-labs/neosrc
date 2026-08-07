// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeTitle } from "~/components/markdown/code-title";

function renderInLink(message: string, onParentClick: () => void) {
    render(
        <a href="/commit" onClick={onParentClick}>
            <CodeTitle provider="gh" owner="acme" repo="widgets">
                {message}
            </CodeTitle>
        </a>,
    );
}

describe("CodeTitle", () => {
    it("opens the issue in a new tab and does not follow the wrapping link", async () => {
        const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
        const parentClick = vi.fn();
        const user = userEvent.setup();

        renderInLink("fix #123 crash", parentClick);

        await user.click(screen.getByText("#123"));

        expect(openSpy).toHaveBeenCalledWith(
            "https://github.com/acme/widgets/issues/123",
            "_blank",
            "noopener,noreferrer",
        );
        expect(parentClick).not.toHaveBeenCalled();

        openSpy.mockRestore();
    });

    it("cancels the wrapping link's default navigation when clicking the issue", () => {
        const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
        const parentClick = vi.fn();

        render(
            <a href="/commit" onClick={parentClick}>
                <CodeTitle provider="gh" owner="acme" repo="widgets">
                    fix #123 crash
                </CodeTitle>
            </a>,
        );

        const span = screen.getByText("#123");
        const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
        });
        span.dispatchEvent(clickEvent);

        expect(clickEvent.defaultPrevented).toBe(true);
        expect(parentClick).not.toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledWith(
            "https://github.com/acme/widgets/issues/123",
            "_blank",
            "noopener,noreferrer",
        );

        openSpy.mockRestore();
    });

    it("still lets the wrapping link navigate when clicking the rest of the text", async () => {
        const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
        const parentClick = vi.fn();
        const user = userEvent.setup();

        renderInLink("fix #123 crash", parentClick);

        await user.click(screen.getByText(/^fix /));

        expect(parentClick).toHaveBeenCalledTimes(1);
        expect(openSpy).not.toHaveBeenCalled();

        openSpy.mockRestore();
    });

    it("does not apply the wrapping link's hover styles while hovering the issue", async () => {
        const user = userEvent.setup();

        render(
            <a href="/commit" className="hover:text-blue-600 hover:underline">
                <CodeTitle provider="gh" owner="acme" repo="widgets">
                    fix #123 crash
                </CodeTitle>
            </a>,
        );

        const link = screen.getByRole("link");
        const span = screen.getByText("#123");

        await user.hover(span);
        expect(link.style.color).toBe("var(--color-text-primary)");
        expect(link.style.textDecorationLine).toBe("none");

        await user.unhover(span);
        expect(link.style.color).toBe("");
        expect(link.style.textDecorationLine).toBe("");
    });
});
