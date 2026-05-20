import { graphql as octokitGraphql } from "@octokit/graphql";

// NOTE: The itemType filter is an explict whitelist because of https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions
// Some event types ADDED_TO_PROJECT_V2_EVENT and PROJECT_V2_ITEM_STATUS_CHANGED_EVENT (and maybe others) will
// result in the entire API call failing.

const TIMELINE_QUERY = `
fragment SimpleUser on Actor {
	login
	avatarUrl
	url
}

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
				PULL_REQUEST_COMMIT,
				REVIEW_DISMISSED_EVENT
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
						reactions(first: 10) {
							nodes {
								databaseId
								content
								createdAt
								user { login }
							}
						}
					}
					... on PullRequestReview {
						id
						databaseId
						author { login avatarUrl url }
						body
						state
						submittedAt
						createdAt
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
					}
					... on LabeledEvent {
						id
						actor { ...SimpleUser }
						createdAt
						label { name color }
					}
					... on UnlabeledEvent {
						id
						actor { ...SimpleUser }
						createdAt
						label { name color }
					}
					... on RenamedTitleEvent {
						id
						actor { ...SimpleUser }
						createdAt
						previousTitle
						currentTitle
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
					... on PullRequestCommit {
						id
						commit { oid message committedDate }
					}
					... on ReviewDismissedEvent {
						id
						actor { ...SimpleUser }
						createdAt
						dismissalMessage
					}
				}
				pageInfo {
					hasNextPage
					endCursor
				}
			}
		}
	}
	viewer { login }
}
`;

export type GQLActor = {
    login: string;
    avatarUrl: string;
    url: string;
};

export type GQLReactionNode = {
    databaseId: number;
    content: string;
    createdAt: string;
    user: { login: string } | null;
};

export type GQLLabel = { name: string; color: string };

export type GQLIssueComment = {
    __typename: "IssueComment";
    id: string;
    databaseId: number;
    body: string;
    author: GQLActor | null;
    createdAt: string;
    authorAssociation: string;
    reactions: { nodes: (GQLReactionNode | null)[] };
};

export type GQLPullRequestReview = {
    __typename: "PullRequestReview";
    id: string;
    databaseId: number;
    state: string;
    body: string;
    author: GQLActor | null;
    submittedAt: string | null;
    createdAt: string;
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

export type GQLPullRequestCommit = {
    __typename: "PullRequestCommit";
    id: string;
    commit: {
        oid: string;
        message: string;
        committedDate?: string;
    } | null;
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

export type GQLTimelineEvent =
    | GQLIssueComment
    | GQLPullRequestReview
    | GQLHeadRefForcePushedEvent
    | GQLHeadRefDeletedEvent
    | GQLHeadRefRestoredEvent
    | GQLCrossReferencedEvent
    | GQLAssignedEvent
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
    | GQLPullRequestCommit
    | GQLReviewDismissedEvent
    | GQLMentionedEvent
    | GQLSubscribedEvent;

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
) {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

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

    const events = rawNodes;
    const pageInfo = result.repository.pullRequest.timelineItems.pageInfo;

    const commentReactions: Record<
        number,
        {
            databaseId: number;
            content: string;
            createdAt: string;
            user: { login: string } | null;
        }[]
    > = {};

    for (const node of rawNodes) {
        if (node.__typename === "IssueComment") {
            const { reactions, databaseId } = node;
            if (databaseId && reactions?.nodes) {
                commentReactions[databaseId] = reactions.nodes
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

    return {
        events,
        hasMore: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor ?? undefined,
        commentReactions,
        currentUserLogin: result.viewer.login,
    };
}
