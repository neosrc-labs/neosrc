# PR Action Bar — Prototype Report

## What this prototype does

Moves the PR action section (merge, close, mark as draft, submit review, revert) from the left sidebar into the main content area, shared across both the PR timeline page and the files-changed page. When scrolled past, the bar fixes to the top of the viewport.

## Files changed / created

| File | What changed |
|---|---|
| `src/app/gh/[owner]/[repo]/pull/[number]/_components/actions-section.tsx` | Changed layout from stacked full-width to `flex flex-wrap justify-end`; added `sticky` prop; added `listReviews` query + review stats; added `getMergeRequirements` query + "N of M" approval display; added `RequiredChecks` sub-component |
| `src/app/gh/[owner]/[repo]/pull/[number]/_components/sticky-action-bar.tsx` | **New.** IntersectionObserver + `position: fixed` bar that activates when the sentinel scrolls out of view |
| `src/app/gh/[owner]/[repo]/pull/[number]/_components/description.tsx` | Added `actionSection` prop slot; renders action section inline in the branch-info row (alongside "opened by", +42 -10) |
| `src/app/gh/[owner]/[repo]/pull/[number]/_components/left-sidebar.tsx` | Removed `ActionSection` import and rendering |
| `src/app/gh/[owner]/[repo]/pull/[number]/_components/files-client.tsx` | Added `ActionSection` inline in the existing sticky header (alongside "Files Changed", viewed progress, comments toggle) |
| `src/app/gh/[owner]/[repo]/pull/[number]/page.tsx` | Wires up data fetching for `ActionSection`; passes it as `actionSection` prop to `PullRequestDescriptionSection` |
| `src/app/gh/[owner]/[repo]/pull/[number]/files/[[...sha]]/page.tsx` | Same data fetching as above, passes props to `FilesSection` |
| `src/app/gh/[owner]/[repo]/pull/[number]/layout.tsx` | Cleaned up unused props from `LeftSidebar` |
| `src/server/github.ts` | Added `MergeRequirements` type and `getMergeRequirements` function (fetches branch rules + branch protection for required approvals and required status checks) |
| `src/server/api/routers/pulls/index.ts` | Added `getMergeRequirements` tRPC procedure |

## Architecture decisions

### Why `position: fixed` instead of `position: sticky`?

`position: sticky` is bounded by its parent element's box. The action bar sits inside `PullRequestDescriptionSection` (timeline page) or `FilesSection`'s header (files page). On the timeline page, the parent is the description div — once you scroll past the description body, the sticky behavior stops. Using `position: fixed` with an IntersectionObserver gives viewport-level stickiness that persists across the entire page.

### Why measure `<main>` for the fixed bar's width?

The page layout uses a CSS grid with fixed-position sidebars. The `<main>` element spans the content area between the left and right sidebars. When the bar becomes fixed, it needs to cover this same area so the background extends edge-to-edge within the content region, not just the bar's own in-flow bounding box (which sits inside `max-w-7xl` centering).

### Why inline in the branch-info row instead of its own row?

On the timeline page, putting the action bar on its own row (even with `justify-end`) leaves a large empty space to the left. Placing it in the same flex row as "base ← head", "opened by", and "+42 -10" uses the `ml-auto` on the additions/deletions to push everything to the right, eliminating dead space.

### Why `sticky` prop on `ActionSection`?

The timeline page wraps `ActionSection` in `StickyActionBar` (which provides the fixed-position behavior). The files page embeds `ActionSection` directly inside its own sticky header (which already has `sticky top-0 z-10`). The `sticky` prop (default `true`) controls whether `ActionSection` wraps itself in the sticky container — the files page sets it to `false` to avoid nesting sticky elements.

### Why `getBranchRules` with fallback to `getBranchProtection`?

`GET /repos/{owner}/{repo}/rules/branches/{branch}` returns only **rulesets** (repo/org level). Classic branch protection is **not** included. When rulesets are empty, we fall back to `GET /repos/{owner}/{repo}/branches/{branch}/protection` which covers classic protection. A real implementation should merge both sources (the "most restrictive wins" rule from GitHub's docs).

## Known gaps (needs production work)

### 1. Branch protection: no effective-rule merging

The current `getMergeRequirements` takes an either/or approach — try rulesets first, fall back to classic protection. A production implementation needs to:

- Fetch both rulesets AND classic protection
- Merge them according to GitHub's "union of rule types, most restrictive value wins" semantics
- Handle the full `repository-rule-detailed` discriminated union (not just `pull_request` and `required_status_checks`)
- Account for bypass actors (rulesets have per-actor bypass modes; classic protection has `enforce_admins` and `bypass_pull_request_allowances`)

**Relevant API endpoints:**
- `GET /repos/{owner}/{repo}/rules/branches/{branch}` — aggregated effective rules (rulesets only)
- `GET /repos/{owner}/{repo}/branches/{branch}/protection` — classic branch protection
- The `repository-rule-detailed` type has 20+ rule types including `merge_queue`, `required_deployments`, `required_signatures`, `non_fast_forward`, `commit_message_pattern`, `file_path_restriction`, etc.

### 2. Required checks: no context on which checks are required

The `getBranchProtection` endpoint returns `required_status_checks.contexts` (a list of check names that must pass). The `getBranchRules` endpoint returns `required_status_checks` rules with the same data. But the check-runs API (`GET /repos/{owner}/{repo}/commits/{ref}/check-runs`) does **not** mark which checks are required vs optional. The cross-reference works by matching check names.

Potential issues:
- Check names may not match exactly (API vs UI formatting)
- Commit statuses (`repos.listCommitStatusesForRef`) use different name fields than check runs
- A matching required-status-check with `conclusion: null` and `status: "completed"` likely means a legacy status with no explicit pass/fail — needs interpretation

### 3. `reviewDecision` is GraphQL-only

The prototype uses `api.pulls.listReviews` (REST) and builds a state map manually. GitHub's `reviewDecision` field (`APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED`) is only available via GraphQL. The manual state-map logic in `actions-section.tsx:374-415` is a reasonable approximation but may not match GitHub's exact semantics (e.g., handling of stale reviews, dismissed reviews, team-based reviewers, CODEOWNERS).

### 4. `mergeable_state` is a coarse summary

The prototype relies on `pullRequest.mergeable_state` for the "blocked" / "clean" / "dirty" / "unknown" states. This field is officially undocumented (REST) and doesn't tell you which specific requirement is unmet. A production implementation should evaluate each requirement independently (review count, check status, conversation resolution, etc.) rather than relying on this aggregate.

From GitHub's own docs: "These mergeability fields evaluate against the base branch's rules without regard to whether the calling actor is on a bypass list."

### 5. `StickyActionBar` uses `document.querySelector("main")`

The fixed-position bar finds the `<main>` element via a DOM selector. This breaks encapsulation and is fragile — if the layout changes (different class name, no `<main>` element, shadow DOM), the bar will misposition. A production version should use React context or a ref-forwarded container element.

### 6. No codeowner or conversation resolution data

The prototype doesn't check:
- CODEOWNERS file — required owner approvals
- Conversation resolution — unresolved review threads block merge
- Dismissal of stale reviews — new commits may invalidate existing approvals

These are not exposed through any currently-called API.

### 7. Required checks: identical name matching is fragile

In `RequiredChecks` component (`actions-section.tsx`), check names are matched by strict equality:
```typescript
const match = checks?.find((c) => c.name === name);
```

Check names from the REST API may differ from the names in branch protection rules (e.g., different formatting, URL handling, GitHub Actions naming). A production implementation needs fuzzy/normalized matching.

### 8. Data fetching duplication

Both `page.tsx` and the files page duplicate the data-fetching logic for `userPermissionPromise`, `conflictedFilesPromise`, and `currentUserLogin`. The `layout.tsx` already fetches much of this data for the sidebars but doesn't share it with page-level components. A production implementation should use a shared context or pass the data through the layout.

### 9. Polling for checks

The `RequiredChecks` component uses `staleTime: 15_000` but has no polling/refetch interval. The right sidebar's checks section has a sophisticated polling strategy via `computeChecksPollingInterval` (5s when checks are in progress, 30s otherwise). The `RequiredChecks` component should use the same strategy.

### 10. Edge cases in review state computation

The review-state-map logic in `actions-section.tsx` (lines 374-415) has edge cases:
- Team-based requested reviewers are not tracked
- Multiple reviews from the same user — the last non-dismissed state wins (correct), but dismissed-then-re-requested flows may not behave as expected
- The PR author's own reviews are excluded (correct per GitHub's UI), but admin reviews on their own PR may have different semantics
- `COMMENTED` → `PENDING` promotion for requested reviewers may not match GitHub's definition of "pending"

### 11. Files page: `ActionSection` may re-fetch PR data

The files page already has `pullRequestPromise` which contains all PR data. The `ActionSection` will use this. But the `getMergeRequirements` and `listReviews` tRPC queries inside `ActionSection` fire separate API calls that could be batched or cached more aggressively.

### 12. `StickyActionBar` z-index conflicts

The fixed bar uses `zIndex: 20`. The existing sticky header on the files page uses `z-10`. The page header may use a different z-index. If other elements (dropdowns, modals, popovers) render at higher z-levels, they may appear above the sticky bar incorrectly.
