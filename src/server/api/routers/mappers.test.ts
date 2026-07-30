import { describe, expect, it } from "vitest";
import {
    mapCbAssignee,
    mapCbAuthor,
    mapCbLabel,
    mapGqlAssignee,
    mapGqlAuthor,
    mapGqlLabel,
    nullSafe,
} from "~/server/api/routers/mappers";

describe("mapGqlAssignee", () => {
    it("maps login and avatarUrl to camelCase fields", () => {
        const result = mapGqlAssignee({
            login: "alice",
            avatarUrl: "https://avatars/1",
        });
        expect(result).toEqual({
            login: "alice",
            avatarUrl: "https://avatars/1",
        });
    });

    it("does not surface extra fields from the source object", () => {
        // Cast: the public type forbids extras, but the mapper must still
        // ignore unknown keys if a wider object is passed at runtime.
        const result = mapGqlAssignee(
            Object.assign(
                { login: "bob", avatarUrl: "https://avatars/2" } as {
                    login: string;
                    avatarUrl: string;
                },
                { databaseId: 42, url: "https://github.com/bob" },
            ),
        );
        expect(result).toEqual({
            login: "bob",
            avatarUrl: "https://avatars/2",
        });
        expect(Object.keys(result).sort()).toEqual(["avatarUrl", "login"]);
    });

    it("preserves empty string values without coercion", () => {
        const result = mapGqlAssignee({ login: "", avatarUrl: "" });
        expect(result).toEqual({ login: "", avatarUrl: "" });
    });
});

describe("mapGqlLabel", () => {
    it("maps all four label fields", () => {
        const result = mapGqlLabel({
            id: "L_1",
            name: "bug",
            color: "ff0000",
            description: "things are on fire",
        });
        expect(result).toEqual({
            id: "L_1",
            name: "bug",
            color: "ff0000",
            description: "things are on fire",
        });
    });

    it("preserves a null description", () => {
        const result = mapGqlLabel({
            id: "L_2",
            name: "enhancement",
            color: "00ff00",
            description: null,
        });
        expect(result.description).toBeNull();
    });
});

describe("mapGqlAuthor", () => {
    it("returns null when input is null", () => {
        expect(mapGqlAuthor(null)).toBeNull();
    });

    it("maps login, avatarUrl, and url", () => {
        const result = mapGqlAuthor({
            login: "carol",
            avatarUrl: "https://avatars/3",
            url: "https://github.com/carol",
        });
        expect(result).toEqual({
            login: "carol",
            avatarUrl: "https://avatars/3",
            url: "https://github.com/carol",
        });
    });
});

describe("mapCbAssignee", () => {
    it("renames the snake_case avatar_url to camelCase avatarUrl", () => {
        const result = mapCbAssignee({
            login: "dave",
            avatar_url: "https://codeberg/avatars/dave",
        });
        expect(result).toEqual({
            login: "dave",
            avatarUrl: "https://codeberg/avatars/dave",
        });
    });

    it("does not include the source's avatar_url key", () => {
        const result = mapCbAssignee({ login: "eve", avatar_url: "x" });
        expect(Object.keys(result).sort()).toEqual(["avatarUrl", "login"]);
    });
});

describe("mapCbLabel", () => {
    it("converts the numeric id to a string", () => {
        const result = mapCbLabel({
            id: 12345,
            name: "docs",
            color: "0000ff",
            description: "doc-only changes",
        });
        expect(result).toEqual({
            id: "12345",
            name: "docs",
            color: "0000ff",
            description: "doc-only changes",
        });
        expect(typeof result.id).toBe("string");
    });

    it("preserves a null description", () => {
        const result = mapCbLabel({
            id: 0,
            name: "wip",
            color: "ffff00",
            description: null,
        });
        expect(result.id).toBe("0");
        expect(result.description).toBeNull();
    });
});

describe("mapCbAuthor", () => {
    it("returns null when input is null", () => {
        expect(mapCbAuthor(null)).toBeNull();
    });

    it("renames avatar_url to avatarUrl and uses an empty url string", () => {
        const result = mapCbAuthor({
            login: "frank",
            avatar_url: "https://codeberg/avatars/frank",
        });
        expect(result).toEqual({
            login: "frank",
            avatarUrl: "https://codeberg/avatars/frank",
            url: "",
        });
    });
});

describe("nullSafe", () => {
    it("returns [] for null", () => {
        expect(nullSafe(null)).toEqual([]);
    });

    it("returns [] for undefined", () => {
        expect(nullSafe(undefined)).toEqual([]);
    });

    it("returns the original array reference when given a populated array", () => {
        const input = [1, 2, 3];
        const result = nullSafe(input);
        expect(result).toEqual([1, 2, 3]);
        expect(result).toBe(input);
    });

    it("returns an empty array when given an empty array", () => {
        const result = nullSafe([]);
        expect(result).toEqual([]);
    });

    it("preserves element order and identity in an array of objects", () => {
        const a = { id: "a" };
        const b = { id: "b" };
        const result = nullSafe([a, b]);
        expect(result).toEqual([a, b]);
        expect(result[0]).toBe(a);
        expect(result[1]).toBe(b);
    });
});
