import { graphql as octokitGraphql } from "@octokit/graphql";
import type { TimelineEventData } from "./github";

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
			timelineItems(first: $first, after: $after) {
				nodes {
					__typename
					... on IssueComment {
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
						databaseId
						state
						body
						author { ...SimpleUser }
						submittedAt
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

type SimpleUser = {
	login: string;
	avatarUrl: string;
	url: string;
};

function mapUser(
	user: SimpleUser | null | undefined,
): Record<string, unknown> | null {
	if (!user) return null;
	return {
		login: user.login,
		id: 0,
		node_id: "",
		avatar_url: user.avatarUrl,
		gravatar_id: "",
		url: user.url,
		html_url: user.url,
		followers_url: "",
		following_url: "",
		gists_url: "",
		starred_url: "",
		subscriptions_url: "",
		organizations_url: "",
		repos_url: "",
		events_url: "",
		received_events_url: "",
		type: "User",
		site_admin: false,
	};
}

function mapReactionContent(content: string): string {
	if (content === "THUMBS_UP") return "+1";
	if (content === "THUMBS_DOWN") return "-1";
	return content.toLowerCase();
}

function transformNode(node: Record<string, unknown>): TimelineEventData {
	const typename = node.__typename as string;

	switch (typename) {
		case "IssueComment": {
			const author = node.author as SimpleUser | null | undefined;
			const user = mapUser(author);
			return {
				event: "commented",
				id: (node.databaseId as number) ?? 0,
				node_id: node.id as string,
				url: "",
				body: (node.body as string) ?? "",
				actor: user,
				user,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				author_association: (node.authorAssociation as string) ?? "NONE",
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "PullRequestReview": {
			const author = node.author as SimpleUser | null | undefined;
			const state = (node.state as string) ?? "";
			const stateMap: Record<string, string> = {
				APPROVED: "approved",
				CHANGES_REQUESTED: "changes_requested",
				COMMENTED: "commented",
				PENDING: "pending",
				DISMISSED: "dismissed",
			};
			return {
				event: "reviewed",
				id: (node.databaseId as number) ?? 0,
				node_id: node.id as string,
				url: "",
				user: mapUser(author),
				body: (node.body as string) ?? "",
				state: stateMap[state] ?? state.toLowerCase(),
				submitted_at: node.submittedAt as string,
				updated_at: node.submittedAt as string,
				commit_id: null,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "HeadRefForcePushedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "head_ref_force_pushed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				commit_id:
					((node.afterCommit as { oid?: string } | null)?.oid as string) ?? "",
				commit_url: null,
				created_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "HeadRefDeletedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "head_ref_deleted",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "HeadRefRestoredEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "head_ref_restored",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "CrossReferencedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const source = node.source as Record<string, unknown> | null;
			return {
				event: "cross-referenced",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				source: source
					? {
							type: (source.__typename as string)?.toLowerCase() ?? "",
							issue: {
								number: source.number as number,
								title: source.title as string,
								state: source.state as string,
								locked: false,
								html_url: source.url as string,
								pull_request:
									(source.__typename as string) === "PullRequest"
										? {}
										: undefined,
								repository: {
									name: ((source.repository as Record<string, unknown>)
										?.name as string),
									owner: {
										login: (
											(source.repository as Record<string, unknown>)
												?.owner as Record<string, unknown>
										)?.login as string,
									},
									full_name: "",
									html_url: "",
								},
							},
						}
					: null,
			} as TimelineEventData;
		}

		case "AssignedEvent":
		case "UnassignedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const assignee = node.assignee as SimpleUser | null | undefined;
			return {
				event: typename === "AssignedEvent" ? "assigned" : "unassigned",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				assignee: mapUser(assignee ?? actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ClosedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "closed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ReopenedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "reopened",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "MergedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "merged",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
			} as TimelineEventData;
		}

		case "LabeledEvent":
		case "UnlabeledEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const label = node.label as { name?: string; color?: string } | null;
			return {
				event: typename === "LabeledEvent" ? "labeled" : "unlabeled",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				label: label
					? { name: label.name ?? "", color: label.color ?? "" }
					: undefined,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "RenamedTitleEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "renamed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				rename: {
					from: (node.previousTitle as string) ?? "",
					to: (node.currentTitle as string) ?? "",
				},
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "LockedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "locked",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				lock_reason: (node.lockReason as string) ?? null,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "UnlockedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "unlocked",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				lock_reason: null,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "MilestonedEvent":
		case "DemilestonedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const milestoneTitle = node.milestoneTitle as string | null | undefined;
			return {
				event: typename === "MilestonedEvent" ? "milestoned" : "demilestoned",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				milestone: milestoneTitle
					? { title: milestoneTitle }
					: undefined,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ReviewRequestedEvent":
		case "ReviewRequestRemovedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const requestedReviewer = node.requestedReviewer as Record<
				string,
				unknown
			> | null;
			const isUser =
				requestedReviewer?.__typename === "User";
			const isTeam =
				requestedReviewer?.__typename === "Team";
			return {
				event:
					typename === "ReviewRequestedEvent"
						? "review_requested"
						: "review_request_removed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				requested_reviewer: isUser
					? mapUser(requestedReviewer as unknown as SimpleUser)
					: null,
				requested_team: isTeam
					? {
							name: (requestedReviewer?.name as string) ?? undefined,
							slug: (requestedReviewer?.slug as string) ?? "",
						}
					: undefined,
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ConvertToDraftEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "convert_to_draft",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ReadyForReviewEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "ready_for_review",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ReferencedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			const commit = node.commit as Record<string, unknown> | null;
			const commitRepo = node.commitRepository as Record<
				string,
				unknown
			> | null;
			return {
				event: "referenced",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				commit_id: (commit?.oid as string) ?? "",
				commit_url: (commit?.commitUrl as string) ?? null,
				created_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "PullRequestCommit": {
			const commit = node.commit as Record<string, unknown> | null;
			return {
				event: "committed",
				id: 0,
				node_id: node.id as string,
				url: "",
				sha: (commit?.oid as string) ?? "",
				message: (commit?.message as string) ?? "",
			} as TimelineEventData;
		}

		case "AddedToProjectV2Event": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "added_to_project_v2",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ProjectV2ItemStatusChangedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "project_v2_item_status_changed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "CommentDeletedEvent": {
			const deletedAuthor = node.deletedCommentAuthor as SimpleUser | null | undefined;
			return {
				event: "commented",
				id: 0,
				node_id: node.id as string,
				url: "",
				body: null,
				actor: mapUser(deletedAuthor ?? (node.actor as SimpleUser | null | undefined)),
				user: mapUser(deletedAuthor ?? (node.actor as SimpleUser | null | undefined)),
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				author_association: "NONE",
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "ReviewDismissedEvent": {
			const actor = node.actor as SimpleUser | null | undefined;
			return {
				event: "review_dismissed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(actor),
				dismissed_review: {
					dismissal_message: (node.dismissalMessage as string) ?? "",
				},
				created_at: node.createdAt as string,
				updated_at: node.createdAt as string,
				performed_via_github_app: null,
			} as TimelineEventData;
		}

		case "MentionedEvent":
			return {
				event: "mentioned",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(node.actor as SimpleUser | null | undefined),
				created_at: (node.createdAt as string) ?? "",
			} as TimelineEventData;

		case "SubscribedEvent":
			return {
				event: "subscribed",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(node.actor as SimpleUser | null | undefined),
				created_at: (node.createdAt as string) ?? "",
			} as TimelineEventData;

		default:
			return {
				event: typename ?? "unknown",
				id: 0,
				node_id: node.id as string,
				url: "",
				actor: mapUser(node.actor as SimpleUser | null | undefined),
				created_at: (node.createdAt as string) ?? "",
			} as TimelineEventData;
	}
}

type ReactionNode = {
	databaseId: number;
	content: string;
	createdAt: string;
	user: { login: string } | null;
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
		headers: {
			authorization: `bearer ${accessToken}`,
		},
	});

	const result = await graphql<{
		repository: {
			pullRequest: {
				timelineItems: {
					nodes: Record<string, unknown>[];
					pageInfo: { hasNextPage: boolean; endCursor: string | null };
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
	);

	const events: TimelineEventData[] = [];
	const commentReactions: Record<number, { id: number; node_id: string; user: { login: string; avatar_url: string; html_url: string; id: number; node_id: string; gravatar_id: string; url: string; received_events_url: string; type: string; site_admin: boolean } | null; content: string; created_at: string }[]> = {};

	for (const node of rawNodes) {
		const event = transformNode(node);
		events.push(event);

		if (node.__typename === "IssueComment") {
			const commentId = (node as Record<string, unknown>).databaseId as number;
			const reactions = (node as Record<string, unknown>)
				.reactions as unknown as {
				nodes: ReactionNode[];
			} | null;
			if (commentId && reactions?.nodes) {
				commentReactions[commentId] = reactions.nodes
					.filter(Boolean)
					.map((r) => ({
						id: r.databaseId,
						node_id: "",
						user: r.user
							? {
									login: r.user.login,
									avatar_url: "",
									html_url: "",
									id: 0,
									node_id: "",
									gravatar_id: "",
									url: "",
									received_events_url: "",
									type: "User",
									site_admin: false,
								}
							: null,
						content: mapReactionContent(r.content),
						created_at: r.createdAt,
					}));
			}
		}
	}

	const pageInfo = result.repository.pullRequest.timelineItems.pageInfo;

	return {
		events,
		hasMore: pageInfo.hasNextPage,
		endCursor: pageInfo.endCursor ?? undefined,
		commentReactions,
		currentUserLogin: result.viewer.login,
	};
}
