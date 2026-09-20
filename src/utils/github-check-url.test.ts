import { describe, expect, it } from "vitest";
import { githubPullRequestCheckUrl } from "./github-check-url";

describe("githubPullRequestCheckUrl", () => {
    it("adds the pull request to GitHub Actions job URLs", () => {
        expect(
            githubPullRequestCheckUrl(
                "https://github.com/rust-lang/cargo/actions/runs/35358413926/job/106011494762",
                17485,
            ),
        ).toBe(
            "https://github.com/rust-lang/cargo/actions/runs/35358413926/job/106011494762?pr=17485",
        );
    });

    it("replaces an existing pull request without dropping other parameters", () => {
        expect(
            githubPullRequestCheckUrl(
                "https://github.com/o/r/actions/runs/1/job/2?pr=3&check_suite_focus=true",
                4,
            ),
        ).toBe(
            "https://github.com/o/r/actions/runs/1/job/2?pr=4&check_suite_focus=true",
        );
    });

    it("leaves non-job check URLs unchanged", () => {
        const url = "https://ci.example.com/build/123";
        expect(githubPullRequestCheckUrl(url, 4)).toBe(url);
    });
});
