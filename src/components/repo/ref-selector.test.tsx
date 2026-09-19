// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/trpc/react", () => ({
    api: {
        repos: {
            getBranches: {
                useQuery: () => ({ data: [{ name: "release" }] }),
            },
            getTags: {
                useQuery: () => ({ data: [{ name: "release" }] }),
            },
        },
    },
}));

import { RefSelector } from "./ref-selector";

describe("RefSelector", () => {
    it("selects a matching name only in its reference-kind tab", () => {
        render(
            <RefSelector
                owner="acme"
                repo="app"
                provider="gh"
                reference={{ kind: "tag", value: "release" }}
                onSelect={vi.fn()}
            />,
        );

        expect(
            screen.queryByRole("button", { name: "release", current: true }),
        ).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Tags" }));

        expect(
            screen.getByRole("button", { name: "release", current: true }),
        ).toBeInTheDocument();
    });
});
