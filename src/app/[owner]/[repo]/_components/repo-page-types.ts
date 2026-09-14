import type { DocFileName } from "~/lib/doc-files";

export interface RepoData {
    ownerAvatarUrl: string;
    isPrivate: boolean;
    stars: number;
    forks: number;
    watchers: number;
    description: string | null;
    defaultBranch: string;
    homepage: string | null;
    language: string | null;
    topics: string[];
    license: { spdxId: string | null; name: string; url: string | null } | null;
    createdAt: string;
    isFork: boolean;
    parentFullName: string | null;
    parentDefaultBranch: string | null;
}

export interface Contributor {
    login: string | null;
    avatarUrl: string | null;
}

export interface Deployment {
    id: string;
    environment: string;
    state: string;
    createdAt: string;
}

export interface Release {
    name: string;
    tagName: string;
    createdAt: string;
    htmlUrl: string;
}

export interface SubscriptionState {
    subscribed: boolean;
    ignored: boolean;
}

/**
 * The queries every repo page view shares. Started on the server so the
 * header and sidebar stream in with the page-specific content, then spread
 * into the view that renders them.
 */
export interface RepoPageData {
    repoDataPromise: Promise<RepoData>;
    contributorsPromise: Promise<Contributor[]>;
    docFileNamesPromise: Promise<DocFileName[]>;
    languagesPromise: Promise<Record<string, number>>;
    deploymentsPromise: Promise<Deployment[]>;
    latestReleasePromise: Promise<Release | null>;
    starredPromise: Promise<boolean>;
    subscriptionPromise: Promise<SubscriptionState | null>;
}
