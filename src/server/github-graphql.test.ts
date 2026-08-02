import { describe, expect, it } from "vitest";

import { resolveCommitAuthor } from "~/server/github-graphql";

describe("resolveCommitAuthor", () => {
    it("resolves a noreply email to the encoded GitHub account", () => {
        const resolved = resolveCommitAuthor({
            name: "Aiden Park",
            email: "275402320+vip892766gma@users.noreply.github.com",
            avatarUrl: "https://camo.githubusercontent.com/placeholder",
            user: null,
        });

        expect(resolved.user).toEqual({
            __typename: "User",
            login: "vip892766gma",
            avatarUrl: "https://avatars.githubusercontent.com/u/275402320?v=4",
            url: "https://github.com/vip892766gma",
        });
        // Avatar points at the account, not the GitActor gravatar fallback.
        expect(resolved.avatarUrl).toBe(
            "https://avatars.githubusercontent.com/u/275402320?v=4",
        );
    });

    it("leaves an already-resolved author untouched", () => {
        const author = {
            name: "Someone",
            email: "someone@example.com",
            avatarUrl: "https://example.com/avatar.png",
            user: {
                __typename: "User" as const,
                login: "someone",
                avatarUrl: "https://example.com/avatar.png",
                url: "https://github.com/someone",
            },
        };

        expect(resolveCommitAuthor(author)).toBe(author);
    });

    it("keeps authors with a non-noreply email unresolved", () => {
        const resolved = resolveCommitAuthor({
            name: "Jane",
            email: "jane@example.com",
            avatarUrl: null,
            user: null,
        });

        expect(resolved.user).toBeNull();
        expect(resolved.avatarUrl).toBeNull();
    });

    it("keeps authors without an email unresolved", () => {
        const resolved = resolveCommitAuthor({
            name: "No Email",
            email: null,
            avatarUrl: null,
            user: null,
        });

        expect(resolved.user).toBeNull();
    });
});
