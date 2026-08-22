import {
    GraphqlResponseError,
    graphql as octokitGraphql,
} from "@octokit/graphql";
import type { RefreshableAuth } from "~/server/auth";

// NOTE: The itemType filter is an explicit whitelist because of https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions
// Some event types ADDED_TO_PROJECT_V2_EVENT and PROJECT_V2_ITEM_STATUS_CHANGED_EVENT (and maybe others) will
// result in the entire API call failing.

/**
 * A 401 means the token itself was rejected (expired, revoked, or replaced),
 * as opposed to a 403/404 which signal missing permissions or resources.
 */
export function isUnauthorizedError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status?: unknown }).status === 401
    );
}

/**
 * GraphQL client that swaps in a fresh token and retries once when the token
 * is rejected (401), mirroring createOctokit's behavior for REST.
 */
function createGraphql(auth: string | RefreshableAuth) {
    const refresh = (auth as RefreshableAuth).refresh;
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${String(auth)}` },
    });
    if (typeof refresh !== "function") return graphql;

    let token = String(auth);
    let didRefresh = false;
    return (async (query: string, parameters?: Record<string, unknown>) => {
        try {
            return await graphql(query, parameters);
        } catch (error) {
            if (didRefresh || !isUnauthorizedError(error)) throw error;
            didRefresh = true;
            token = await refresh();
            return octokitGraphql.defaults({
                headers: { authorization: `bearer ${token}` },
            })(query, parameters);
        }
    }) as typeof octokitGraphql;
}

/**
 * True when a graphql request failed because the target organization has
 * enabled OAuth App access restrictions and the request's OAuth app is not
 * approved. The GraphQL API enforces the restriction even where REST reads
 * of public repository data are still allowed, so callers fall back to the
 * REST endpoints.
 */
export function isOrgRestrictionError(error: unknown): boolean {
    if (!(error instanceof GraphqlResponseError)) return false;
    return (
        error.errors?.some(
            (e) =>
                e.type === "FORBIDDEN" &&
                e.message.includes("OAuth App access restrictions"),
        ) === true
    );
}

const SIMPLE_USER_FRAGMENT = `
fragment SimpleUser on Actor {
	__typename
	login
	avatarUrl
	url
}
`;

const COMMIT_FIELDS_FRAGMENT = `
fragment CommitFields on Commit {
	oid
	message
	committedDate
	authors(first: 10) {
		nodes {
			name
			email
			avatarUrl
			user { ...SimpleUser }
		}
	}
	signature {
		__typename
		... on GpgSignature { isValid keyId state }
		... on SshSignature { isValid state }
		... on SmimeSignature { isValid state }
	}
}
`;

const TIMELINE_QUERY = `
${SIMPLE_USER_FRAGMENT}
${COMMIT_FIELDS_FRAGMENT}

query PullRequestTimeline(
	$owner: String!
	$repo: String!
	$number: Int!
	$first: Int!
	$after: String
) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			timelineItems(first: $first, after: $after, itemTypes: [
				ISSUE_COMMENT,
				PULL_REQUEST_REVIEW,
				HEAD_REF_FORCE_PUSHED_EVENT,
				HEAD_REF_DELETED_EVENT,
				HEAD_REF_RESTORED_EVENT,
				CROSS_REFERENCED_EVENT,
				ASSIGNED_EVENT,
				AUTO_MERGE_DISABLED_EVENT,
				AUTO_MERGE_ENABLED_EVENT,
				ADDED_TO_MERGE_QUEUE_EVENT,
				REMOVED_FROM_MERGE_QUEUE_EVENT,
				UNASSIGNED_EVENT,
				CLOSED_EVENT,
				REOPENED_EVENT,
				MERGED_EVENT,
				LABELED_EVENT,
				UNLABELED_EVENT,
				RENAMED_TITLE_EVENT,
				LOCKED_EVENT,
				UNLOCKED_EVENT,
				MILESTONED_EVENT,
				DEMILESTONED_EVENT,
				REVIEW_REQUESTED_EVENT,
				REVIEW_REQUEST_REMOVED_EVENT,
				CONVERT_TO_DRAFT_EVENT,
				READY_FOR_REVIEW_EVENT,
				REFERENCED_EVENT,
				COMMENT_DELETED_EVENT,
				DEPLOYED_EVENT,
				PULL_REQUEST_COMMIT,
				REVIEW_DISMISSED_EVENT,
				BASE_REF_CHANGED_EVENT
			]) {
				nodes {
					__typename
					... on IssueComment {
						id
						databaseId
						body
						author { ...SimpleUser }
						createdAt
						authorAssociation
						isMinimized
						minimizedReason
						reactions(first: 10) {
							nodes {
								databaseId
								content
								createdAt
								user { login avatarUrl }
							}
						}
					}
					... on PullRequestReview {
						id
						databaseId
						author { login avatarUrl url }
						authorAssociation
						body
						state
						submittedAt
						createdAt
						isMinimized
						minimizedReason
						reactions(first: 10) {
							nodes {
								databaseId
								content
								createdAt
								user { login avatarUrl }
							}
						}
					}
					... on HeadRefForcePushedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						ref { name }
						beforeCommit { oid }
						afterCommit { oid }
					}
					... on HeadRefDeletedEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on HeadRefRestoredEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on CrossReferencedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						source {
							__typename
							... on Issue {
								number
								title
								url
								state
								repository { name owner { login } }
							}
							... on PullRequest {
								number
								title
								url
								state
								body
								repository { name owner { login } }
							}
						}
					}
					... on AssignedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						assignee { ...SimpleUser }
					}
					... on UnassignedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						assignee { ...SimpleUser }
					}
					... on ClosedEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on ReopenedEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on MergedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						mergeRefName
						commit { abbreviatedOid commitUrl }
					}
					... on LabeledEvent {
						id
						actor { ...SimpleUser }
						createdAt
						label { name color description }
					}
					... on UnlabeledEvent {
						id
						actor { ...SimpleUser }
						createdAt
						label { name color description }
					}
					... on RenamedTitleEvent {
						id
						actor { ...SimpleUser }
						createdAt
						previousTitle
						currentTitle
					}
					... on BaseRefChangedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						currentRefName
						previousRefName
					}
					... on LockedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						lockReason
					}
					... on UnlockedEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on MilestonedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						milestoneTitle
					}
					... on DemilestonedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						milestoneTitle
					}
					... on ReviewRequestedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						requestedReviewer {
							__typename
							... on User { login avatarUrl url }
							... on Team { name slug }
						}
					}
					... on ReviewRequestRemovedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						requestedReviewer {
							__typename
							... on User { login avatarUrl url }
							... on Team { name slug }
						}
					}
					... on ConvertToDraftEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on ReadyForReviewEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on ReferencedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						commit { oid committedDate messageHeadline commitUrl }
						commitRepository { name owner { login } }
					}
					... on AddedToProjectV2Event {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on ProjectV2ItemStatusChangedEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on CommentDeletedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						deletedCommentAuthor { ...SimpleUser }
					}
					... on DeployedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						deployment {
							environment
							task
							description
							latestStatus { state }
							state
						}
						ref { name }
					}
... on PullRequestCommit {
						id
						commit { ...CommitFields }
					}
					... on ReviewDismissedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						dismissalMessage
					}
					... on AutoMergeEnabledEvent {
						id
						actor { ...SimpleUser }
						createdAt
					}
					... on AutoMergeDisabledEvent {
						id
						actor { ...SimpleUser }
						createdAt
						reason
					}
					... on AddedToMergeQueueEvent {
						id
						actor { ...SimpleUser }
						createdAt
						enqueuer { ...SimpleUser }
					}
					... on RemovedFromMergeQueueEvent {
						id
						actor { ...SimpleUser }
						createdAt
						enqueuer { ...SimpleUser }
						reason
					}
				}
				pageInfo {
					hasNextPage
					endCursor
				}
			}
			mergeQueueEntry {
				state
				position
				headCommit { oid }
				enqueuer { ...SimpleUser }
				enqueuedAt
				solo
			}
		}
	}
	viewer { login }
}
`;
const PR_COMMITS_QUERY = `
${SIMPLE_USER_FRAGMENT}
${COMMIT_FIELDS_FRAGMENT}

query PullRequestCommits(
	$owner: String!
	$repo: String!
	$number: Int!
	$first: Int!
	$after: String
) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			commits(first: $first, after: $after) {
				nodes {
					commit { ...CommitFields }
				}
				pageInfo { hasNextPage endCursor }
			}
		}
	}
}
`;

const PULL_REQUEST_HEAD_SHA_QUERY = `
query PullRequestHeadSha($owner: String!, $repo: String!, $number: Int!) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			headRefOid
		}
	}
}
`;

const COMMIT_BY_OID_QUERY = `
${SIMPLE_USER_FRAGMENT}
${COMMIT_FIELDS_FRAGMENT}

query CommitByOid($owner: String!, $repo: String!, $oid: GitObjectID!) {
	repository(owner: $owner, name: $repo) {
		object(oid: $oid) {
			... on Commit { ...CommitFields }
		}
	}
}
`;
const BRANCH_COMMITS_QUERY = `
${SIMPLE_USER_FRAGMENT}

query BranchCommits(
	$owner: String!
	$repo: String!
	$branch: String!
	$first: Int
	$last: Int
	$after: String
	$before: String
	$author: CommitAuthor
) {
	repository(owner: $owner, name: $repo) {
		ref(qualifiedName: $branch) {
			target {
				... on Commit {
					history(first: $first, last: $last, after: $after, before: $before, author: $author) {
						totalCount
						pageInfo { hasNextPage, hasPreviousPage, startCursor, endCursor }
						nodes {
							oid
							message
							committedDate
							authors(first: 10) { nodes { name, email, avatarUrl, user { ...SimpleUser } } }
							statusCheckRollup { state, contexts(first: 50) { nodes { ... on StatusContext { state, targetUrl, description, context, createdAt } ... on CheckRun { name, conclusion, status, detailsUrl, startedAt, completedAt } } } }
							signature { __typename ... on GpgSignature { isValid, keyId, state } ... on SshSignature { isValid, state } ... on SmimeSignature { isValid, state } }
						}
					}
				}
			}
		}
	}
}
`;

export type GQLActor = {
    __typename: string;
    login: string;
    avatarUrl: string;
    url: string;
};

export type GQLReactionNode = {
    databaseId: number;
    content: string;
    createdAt: string;
    user: { login: string; avatarUrl?: string } | null;
};

export type GQLLabel = {
    name: string;
    color: string;
    description: string | null;
};

export type GQLIssueComment = {
    __typename: "IssueComment";
    id: string;
    databaseId: number;
    body: string;
    author: GQLActor | null;
    createdAt: string;
    authorAssociation: string;
    isMinimized: boolean;
    minimizedReason: string | null;
    reactions: { nodes: (GQLReactionNode | null)[] };
};

export type GQLPullRequestReview = {
    __typename: "PullRequestReview";
    id: string;
    databaseId: number;
    state: string;
    body: string;
    author: GQLActor | null;
    authorAssociation: string;
    submittedAt: string | null;
    createdAt: string;
    isMinimized: boolean;
    minimizedReason: string | null;
    reactions: { nodes: (GQLReactionNode | null)[] };
    /** Repo permission of the review author. Set server-side for approved
     *  reviews to decide the green/gray approval check; undefined when
     *  unknown (e.g. anonymous viewer or a failed lookup). */
    authorPermission?: "admin" | "write" | "read" | "none";
};

export type GQLHeadRefForcePushedEvent = {
    __typename: "HeadRefForcePushedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    ref?: { name: string } | null;
    beforeCommit?: { oid: string } | null;
    afterCommit?: { oid: string } | null;
};

export type GQLHeadRefDeletedEvent = {
    __typename: "HeadRefDeletedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLHeadRefRestoredEvent = {
    __typename: "HeadRefRestoredEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLCrossReferencedEvent = {
    __typename: "CrossReferencedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    source: {
        __typename: "Issue" | "PullRequest";
        number: number;
        title: string;
        url: string;
        state: string;
        body?: string;
        repository: { name: string; owner: { login: string } };
    } | null;
};

export type GQLAssignedEvent = {
    __typename: "AssignedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    assignee: GQLActor | null;
};

export type GQLUnassignedEvent = {
    __typename: "UnassignedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    assignee: GQLActor | null;
};

export type GQLClosedEvent = {
    __typename: "ClosedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLReopenedEvent = {
    __typename: "ReopenedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLMergedEvent = {
    __typename: "MergedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    mergeRefName: string;
    commit: { abbreviatedOid: string; commitUrl: string } | null;
};

export type GQLLabeledEvent = {
    __typename: "LabeledEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    label: GQLLabel | null;
};

export type GQLUnlabeledEvent = {
    __typename: "UnlabeledEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    label: GQLLabel | null;
};

export type GQLRenamedTitleEvent = {
    __typename: "RenamedTitleEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    previousTitle: string;
    currentTitle: string;
};

export type GQLBaseRefChangedEvent = {
    __typename: "BaseRefChangedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    currentRefName: string;
    previousRefName: string;
};

export type GQLLockedEvent = {
    __typename: "LockedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    lockReason: string | null;
};

export type GQLUnlockedEvent = {
    __typename: "UnlockedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLMilestonedEvent = {
    __typename: "MilestonedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    milestoneTitle: string | null;
};

export type GQLDemilestonedEvent = {
    __typename: "DemilestonedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    milestoneTitle: string | null;
};

export type GQLReviewRequestedEvent = {
    __typename: "ReviewRequestedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    requestedReviewer:
        | { __typename: "User"; login: string; avatarUrl: string; url: string }
        | { __typename: "Team"; name?: string; slug: string }
        | null;
};

export type GQLReviewRequestRemovedEvent = {
    __typename: "ReviewRequestRemovedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    requestedReviewer:
        | { __typename: "User"; login: string; avatarUrl: string; url: string }
        | { __typename: "Team"; name?: string; slug: string }
        | null;
};

export type GQLConvertToDraftEvent = {
    __typename: "ConvertToDraftEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLReadyForReviewEvent = {
    __typename: "ReadyForReviewEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLReferencedEvent = {
    __typename: "ReferencedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    commit: {
        oid: string;
        committedDate?: string;
        messageHeadline?: string;
        commitUrl?: string;
    } | null;
    commitRepository?: { name: string; owner: { login: string } } | null;
};

export type GQLAddedToProjectV2Event = {
    __typename: "AddedToProjectV2Event";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLProjectV2ItemStatusChangedEvent = {
    __typename: "ProjectV2ItemStatusChangedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLCommentDeletedEvent = {
    __typename: "CommentDeletedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    deletedCommentAuthor: GQLActor | null;
};

export type GQLDeployedEvent = {
    __typename: "DeployedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    deployment: {
        environment: string | null;
        task: string | null;
        description: string | null;
        latestStatus: { state: string } | null;
        state: string | null;
    } | null;
    ref: { name: string } | null;
};

export type GQLGpgSignature = {
    __typename: "GpgSignature";
    isValid: boolean;
    keyId: string;
    state: string;
};

export type GQLSshSignature = {
    __typename: "SshSignature";
    isValid: boolean;
    state: string;
};

export type GQLSmimeSignature = {
    __typename: "SmimeSignature";
    isValid: boolean;
    state: string;
};

export type GQLGitSignature =
    | GQLGpgSignature
    | GQLSshSignature
    | GQLSmimeSignature;

/**
 * Signature fields as returned by queries that do not select `keyId`
 * (e.g. the branch commits query). `isValid` is kept nullable to match
 * what those queries type it as.
 */
export type GQLGitSignatureSummary =
    | {
          __typename: "GpgSignature";
          isValid: boolean | null;
          state: string;
          keyId?: string;
      }
    | {
          __typename: "SshSignature";
          isValid: boolean | null;
          state: string;
      }
    | {
          __typename: "SmimeSignature";
          isValid: boolean | null;
          state: string;
      };

export type GQLCommitAuthor = {
    name: string | null;
    email?: string | null;
    avatarUrl: string | null;
    user: GQLActor | null;
};

export type GQLCommitFields = {
    oid: string;
    message: string;
    committedDate?: string;
    authors: { nodes: (GQLCommitAuthor | null)[] };
    signature?: GQLGitSignature | null;
};

export type GQLPullRequestCommit = {
    __typename: "PullRequestCommit";
    id: string;
    commit: GQLCommitFields | null;
};

export type GQLReviewDismissedEvent = {
    __typename: "ReviewDismissedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    dismissalMessage: string | null;
};

export type GQLMentionedEvent = {
    __typename: "MentionedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLSubscribedEvent = {
    __typename: "SubscribedEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLAutoMergeEnabledEvent = {
    __typename: "AutoMergeEnabledEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
};

export type GQLAutoMergeDisabledEvent = {
    __typename: "AutoMergeDisabledEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    reason?: string | null;
};

export type GQLAddedToMergeQueueEvent = {
    __typename: "AddedToMergeQueueEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    enqueuer: GQLActor | null;
};

export type GQLRemovedFromMergeQueueEvent = {
    __typename: "RemovedFromMergeQueueEvent";
    id: string;
    actor: GQLActor | null;
    createdAt: string;
    enqueuer: GQLActor | null;
    reason: string | null;
};

export type GQLMergeQueueEntryState =
    | "QUEUED"
    | "AWAITING_CHECKS"
    | "MERGEABLE"
    | "UNMERGEABLE"
    | "LOCKED";

export type GQLMergeQueueEntry = {
    state: GQLMergeQueueEntryState;
    position: number;
    headCommit: { oid: string } | null;
    enqueuer: GQLActor;
    enqueuedAt: string;
    solo: boolean;
} | null;

export type GQLTimelineEvent =
    | GQLIssueComment
    | GQLPullRequestReview
    | GQLHeadRefForcePushedEvent
    | GQLHeadRefDeletedEvent
    | GQLHeadRefRestoredEvent
    | GQLCrossReferencedEvent
    | GQLAssignedEvent
    | GQLBaseRefChangedEvent
    | GQLUnassignedEvent
    | GQLClosedEvent
    | GQLReopenedEvent
    | GQLMergedEvent
    | GQLLabeledEvent
    | GQLUnlabeledEvent
    | GQLRenamedTitleEvent
    | GQLLockedEvent
    | GQLUnlockedEvent
    | GQLMilestonedEvent
    | GQLDemilestonedEvent
    | GQLReviewRequestedEvent
    | GQLReviewRequestRemovedEvent
    | GQLConvertToDraftEvent
    | GQLReadyForReviewEvent
    | GQLReferencedEvent
    | GQLAddedToProjectV2Event
    | GQLProjectV2ItemStatusChangedEvent
    | GQLCommentDeletedEvent
    | GQLDeployedEvent
    | GQLPullRequestCommit
    | GQLReviewDismissedEvent
    | GQLMentionedEvent
    | GQLSubscribedEvent
    | GQLAutoMergeEnabledEvent
    | GQLAutoMergeDisabledEvent
    | GQLAddedToMergeQueueEvent
    | GQLRemovedFromMergeQueueEvent;

const CONTENT_MAP: Record<string, string> = {
    THUMBS_UP: "+1",
    THUMBS_DOWN: "-1",
    LAUGH: "laugh",
    HOORAY: "hooray",
    CONFUSED: "confused",
    HEART: "heart",
    ROCKET: "rocket",
    EYES: "eyes",
};

export async function getPullRequestTimelineGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    limit: number,
    after?: string,
): Promise<{
    events: GQLTimelineEvent[];
    hasMore: boolean;
    endCursor: string | undefined;
    commentReactions: Record<
        string,
        {
            databaseId: number;
            content: string;
            createdAt: string;
            user: { login: string; avatarUrl?: string } | null;
        }[]
    >;
    currentUserLogin: string | undefined;
    mergeQueueEntry: GQLMergeQueueEntry;
}> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            pullRequest: {
                timelineItems: {
                    nodes: Record<string, unknown>[];
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                };
                mergeQueueEntry: Record<string, unknown> | null;
            };
        };
        viewer: { login: string };
    }>(TIMELINE_QUERY, {
        owner,
        repo,
        number: pullNumber,
        first: limit,
        after: after ?? undefined,
    });

    const rawNodes = result.repository.pullRequest.timelineItems.nodes.filter(
        Boolean,
    ) as GQLTimelineEvent[];

    const events = rawNodes.map((node) => {
        if (node.__typename === "PullRequestCommit" && node.commit?.authors) {
            return {
                ...node,
                commit: {
                    ...node.commit,
                    authors: {
                        nodes: (node.commit.authors.nodes ?? []).map(
                            (author) =>
                                author ? resolveCommitAuthor(author) : author,
                        ),
                    },
                },
            };
        }
        return node;
    });
    const pageInfo = result.repository.pullRequest.timelineItems.pageInfo;

    const commentReactions: Record<
        string,
        {
            databaseId: number;
            content: string;
            createdAt: string;
            user: { login: string; avatarUrl?: string } | null;
        }[]
    > = {};

    // IssueComment and PullRequestReview databaseIds come from independent
    // sequences. Namespace the keys so an ID collision cannot make one
    // object display another object's reactions.
    for (const node of events) {
        if (
            node.__typename === "IssueComment" ||
            node.__typename === "PullRequestReview"
        ) {
            const { reactions, databaseId } = node;
            if (databaseId && reactions?.nodes) {
                const key =
                    node.__typename === "IssueComment"
                        ? `comment:${databaseId}`
                        : `review:${databaseId}`;
                commentReactions[key] = reactions.nodes
                    .filter((r): r is GQLReactionNode => r !== null)
                    .map((r) => ({
                        databaseId: r.databaseId,
                        content:
                            CONTENT_MAP[r.content] ?? r.content.toLowerCase(),
                        createdAt: r.createdAt,
                        user: r.user,
                    }));
            }
        }
    }

    const mergeQueueEntry = result.repository.pullRequest
        .mergeQueueEntry as GQLMergeQueueEntry;

    return {
        events,
        hasMore: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor ?? undefined,
        commentReactions,
        currentUserLogin: result.viewer.login,
        mergeQueueEntry,
    };
}

export async function getSubjectReactions(
    accessToken: string,
    subjectId: string,
): Promise<
    { databaseId: number; content: string; user: { login: string } | null }[]
> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        node: {
            reactions: {
                nodes: ({
                    databaseId: number;
                    content: string;
                    user: { login: string } | null;
                } | null)[];
            } | null;
        } | null;
    }>(
        `
		query($subjectId: ID!) {
			node(id: $subjectId) {
				... on Reactable {
					reactions(first: 10) {
						nodes {
							databaseId
							content
							user { login }
						}
					}
				}
			}
		}
	`,
        { subjectId },
    );

    return (
        result.node?.reactions?.nodes
            ?.filter(
                (
                    r,
                ): r is NonNullable<
                    (typeof result.node.reactions.nodes)[number]
                > => r !== null,
            )
            .map((r) => ({
                databaseId: r.databaseId,
                content: CONTENT_MAP[r.content] ?? r.content.toLowerCase(),
                user: r.user,
            })) ?? []
    );
}

export type GQLPullRequestReactions = {
    reactions: Array<{
        id: number;
        node_id: string;
        content: string;
        created_at: string;
        user: { login: string } | null;
    }>;
    counts: {
        total_count: number;
        "+1": number;
        "-1": number;
        laugh: number;
        confused: number;
        heart: number;
        hooray: number;
        rocket: number;
        eyes: number;
    };
};

/**
 * Fetches a pull request's first page of reactions plus per-content totals
 * in one graphql call. The shape mirrors the REST reactions list and the
 * issue-level reactions summary so existing consumers are unaffected.
 */
export async function getPullRequestReactionsGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<GQLPullRequestReactions> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            pullRequest: {
                reactions: {
                    nodes: ({
                        databaseId: number;
                        id: string;
                        content: string;
                        createdAt: string;
                        user: { login: string } | null;
                    } | null)[];
                } | null;
                reactionGroups: Array<{
                    content: string;
                    reactors: { totalCount: number };
                }> | null;
            } | null;
        } | null;
    }>(
        `
		query($owner: String!, $repo: String!, $number: Int!) {
			repository(owner: $owner, name: $repo) {
				pullRequest(number: $number) {
					reactions(first: 100) {
						nodes {
							databaseId
							id
							content
							createdAt
							user { login }
						}
					}
					reactionGroups {
						content
						reactors {
							totalCount
						}
					}
				}
			}
		}
	`,
        { owner, repo, number: pullNumber },
    );

    const reactions = (result.repository?.pullRequest?.reactions?.nodes ?? [])
        .filter(
            (
                r,
            ): r is {
                databaseId: number;
                id: string;
                content: string;
                createdAt: string;
                user: { login: string } | null;
            } => r !== null,
        )
        .map((r) => ({
            id: r.databaseId,
            node_id: r.id,
            content: CONTENT_MAP[r.content] ?? r.content.toLowerCase(),
            created_at: r.createdAt,
            user: r.user,
        }));

    const counts: GQLPullRequestReactions["counts"] = {
        total_count: 0,
        "+1": 0,
        "-1": 0,
        laugh: 0,
        confused: 0,
        heart: 0,
        hooray: 0,
        rocket: 0,
        eyes: 0,
    };
    for (const group of result.repository?.pullRequest?.reactionGroups ?? []) {
        const key = CONTENT_MAP[group.content];
        if (key && key in counts && key !== "total_count") {
            counts[key as keyof Omit<typeof counts, "total_count">] =
                group.reactors.totalCount;
            counts.total_count += group.reactors.totalCount;
        }
    }

    return { reactions, counts };
}

export interface GqlCommitChecks {
    checkRuns: Array<{
        name: string;
        status: string;
        conclusion: string | null;
        title: string | null;
        summary: string | null;
        detailsUrl: string | null;
        url: string | null;
        startedAt: string | null;
        completedAt: string | null;
        app: { name: string; logoUrl: string | null } | null;
    }>;
    statuses: Array<{
        context: string;
        description: string | null;
        state: string;
        targetUrl: string | null;
        createdAt: string;
        updatedAt: string;
        creator: { login: string; avatarUrl: string; url: string } | null;
    }>;
}

/**
 * Returns a commit's check runs and legacy commit statuses from its
 * statusCheckRollup in one call. The rollup mixes CheckRun and StatusContext
 * nodes, mirroring what REST checks.listForRef + listCommitStatusesForRef
 * returned separately, but without check run output text.
 */
export async function getCommitChecksGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
): Promise<GqlCommitChecks> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            object: {
                statusCheckRollup: {
                    contexts: {
                        nodes: ({
                            __typename: string;
                            name?: string;
                            status?: string;
                            conclusion?: string | null;
                            title?: string | null;
                            summary?: string | null;
                            detailsUrl?: string | null;
                            url?: string | null;
                            startedAt?: string | null;
                            completedAt?: string | null;
                            checkSuite?: {
                                app: {
                                    name: string;
                                    logoUrl: string | null;
                                } | null;
                            } | null;
                            context?: string;
                            description?: string | null;
                            state?: string;
                            targetUrl?: string | null;
                            createdAt?: string;
                            updatedAt?: string;
                            creator?: {
                                login: string;
                                avatarUrl: string;
                                url: string;
                            } | null;
                        } | null)[];
                    } | null;
                } | null;
            } | null;
        } | null;
    }>(
        `
		query CommitChecks($owner: String!, $repo: String!, $expression: String!) {
			repository(owner: $owner, name: $repo) {
				object(expression: $expression) {
					... on Commit {
						statusCheckRollup {
							contexts(first: 100) {
								nodes {
									__typename
									... on CheckRun {
										name
										status
										conclusion
										title
										summary
										detailsUrl
										url
										startedAt
										completedAt
										checkSuite {
											app {
												name
												logoUrl
											}
										}
									}
									... on StatusContext {
										context
										description
										state
										targetUrl
										createdAt
										updatedAt
										creator {
											login
											avatarUrl
											url
										}
									}
								}
							}
						}
					}
				}
			}
		}
	`,
        { owner, repo, expression: commitSha },
    );

    const nodes = result.repository?.object?.statusCheckRollup?.contexts?.nodes;

    const checkRuns: GqlCommitChecks["checkRuns"] = [];
    const statuses: GqlCommitChecks["statuses"] = [];
    for (const node of nodes ?? []) {
        if (!node) continue;
        if (node.__typename === "CheckRun") {
            checkRuns.push({
                name: node.name ?? "",
                status: (node.status ?? "").toLowerCase(),
                conclusion: node.conclusion?.toLowerCase() ?? null,
                title: node.title ?? null,
                summary: node.summary ?? null,
                detailsUrl: node.detailsUrl ?? null,
                url: node.url ?? null,
                startedAt: node.startedAt ?? null,
                completedAt: node.completedAt ?? null,
                app: node.checkSuite?.app
                    ? {
                          name: node.checkSuite.app.name,
                          logoUrl: node.checkSuite.app.logoUrl,
                      }
                    : null,
            });
        } else if (node.__typename === "StatusContext") {
            statuses.push({
                context: node.context ?? "",
                description: node.description ?? null,
                state: (node.state ?? "").toLowerCase(),
                targetUrl: node.targetUrl ?? null,
                createdAt: node.createdAt ?? "",
                updatedAt: node.updatedAt ?? "",
                creator: node.creator ?? null,
            });
        }
    }

    return { checkRuns, statuses };
}

const GRAPHQL_CONTENT_MAP: Record<string, string> = {
    "+1": "THUMBS_UP",
    "-1": "THUMBS_DOWN",
    laugh: "LAUGH",
    hooray: "HOORAY",
    confused: "CONFUSED",
    heart: "HEART",
    rocket: "ROCKET",
    eyes: "EYES",
};

export async function addReaction(
    accessToken: string,
    subjectId: string,
    content: string,
) {
    const graphql = createGraphql(accessToken);

    const gqlContent = GRAPHQL_CONTENT_MAP[content] ?? content;

    const result = await graphql<{
        addReaction: {
            reaction: {
                id: string;
                content: string;
                user: { login: string } | null;
            } | null;
        };
    }>(
        `
		mutation($subjectId: ID!, $content: ReactionContent!) {
			addReaction(input: {subjectId: $subjectId, content: $content}) {
				reaction {
					id
					content
					user { login }
				}
			}
		}
	`,
        { subjectId, content: gqlContent },
    );

    return result.addReaction.reaction;
}

export interface GqlPrSearchItem {
    databaseId: number;
    number: number;
    title: string;
    state: string;
    isDraft: boolean;
    createdAt: string;
    mergedAt: string | null;
    author: { login: string; avatarUrl: string; url: string } | null;
    labels: {
        nodes: Array<{
            id: string;
            name: string;
            color: string;
            description: string | null;
        }>;
    };
    assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
    comments: { totalCount: number };
    reviewDecision: string | null;
    stack: { size: number; number: number } | null;
    stackEntry: { position: number } | null;
}

export interface GqlPrSearchResult {
    search: {
        issueCount: number;
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        nodes: Array<
            | ({ __typename: "PullRequest" } & GqlPrSearchItem)
            | { __typename: string }
            | null
        >;
    };
}

const PR_SEARCH_QUERY = `
query SearchPRs($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      __typename
      ... on PullRequest {
        databaseId
        number
        title
        state
        isDraft
        createdAt
        mergedAt
        author { login avatarUrl url }
        labels(first: 10) {
          nodes { id name color description }
        }
        assignees(first: 3) {
          nodes { login avatarUrl }
        }
        comments { totalCount }
        reviewDecision
        stack {
          size
          number
        }
        stackEntry {
          position
        }
      }
    }
  }
}
`;

const COUNT_PR_QUERY = `
query CountPRs($openQuery: String!, $closedQuery: String!, $mergedQuery: String!) {
  open: search(query: $openQuery, type: ISSUE, first: 1) { issueCount }
  closed: search(query: $closedQuery, type: ISSUE, first: 1) { issueCount }
  merged: search(query: $mergedQuery, type: ISSUE, first: 1) { issueCount }
}
`;

type CountPrQueryResult = {
    open: { issueCount: number };
    closed: { issueCount: number };
    merged: { issueCount: number };
};

export async function searchPullRequestsWithStatus(
    accessToken: string,
    query: string,
    first: number = 30,
    after: string | null = null,
    countQueries: { open: string; closed: string; merged: string },
) {
    const graphql = createGraphql(accessToken);

    const promises: [
        Promise<GqlPrSearchResult>,
        ...Promise<CountPrQueryResult>[],
    ] = [
        graphql<GqlPrSearchResult>(PR_SEARCH_QUERY, {
            searchQuery: query,
            first,
            after,
        }),
        graphql<CountPrQueryResult>(COUNT_PR_QUERY, {
            openQuery: countQueries.open,
            closedQuery: countQueries.closed,
            mergedQuery: countQueries.merged,
        }),
    ];

    const [result, countResult] = await Promise.all(promises);

    const items = result.search.nodes.filter(
        (n): n is { __typename: "PullRequest" } & GqlPrSearchItem =>
            n?.__typename === "PullRequest",
    );

    return {
        items,
        totalCount: result.search.issueCount,
        hasNextPage: result.search.pageInfo.hasNextPage,
        endCursor: result.search.pageInfo.endCursor,
        stateCounts: {
            open: countResult?.open?.issueCount ?? 0,
            closed: countResult?.closed?.issueCount ?? 0,
            merged: countResult?.merged?.issueCount ?? 0,
        },
    };
}

export interface GqlIssueSearchItem {
    databaseId: number;
    number: number;
    title: string;
    state: string;
    createdAt: string;
    closedAt: string | null;
    author: { login: string; avatarUrl: string; url: string } | null;
    labels: {
        nodes: Array<{
            id: string;
            name: string;
            color: string;
            description: string | null;
        }>;
    };
    assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
    comments: { totalCount: number };
}

const ISSUE_SEARCH_QUERY = `
query SearchIssues($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      __typename
      ... on Issue {
        databaseId
        number
        title
        state
        createdAt
        closedAt
        author { login avatarUrl url }
        labels(first: 10) {
          nodes { id name color description }
        }
        assignees(first: 5) {
          nodes { login avatarUrl }
        }
        comments { totalCount }
      }
    }
  }
}
`;

const COUNT_ISSUE_QUERY = `
query CountIssues($openQuery: String!, $closedQuery: String!) {
  open: search(query: $openQuery, type: ISSUE, first: 1) { issueCount }
  closed: search(query: $closedQuery, type: ISSUE, first: 1) { issueCount }
}
`;

type CountIssueQueryResult = {
    open: { issueCount: number };
    closed: { issueCount: number };
};

export async function searchIssuesWithMetadata(
    accessToken: string,
    query: string,
    first: number = 30,
    after: string | null = null,
    countQueries: { open: string; closed: string },
) {
    const graphql = createGraphql(accessToken);

    type IssueSearchResult = {
        search: {
            issueCount: number;
            pageInfo: { endCursor: string | null; hasNextPage: boolean };
            nodes: Array<
                | ({ __typename: "Issue" } & GqlIssueSearchItem)
                | { __typename: string }
                | null
            >;
        };
    };

    const promises: [
        Promise<IssueSearchResult>,
        ...Promise<CountIssueQueryResult>[],
    ] = [
        graphql<IssueSearchResult>(ISSUE_SEARCH_QUERY, {
            searchQuery: query,
            first,
            after,
        }),
        graphql<CountIssueQueryResult>(COUNT_ISSUE_QUERY, {
            openQuery: countQueries.open,
            closedQuery: countQueries.closed,
        }),
    ];

    const [result, countResult] = await Promise.all(promises);

    const items = result.search.nodes.filter(
        (n): n is { __typename: "Issue" } & GqlIssueSearchItem =>
            n?.__typename === "Issue",
    );

    return {
        items,
        totalCount: result.search.issueCount,
        hasNextPage: result.search.pageInfo.hasNextPage,
        endCursor: result.search.pageInfo.endCursor,
        stateCounts: {
            open: countResult?.open?.issueCount ?? 0,
            closed: countResult?.closed?.issueCount ?? 0,
        },
    };
}

export async function removeReaction(
    accessToken: string,
    subjectId: string,
    content: string,
) {
    const graphql = createGraphql(accessToken);

    const gqlContent = GRAPHQL_CONTENT_MAP[content] ?? content;

    await graphql(
        `
		mutation($subjectId: ID!, $content: ReactionContent!) {
			removeReaction(input: {subjectId: $subjectId, content: $content}) {
				subject { id }
			}
		}
	`,
        { subjectId, content: gqlContent },
    );
}

export type GQLCommitWithAuthors = {
    oid: string;
    message: string;
    committedDate?: string;
    authors: GQLCommitAuthor[];
    signature?: GQLGitSignature | null;
};

const NOREPLY_EMAIL_PATTERN = /^(\d+)\+([^@]+)@users\.noreply\.github\.com$/;

// GitHub's GraphQL Commit.authors.user sometimes fails to resolve a commit
// author whose git email is a noreply address (ID+login@users.noreply.github.com),
// even though REST resolves it. The email format itself encodes the account,
// so synthesize the user instead of rendering the author as unknown.
export function resolveCommitAuthor(author: GQLCommitAuthor): GQLCommitAuthor {
    if (author.user) return author;

    const match = author.email?.match(NOREPLY_EMAIL_PATTERN);
    if (!match || match[1] === undefined || match[2] === undefined) {
        return author;
    }

    const id = match[1];
    const login = match[2];
    const user: GQLActor = {
        __typename: "User",
        login,
        avatarUrl: `https://avatars.githubusercontent.com/u/${id}?v=4`,
        url: `https://github.com/${login}`,
    };
    return { ...author, avatarUrl: user.avatarUrl, user };
}

function toCommitAuthors(
    authors: GQLCommitFields["authors"],
): GQLCommitAuthor[] {
    return (authors?.nodes ?? [])
        .filter((a): a is GQLCommitAuthor => a !== null)
        .map(resolveCommitAuthor);
}

export async function getPullRequestCommitsGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    limit: number,
    after?: string,
): Promise<{
    commits: GQLCommitWithAuthors[];
    hasNext: boolean;
    endCursor: string | undefined;
}> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            pullRequest: {
                commits: {
                    nodes: {
                        commit: GQLCommitFields | null;
                    }[];
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                };
            };
        };
    }>(PR_COMMITS_QUERY, {
        owner,
        repo,
        number: pullNumber,
        first: limit,
        after: after ?? undefined,
    });

    const nodes = result.repository.pullRequest.commits.nodes.filter(
        (n): n is { commit: GQLCommitFields } => n.commit !== null,
    );

    const commits: GQLCommitWithAuthors[] = nodes.map((n) => ({
        oid: n.commit.oid,
        message: n.commit.message,
        committedDate: n.commit.committedDate,
        authors: toCommitAuthors(n.commit.authors),
        signature: n.commit.signature,
    }));

    return {
        commits,
        hasNext: result.repository.pullRequest.commits.pageInfo.hasNextPage,
        endCursor:
            result.repository.pullRequest.commits.pageInfo.endCursor ??
            undefined,
    };
}

export async function getAllPullRequestCommitsGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<GQLCommitWithAuthors[]> {
    const commits: GQLCommitWithAuthors[] = [];
    let after: string | undefined;
    while (true) {
        const page = await getPullRequestCommitsGraphQL(
            accessToken,
            owner,
            repo,
            pullNumber,
            100,
            after,
        );
        commits.push(...page.commits);
        if (!page.hasNext || page.endCursor === undefined) break;
        after = page.endCursor;
    }
    return commits;
}

export async function getPullRequestHeadShaGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<string | null> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            pullRequest: { headRefOid: string | null } | null;
        };
    }>(PULL_REQUEST_HEAD_SHA_QUERY, {
        owner,
        repo,
        number: pullNumber,
    });

    return result.repository.pullRequest?.headRefOid ?? null;
}

export async function getCommitGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    oid: string,
): Promise<GQLCommitWithAuthors> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            object: GQLCommitFields | null;
        };
    }>(COMMIT_BY_OID_QUERY, {
        owner,
        repo,
        oid,
    });

    const commit = result.repository.object;
    if (!commit) {
        throw new Error(`Commit ${oid} not found`);
    }

    return {
        oid: commit.oid,
        message: commit.message,
        committedDate: commit.committedDate,
        authors: toCommitAuthors(commit.authors),
        signature: commit.signature,
    };
}

export interface BranchCommitsResult {
    commits: (Omit<GQLCommitWithAuthors, "signature"> & {
        signature?: GQLGitSignatureSummary | null;
        statusCheckRollup: {
            state: string;
            contexts: {
                nodes: Array<{
                    __typename?: string;
                    state?: string;
                    targetUrl?: string | null;
                    description?: string | null;
                    context?: string;
                    name?: string;
                    status?: string;
                    conclusion?: string | null;
                    detailsUrl?: string | null;
                    createdAt?: string;
                    startedAt?: string;
                    completedAt?: string;
                } | null> | null;
            };
        } | null;
    })[];
    totalCount: number;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string | null;
        endCursor: string | null;
    };
}

export async function getBranchCommitsGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
    opts: {
        first?: number;
        last?: number;
        after?: string;
        before?: string;
        authorId?: string;
    },
): Promise<BranchCommitsResult> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            ref: {
                target: {
                    history: {
                        totalCount: number;
                        pageInfo: {
                            hasNextPage: boolean;
                            hasPreviousPage: boolean;
                            startCursor: string | null;
                            endCursor: string | null;
                        };
                        nodes: Array<{
                            oid: string;
                            message: string;
                            committedDate: string;
                            authors: {
                                nodes: Array<{
                                    name: string;
                                    avatarUrl: string;
                                    user: {
                                        __typename: string;
                                        login: string;
                                        avatarUrl: string;
                                        url: string;
                                    } | null;
                                } | null>;
                            };
                            statusCheckRollup: {
                                state: string;
                                contexts: {
                                    nodes: Array<{
                                        __typename?: string;
                                        state?: string;
                                        targetUrl?: string | null;
                                        description?: string | null;
                                        context?: string;
                                        name?: string;
                                        status?: string;
                                        conclusion?: string | null;
                                        detailsUrl?: string | null;
                                        createdAt?: string;
                                        startedAt?: string;
                                        completedAt?: string;
                                    } | null> | null;
                                };
                            } | null;
                            signature: GQLGitSignatureSummary | null;
                        }>;
                    };
                } | null;
            } | null;
        };
    }>(BRANCH_COMMITS_QUERY, {
        owner,
        repo,
        branch,
        first: opts.first,
        last: opts.last,
        after: opts.after,
        before: opts.before,
        author: opts.authorId ? { id: opts.authorId } : null,
    });

    const ref = result.repository.ref;
    if (!ref) {
        throw new Error(`Branch ${branch} not found in ${owner}/${repo}`);
    }
    const target = ref.target;
    if (!target) {
        throw new Error(`Branch ${branch} not found in ${owner}/${repo}`);
    }
    const history = target.history;

    return {
        commits: history.nodes.map((node) => ({
            oid: node.oid,
            message: node.message,
            committedDate: node.committedDate,
            authors: toCommitAuthors(node.authors),
            signature: node.signature,
            statusCheckRollup: node.statusCheckRollup,
        })),
        totalCount: history.totalCount,
        pageInfo: history.pageInfo,
    };
}

export async function resolveUserNodeId(
    accessToken: string,
    login: string,
): Promise<string | null> {
    const graphql = createGraphql(accessToken);
    const result = await graphql<{
        user: { id: string } | null;
    }>(`query($login: String!) { user(login: $login) { id } }`, { login });
    return result.user?.id ?? null;
}

const TOP_REPOS_QUERY = `
query TopRepositories($first: Int!) {
    viewer {
        topRepositories(first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
                name
                nameWithOwner
                isPrivate
                description
                owner {
                    login
                    avatarUrl
                }
            }
        }
    }
}
`;

export interface GqlTopRepo {
    name: string;
    nameWithOwner: string;
    isPrivate: boolean;
    description: string | null;
    owner: {
        login: string;
        avatarUrl: string;
    };
}

interface GqlTopReposResult {
    viewer: {
        topRepositories: {
            nodes: (GqlTopRepo | null)[];
        } | null;
    };
}

export async function getTopRepositories(
    accessToken: string,
): Promise<GqlTopRepo[]> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<GqlTopReposResult>(TOP_REPOS_QUERY, {
        first: 10,
    });

    const nodes = result.viewer.topRepositories?.nodes ?? [];
    return nodes.filter((n): n is GqlTopRepo => n !== null);
}

const STACK_QUERY = `
query($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $prNumber) {
      stack {
        id
        number
        baseRefName
        entries(first: 100) {
          nodes {
            position
            pullRequest {
              number
              title
              state
              isDraft
              mergeable
              headRefName
            }
          }
        }
      }
    }
  }
}
`;

export interface StackData {
    id: number;
    number: number;
    baseRef: string;
    open: boolean;
    createdAt: string;
    pullRequests: StackEntry[];
}

export interface StackEntry {
    number: number;
    position?: number;
    state: "open" | "closed" | "merged";
    draft: boolean;
    title: string;
    mergeable?: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
    headRef: string;
}

export async function getPullRequestStackGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
): Promise<StackData | null> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository: {
            pullRequest: {
                stack: {
                    id: string;
                    number: number;
                    baseRefName: string;
                    entries: {
                        nodes: {
                            position: number;
                            pullRequest: {
                                number: number;
                                title: string;
                                state: "OPEN" | "CLOSED" | "MERGED";
                                isDraft: boolean;
                                mergeable:
                                    | "MERGEABLE"
                                    | "CONFLICTING"
                                    | "UNKNOWN";
                                headRefName: string;
                            };
                        }[];
                    };
                } | null;
            };
        };
    }>(STACK_QUERY, { owner, repo, prNumber });

    const stack = result.repository.pullRequest.stack;
    if (!stack) return null;

    // entries are ordered bottom-to-top; reverse for descending position (top first)
    const pullRequests = stack.entries.nodes
        .map((e) => ({
            number: e.pullRequest.number,
            position: e.position,
            state:
                e.pullRequest.state === "OPEN"
                    ? ("open" as const)
                    : e.pullRequest.state === "MERGED"
                      ? ("merged" as const)
                      : ("closed" as const),
            mergeable: e.pullRequest.mergeable,
            draft: e.pullRequest.isDraft,
            title: e.pullRequest.title,
            headRef: e.pullRequest.headRefName,
        }))
        .reverse();

    return {
        id: parseInt(stack.id, 10),
        number: stack.number,
        baseRef: stack.baseRefName,
        // not exposed via PullRequest.stack; unused by the UI
        open: true as const,
        createdAt: "",
        pullRequests,
    };
}

const ARCHIVED_AT_QUERY = `
query RepoArchivedAt($owner: String!, $repo: String!) {
	repository(owner: $owner, name: $repo) {
		archivedAt
	}
}
`;

export async function getArchivedAtGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<string | null> {
    const graphql = createGraphql(accessToken);
    const result = await graphql<{
        repository: { archivedAt: string | null } | null;
    }>(ARCHIVED_AT_QUERY, { owner, repo });
    return result.repository?.archivedAt ?? null;
}
