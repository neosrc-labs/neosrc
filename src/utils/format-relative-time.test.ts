import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./index";

describe("formatRelativeTime", () => {
    describe("now", () => {
        it('returns "now" when the diff is 0 ms', () => {
            const now = new Date("2025-01-15T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe("now");
        });

        it('returns "now" when the diff is less than 1 minute', () => {
            const now = new Date("2025-01-15T12:00:30Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe("now");
        });
    });

    describe("minutes", () => {
        it('returns "1 min ago" for exactly 1 minute', () => {
            const now = new Date("2025-01-15T12:01:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 min ago",
            );
        });

        it('returns "{n} mins ago" for plural minutes', () => {
            const now = new Date("2025-01-15T12:15:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "15 mins ago",
            );
        });

        it('returns "{n} mins ago" for 59 minutes', () => {
            const now = new Date("2025-01-15T12:59:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "59 mins ago",
            );
        });
    });

    describe("hours", () => {
        it('returns "1 hour ago" for exactly 1 hour', () => {
            const now = new Date("2025-01-15T13:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 hour ago",
            );
        });

        it('returns "{n} hours ago" for plural hours', () => {
            const now = new Date("2025-01-15T15:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "3 hours ago",
            );
        });

        it('returns "{n} hours ago" for 23 hours', () => {
            const now = new Date("2025-01-16T11:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "23 hours ago",
            );
        });
    });

    describe("days", () => {
        it('returns "1 day ago" for exactly 1 day', () => {
            const now = new Date("2025-01-16T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 day ago",
            );
        });

        it('returns "{n} days ago" for plural days', () => {
            const now = new Date("2025-01-18T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "3 days ago",
            );
        });

        it('returns "{n} days ago" for 6 days', () => {
            const now = new Date("2025-01-21T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "6 days ago",
            );
        });
    });

    describe("weeks", () => {
        it('returns "1 week ago" for exactly 7 days', () => {
            const now = new Date("2025-01-22T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 week ago",
            );
        });

        it('returns "{n} weeks ago" for plural weeks', () => {
            const now = new Date("2025-02-05T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "3 weeks ago",
            );
        });

        it('returns "{n} weeks ago" for 3 weeks (21 days)', () => {
            const now = new Date("2025-02-05T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "3 weeks ago",
            );
        });
    });

    describe("months", () => {
        it('shows "4 weeks ago" for ~30 days (was "1 month ago" before week range fix)', () => {
            const now = new Date("2025-02-14T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "4 weeks ago",
            );
        });

        it('returns "{n} months ago" for ~2 months', () => {
            const now = new Date("2025-03-16T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "2 months ago",
            );
        });

        it('returns "{n} months ago" for ~11 months', () => {
            const now = new Date("2025-12-10T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "10 months ago",
            );
        });
    });

    describe("years", () => {
        it('returns "1 year ago" for ~365 days', () => {
            const now = new Date("2026-01-15T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 year ago",
            );
        });

        it('returns "{n} years ago" for plural years', () => {
            const now = new Date("2028-01-15T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "3 years ago",
            );
        });

        it('returns "{n} years ago" for many years', () => {
            const now = new Date("2050-01-15T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "25 years ago",
            );
        });
    });

    describe("edge cases", () => {
        it("defaults `now` to current date when not provided", () => {
            const result = formatRelativeTime(new Date().toISOString());
            expect(result).toBe("now");
        });

        it("returns negative minutes for future dates", () => {
            const now = new Date("2025-01-15T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T13:00:00Z", now)).toBe(
                "-60 mins ago",
            );
        });

        it("handles boundary: 60 minutes -> 1 hour", () => {
            const now = new Date("2025-01-15T13:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 hour ago",
            );
        });

        it("handles boundary: 24 hours -> 1 day", () => {
            const now = new Date("2025-01-16T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "1 day ago",
            );
        });

        it("handles boundary: 28 days now correctly shows 4 weeks", () => {
            const now = new Date("2025-02-12T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "4 weeks ago",
            );
        });

        it("handles boundary: 359 days = 11 months, just before year threshold", () => {
            const now = new Date("2026-01-09T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "11 months ago",
            );
        });

        it("handles boundary: 360 days falls out of months into years (floor(360/365)=0)", () => {
            const now = new Date("2026-01-10T12:00:00Z");
            expect(formatRelativeTime("2025-01-15T12:00:00Z", now)).toBe(
                "0 years ago",
            );
        });
    });

    describe("test for previous regressions", () => {
        it("4 weeks (was returning '0 months ago')", () => {
            const now = new Date(1778412839899);
            expect(formatRelativeTime("2026-04-11T14:41:09Z", now)).toBe(
                "4 weeks ago",
            );
        });
    });
});
