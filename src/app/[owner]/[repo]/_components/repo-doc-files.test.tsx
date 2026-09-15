// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const fetchContent = vi.hoisted(() =>
    vi.fn(async ({ path }: { path: string }) => ({
        content: `CONTENT:${path}`,
    })),
);

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => ({
            repos: { getFileContent: { fetch: fetchContent } },
        }),
    },
}));

import { RepoDocFiles } from "./repo-doc-files";

describe("RepoDocFiles", () => {
    it("shows a doc file of the listing it is given", async () => {
        const { rerender } = render(
            <RepoDocFiles
                owner="o"
                repo="r"
                ref="master"
                provider="gh"
                fileNames={[{ name: "LICENSE", path: "LICENSE" }]}
                hideEmpty
            />,
        );

        expect(await screen.findByText("CONTENT:LICENSE")).toBeTruthy();

        // The listing swapped under the card (a new directory, a new ref): the
        // selected file is gone, so the first one it offers has to show.
        rerender(
            <RepoDocFiles
                owner="o"
                repo="r"
                ref="master"
                provider="gh"
                fileNames={[{ name: "COPYING", path: "COPYING" }]}
                hideEmpty
            />,
        );

        expect(await screen.findByText("CONTENT:COPYING")).toBeTruthy();
    });
});
