import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./markdown-renderer";

const mocks = vi.hoisted(() => ({
    currentLogin: "bob",
}));

vi.mock("~/trpc/react", () => ({
    api: {
        users: {
            currentUser: {
                useQuery: () => ({
                    data: { login: mocks.currentLogin },
                }),
            },
            getByUsername: {
                useQuery: () => ({
                    data: {
                        user: {
                            login: "alice",
                            avatar_url:
                                "https://avatars.githubusercontent.com/u/1?v=4",
                        },
                    },
                }),
            },
        },
    },
}));

vi.mock("next/image", () => ({
    default: ({
        alt,
        className,
        src,
    }: {
        alt: string;
        className?: string;
        src: string;
    }) => (
        // biome-ignore lint/performance/noImgElement: test double for next/image
        <img alt={alt} className={className} src={src} />
    ),
}));

describe("markdown mention rendering", () => {
    beforeEach(() => {
        mocks.currentLogin = "bob";
    });

    it("renders the user's avatar beside a user mention", () => {
        render(<MarkdownRenderer content="Thanks @alice" />);

        const mention = screen.getByRole("link", { name: "@alice" });
        expect(mention).toHaveAttribute("href", "https://github.com/alice");
        expect(mention.querySelector("img")).toHaveAttribute(
            "src",
            "https://avatars.githubusercontent.com/u/1?v=4",
        );
        expect(mention.querySelector("img")).toHaveAttribute("alt", "");
        expect(mention).toHaveClass("font-bold", "text-text-primary");
    });

    it("highlights the current user's mention", () => {
        mocks.currentLogin = "Alice";
        render(<MarkdownRenderer content="Thanks @alice" />);

        expect(screen.getByRole("link", { name: "@alice" })).toHaveClass(
            "font-bold",
            "text-mention-current",
        );
    });

    it("does not add an avatar to a regular profile link", () => {
        render(
            <MarkdownRenderer content="[Alice](https://github.com/alice)" />,
        );

        const link = screen.getByRole("link", { name: "Alice" });
        expect(link.querySelector("img")).toBeNull();
    });
});
