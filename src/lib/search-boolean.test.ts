import { describe, expect, it } from "vitest";
import {
    booleanSearchHint,
    planGithubQuery,
    translateForgejoKeywords,
} from "~/lib/search-boolean";

describe("planGithubQuery", () => {
    it("keeps a conjunctive query as a single branch", () => {
        expect(planGithubQuery("label:bug AND assignee:octocat")).toEqual({
            branches: ["label:bug assignee:octocat"],
            unsupported: null,
            unsatisfiable: false,
        });
    });

    it("keeps a label OR as one native comma branch", () => {
        expect(planGithubQuery("label:bug OR label:docs")).toEqual({
            branches: ["label:bug,docs"],
            unsupported: null,
            unsatisfiable: false,
        });
    });

    it("merges a chain of label ORs", () => {
        expect(
            planGithubQuery("label:a OR label:b OR label:c").branches,
        ).toEqual(["label:a,b,c"]);
    });

    it("quotes label values that contain spaces while merging", () => {
        expect(
            planGithubQuery('label:"good first issue" OR label:bug').branches,
        ).toEqual(['label:"good first issue",bug']);
    });

    it("splits an OR between non-label filters into branches", () => {
        expect(
            planGithubQuery("assignee:octocat OR assignee:hubot").branches,
        ).toEqual(["assignee:octocat", "assignee:hubot"]);
    });

    it("splits the reported no:assignee OR assignee case", () => {
        const plan = planGithubQuery("no:assignee OR assignee:epage");
        expect(plan.branches).toEqual(["no:assignee", "assignee:epage"]);
        expect(plan.unsupported).toBeNull();
    });

    it("binds AND tighter than OR", () => {
        expect(planGithubQuery("alpha OR beta gamma").branches).toEqual([
            "alpha",
            "beta gamma",
        ]);
    });

    it("handles the documented grouped example", () => {
        expect(
            planGithubQuery(
                '(type:"Bug" AND assignee:octocat) OR (type:"Feature" AND assignee:hubot)',
            ).branches,
        ).toEqual([
            'type:"Bug" assignee:octocat',
            'type:"Feature" assignee:hubot',
        ]);
    });

    it("distributes an OR inside a group", () => {
        expect(
            planGithubQuery("label:x AND (label:a OR label:b)").branches,
        ).toEqual(["label:x label:a", "label:x label:b"]);
    });

    it("pushes NOT onto the branches", () => {
        expect(planGithubQuery("NOT (label:a OR label:b)").branches).toEqual([
            "-label:a -label:b",
        ]);
    });

    it("turns NOT into a leading dash", () => {
        expect(
            planGithubQuery("label:bug AND NOT label:docs").branches,
        ).toEqual(["label:bug -label:docs"]);
    });

    it("keeps a negated label OR from using the comma form", () => {
        expect(planGithubQuery("-label:a OR label:b").branches).toEqual([
            "-label:a",
            "label:b",
        ]);
    });

    it("rewrites has:assignee and leaves other has: fields alone", () => {
        expect(planGithubQuery("has:assignee OR label:x").branches).toEqual([
            "assignee:*",
            "label:x",
        ]);
        expect(planGithubQuery("has:assignees").branches).toEqual([
            "has:assignees",
        ]);
    });

    it("folds lowercase and/or but keeps lowercase not as prose", () => {
        expect(planGithubQuery("label:bug or label:docs").branches).toEqual([
            "label:bug,docs",
        ]);
        expect(planGithubQuery("cats and dogs").branches).toEqual([
            "cats dogs",
        ]);
        expect(planGithubQuery("not working").branches).toEqual([
            "not working",
        ]);
        expect(planGithubQuery("NOT working").branches).toEqual(["-working"]);
    });

    it("drops every operator from a fallback query", () => {
        expect(planGithubQuery("foo NOT").branches).toEqual(["foo"]);
        const large = planGithubQuery(
            "(a OR b) AND (c OR d) AND (e OR f) AND (g OR h) AND (i OR j)",
        );
        expect(large.branches).toEqual(["a b c d e f g h i j"]);
        expect(large.unsupported).not.toBeNull();
    });

    it("bounds expansion of deeply nested OR groups", () => {
        const pairs = Array.from({ length: 20 }, (_, i) => `(a${i} OR b${i})`);
        const plan = planGithubQuery(pairs.join(" AND "));
        expect(plan.unsupported).not.toBeNull();
        expect(plan.branches).toHaveLength(1);
        expect(plan.branches[0]).not.toContain("OR");
    });

    it("falls back to the plain terms when the query cannot be parsed", () => {
        const plan = planGithubQuery("label:a OR");
        expect(plan.branches).toEqual(["label:a"]);
        expect(plan.unsupported).not.toBeNull();

        const unbalanced = planGithubQuery("label:a) OR label:b");
        expect(unbalanced.unsupported).not.toBeNull();
        expect(unbalanced.branches).toEqual(["label:a label:b"]);
    });

    it("reports a query with too many OR branches", () => {
        const plan = planGithubQuery(
            "(a OR b) AND (c OR d) AND (e OR f) AND (g OR h) AND (i OR j)",
        );
        expect(plan.unsupported).not.toBeNull();
        expect(plan.branches[0]).not.toContain("OR");
    });

    it("marks a conjunction of presence and absence as unsatisfiable", () => {
        const plan = planGithubQuery(
            "is:open (no:assignee AND assignee:epage)",
        );
        expect(plan.unsatisfiable).toBe(true);
        expect(plan.branches).toEqual([]);

        for (const query of [
            "no:assignee AND assignee:epage",
            "no:label AND label:bug",
            "no:milestone AND milestone:v1",
            "has:assignee AND no:assignee",
        ]) {
            expect(planGithubQuery(query).unsatisfiable).toBe(true);
        }
    });

    it("drops only the contradictory branch of a union", () => {
        const plan = planGithubQuery(
            "(no:assignee AND assignee:epage) OR label:bug",
        );
        expect(plan.branches).toEqual(["label:bug"]);
        expect(plan.unsatisfiable).toBe(false);
    });

    it("keeps a compatible no:/value pair satisfiable", () => {
        expect(
            planGithubQuery("no:assignee AND -assignee:epage").unsatisfiable,
        ).toBe(false);
        expect(planGithubQuery("no:label AND label:bug").unsatisfiable).toBe(
            true,
        );
    });

    it("returns no branches for an empty query", () => {
        expect(planGithubQuery("")).toEqual({
            branches: [],
            unsupported: null,
            unsatisfiable: false,
        });
    });
});

describe("translateForgejoKeywords", () => {
    it("makes bare terms required so they are combined with AND", () => {
        expect(translateForgejoKeywords("foo bar").query).toBe("+foo +bar");
    });

    it("drops the AND keyword for the same reason", () => {
        expect(translateForgejoKeywords("foo AND bar").query).toBe("+foo +bar");
    });

    it("folds lowercase and/or so stopwords are not required terms", () => {
        expect(translateForgejoKeywords("cats and dogs").query).toBe(
            "+cats +dogs",
        );
    });

    it("keeps an already negated term negative", () => {
        expect(translateForgejoKeywords("-foo bar").query).toBe("-foo +bar");
    });

    it("turns NOT into a leading dash", () => {
        expect(translateForgejoKeywords("foo NOT bar").query).toBe("+foo -bar");
    });

    it("drops qualifiers, which the provider applies itself", () => {
        expect(translateForgejoKeywords("label:bug foo is:open").query).toBe(
            "+foo",
        );
        expect(
            translateForgejoKeywords("label:bug foo is:open").unsupported,
        ).toBeNull();
    });

    it("reports qualifiers the provider does not apply", () => {
        const result = translateForgejoKeywords("assignee:bob foo");
        expect(result.query).toBe("+foo");
        expect(result.unsupported).toContain("assignee:");
    });

    it("reports OR and keeps the terms combined with AND", () => {
        const result = translateForgejoKeywords("foo OR bar");
        expect(result.query).toBe("+foo +bar");
        expect(result.unsupported).not.toBeNull();
    });

    it("reports parentheses and keeps the inner terms", () => {
        const result = translateForgejoKeywords("(foo OR bar)");
        expect(result.query).toBe("+foo +bar");
        expect(result.unsupported).not.toBeNull();
    });

    it("reports NOT before a filter, which cannot be excluded", () => {
        const result = translateForgejoKeywords("NOT label:bug foo");
        expect(result.query).toBe("+foo");
        expect(result.unsupported).not.toBeNull();
    });

    it("reports a dangling NOT", () => {
        const result = translateForgejoKeywords("foo NOT");
        expect(result.query).toBe("+foo");
        expect(result.unsupported).not.toBeNull();
    });
});

describe("booleanSearchHint", () => {
    it("returns null for queries the provider can express", () => {
        expect(booleanSearchHint("gh", "label:a OR label:b")).toBeNull();
        expect(booleanSearchHint("gh", "assignee:a OR assignee:b")).toBeNull();
        expect(booleanSearchHint("cb", "foo AND bar")).toBeNull();
        expect(booleanSearchHint("gh", "")).toBeNull();
    });

    it("reports syntax Codeberg cannot express", () => {
        expect(booleanSearchHint("cb", "foo OR bar")).not.toBeNull();
    });
});
