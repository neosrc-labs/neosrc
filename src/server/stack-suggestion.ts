export interface StackSuggestionPullRequest {
    number: number;
    title: string;
    state: "open" | "closed" | "merged";
    draft: boolean;
    headRef: string;
}

export interface StackSuggestion {
    /** Chain of pull requests, bottom to top, including the current PR. */
    pullRequests: StackSuggestionPullRequest[];
    /** Trunk branch the bottom pull request targets. */
    baseRef: string;
}

export interface StackCandidate extends StackSuggestionPullRequest {
    baseRef: string;
}

/** GitHub limits a stack create call to 20 pull requests. */
export const MAX_STACK_SIZE = 20;

/**
 * Walks the chain of pull requests whose branches line up below a given PR:
 * each PR's base branch is the head branch of the PR below it. The returned
 * chain is ordered bottom to top (the order the stacks API expects) and
 * includes the PR itself. Returns null when there is nothing to stack on.
 *
 * @param top the PR to stack (number, title, and its base ref to look below)
 * @param findBelow resolves the open PR whose head branch matches the ref
 * @param maxSize maximum number of PRs in the chain (defaults to the GitHub cap)
 */
export async function buildStackSuggestion(
    top: StackCandidate,
    findBelow: (headRef: string) => Promise<StackCandidate | null>,
    maxSize: number = MAX_STACK_SIZE,
): Promise<StackSuggestion | null> {
    const chain: StackSuggestionPullRequest[] = [
        {
            number: top.number,
            title: top.title,
            state: top.state,
            draft: top.draft,
            headRef: top.headRef,
        },
    ];
    let headRef = top.baseRef;

    while (chain.length < maxSize) {
        const candidate = await findBelow(headRef);
        if (!candidate) {
            break;
        }
        chain.unshift({
            number: candidate.number,
            title: candidate.title,
            state: candidate.state,
            draft: candidate.draft,
            headRef: candidate.headRef,
        });
        headRef = candidate.baseRef;
    }

    return chain.length > 1 ? { pullRequests: chain, baseRef: headRef } : null;
}
