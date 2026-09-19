import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./markdown-renderer";

vi.mock("~/trpc/react", () => ({
    api: {
        users: {
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
    it("renders the user's avatar beside a user mention", () => {
        render(<MarkdownRenderer content="Thanks @alice" />);

        const mention = screen.getByRole("link", { name: "@alice" });
        expect(mention).toHaveAttribute("href", "https://github.com/alice");
        expect(mention.querySelector("img")).toHaveAttribute(
            "src",
            "https://avatars.githubusercontent.com/u/1?v=4",
        );
        expect(mention.querySelector("img")).toHaveAttribute("alt", "");
    });

    it("does not add an avatar to a regular profile link", () => {
        render(
            <MarkdownRenderer content="[Alice](https://github.com/alice)" />,
        );

        const link = screen.getByRole("link", { name: "Alice" });
        expect(link.querySelector("img")).toBeNull();
    });
});
