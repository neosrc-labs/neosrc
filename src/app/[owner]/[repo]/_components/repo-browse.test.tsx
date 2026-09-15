// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RepoBrowseSkeleton } from "./repo-browse";

describe("RepoBrowseSkeleton clone popover", () => {
    it("clones from codeberg for a cb repo", async () => {
        const user = userEvent.setup();
        render(
            <RepoBrowseSkeleton owner="forgejo" repo="forgejo" provider="cb" />,
        );

        await user.click(screen.getByRole("button", { name: "Code" }));

        const input =
            document.querySelector<HTMLInputElement>("input[readonly]");
        expect(input?.value).toBe("https://codeberg.org/forgejo/forgejo.git");
        expect(screen.getByRole("button", { name: "CLI" })).toBeTruthy();
    });
});
