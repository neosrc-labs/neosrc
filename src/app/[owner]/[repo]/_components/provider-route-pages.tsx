import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ActionsList } from "~/components/actions/actions-list";
import { BranchListShared } from "~/components/branch/branch-list-shared";
import { CommitsList } from "~/components/commit/commits-list";
import {
    cbConfig as cbCommitsConfig,
    ghConfig as ghCommitsConfig,
} from "~/components/commit/commits-list-config";
import { IssueDetailPage } from "~/components/issue/issue-detail-page";
import { IssueLayout } from "~/components/issue/issue-layout";
import { IssueList } from "~/components/issue/issue-list";
import {
    cbConfig as cbPullsConfig,
    ghConfig as ghPullsConfig,
} from "~/components/pull/pull-request-list-config";
import { PullRequestListShared } from "~/components/pull/pull-request-list-shared";
import { RepoBlobPage } from "~/components/repo/repo-blob-page";
import { RepoBrowseShell } from "~/components/repo/repo-browse-shell";
import { RepoCodePage } from "~/components/repo/repo-code-page";
import { RepoDirectoryPage } from "~/components/repo/repo-directory-page";
import { loadRepoPageData } from "~/components/repo/repo-page-data";
import { RepoTreePage } from "~/components/repo/repo-tree-page";
import { generateIssueMetadata } from "~/server/metadata";
import { type Provider, parseRepositoryReference } from "~/utils/provider-url";

interface ProviderProps {
    provider: Provider;
}

interface RepoParams {
    owner: string;
    repo: string;
}

export interface RepoPageProps {
    params: Promise<RepoParams>;
}

interface ListSearchParams {
    state?: string;
    q?: string;
    sort?: string;
    order?: string;
}

export interface RepoListPageProps extends RepoPageProps {
    searchParams: Promise<ListSearchParams>;
}

interface ReferenceParams extends RepoParams {
    branch: string;
    path?: string[];
}

export interface ReferencePageProps {
    params: Promise<ReferenceParams>;
    searchParams: Promise<{ refKind?: string | string[] }>;
}

interface IssueParams extends RepoParams {
    number: string;
}

export interface IssuePageProps {
    params: Promise<IssueParams>;
}

export interface ProviderLayoutProps {
    children: ReactNode;
    params: Promise<RepoParams>;
}

export interface IssueLayoutProps {
    children: ReactNode;
    params: Promise<IssueParams>;
}

async function namedRepoMetadata(
    label: string,
    params: Promise<RepoParams>,
): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${label} - ${owner}/${repo}` };
}

export async function generateRepoMetadata({
    params,
}: RepoPageProps): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${owner}/${repo}` };
}

export function generateActionsMetadata({ params }: RepoPageProps) {
    return namedRepoMetadata("Actions", params);
}

export function generateBranchesMetadata({ params }: RepoPageProps) {
    return namedRepoMetadata("Branches", params);
}

export function generateIssuesMetadata({ params }: RepoPageProps) {
    return namedRepoMetadata("Issues", params);
}

export function generatePullsMetadata({ params }: RepoPageProps) {
    return namedRepoMetadata("Pulls", params);
}

export async function generateCommitsMetadata({
    params,
}: ReferencePageProps): Promise<Metadata> {
    const { owner, repo, branch } = await params;
    return { title: `Commits - ${owner}/${repo}/${branch}` };
}

export async function generateBlobMetadata({
    params,
}: ReferencePageProps): Promise<Metadata> {
    const { owner, repo, branch, path } = await params;
    const name = path?.at(-1) ?? repo;
    return { title: `${name} at ${branch} - ${owner}/${repo}` };
}

export async function generateTreeMetadata({
    params,
}: ReferencePageProps): Promise<Metadata> {
    const { owner, repo, branch, path } = await params;
    return {
        title: `${path?.join("/") || repo} at ${branch} - ${owner}/${repo}`,
    };
}

export async function generateIssuePageMetadata({
    params,
}: IssuePageProps): Promise<Metadata> {
    const { owner, repo, number } = await params;
    return generateIssueMetadata(owner, repo, number);
}

export async function ProviderRepoPage({
    provider,
    params,
}: RepoPageProps & ProviderProps) {
    const { owner, repo } = await params;
    return (
        <RepoCodePage
            provider={provider}
            owner={owner}
            repo={repo}
            {...loadRepoPageData(provider, owner, repo)}
        />
    );
}

export async function ProviderActionsPage({
    provider,
    params,
}: RepoPageProps & ProviderProps) {
    const { owner, repo } = await params;
    return (
        <PageFrame>
            <ActionsList provider={provider} owner={owner} repo={repo} />
        </PageFrame>
    );
}

export async function ProviderBranchesPage({
    provider,
    params,
}: RepoPageProps & ProviderProps) {
    const { owner, repo } = await params;
    return (
        <PageFrame>
            <BranchListShared provider={provider} owner={owner} repo={repo} />
        </PageFrame>
    );
}

export async function ProviderIssuesPage({
    provider,
    params,
    searchParams,
}: RepoListPageProps & ProviderProps) {
    const { owner, repo } = await params;
    const { state } = await searchParams;
    const defaultState = state === "closed" ? "closed" : "open";
    return (
        <PageFrame>
            <IssueList
                provider={provider}
                owner={owner}
                repo={repo}
                defaultState={defaultState}
            />
        </PageFrame>
    );
}

export async function ProviderPullsPage({
    provider,
    params,
    searchParams,
}: RepoListPageProps & ProviderProps) {
    const { owner, repo } = await params;
    const { state } = await searchParams;
    const config = provider === "gh" ? ghPullsConfig : cbPullsConfig;
    const defaultState =
        state === "closed" || (provider === "gh" && state === "merged")
            ? state
            : "open";
    return (
        <PageFrame>
            <PullRequestListShared
                owner={owner}
                repo={repo}
                defaultState={defaultState}
                config={config}
            />
        </PageFrame>
    );
}

export async function ProviderCommitsPage({
    provider,
    params,
    searchParams,
}: ReferencePageProps & ProviderProps) {
    const { owner, repo, branch } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    return (
        <PageFrame>
            <CommitsList
                owner={owner}
                repo={repo}
                reference={reference}
                config={provider === "gh" ? ghCommitsConfig : cbCommitsConfig}
            />
        </PageFrame>
    );
}

export async function ProviderBlobPage({
    provider,
    params,
    searchParams,
}: ReferencePageProps & ProviderProps) {
    const { owner, repo, branch, path } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    return (
        <RepoBlobPage
            provider={provider}
            owner={owner}
            repo={repo}
            reference={reference}
            path={(path ?? []).join("/")}
        />
    );
}

export async function ProviderTreePage({
    provider,
    params,
    searchParams,
}: ReferencePageProps & ProviderProps) {
    const { owner, repo, branch, path } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    const repoPath = (path ?? []).join("/");

    if (repoPath !== "") {
        return (
            <RepoDirectoryPage
                provider={provider}
                owner={owner}
                repo={repo}
                reference={reference}
                path={repoPath}
            />
        );
    }

    return (
        <RepoTreePage
            provider={provider}
            owner={owner}
            repo={repo}
            reference={reference}
            {...loadRepoPageData(provider, owner, repo)}
        />
    );
}

export async function ProviderBrowseLayout({
    provider,
    children,
    params,
}: ProviderLayoutProps & ProviderProps) {
    const { owner, repo } = await params;
    return (
        <RepoBrowseShell provider={provider} owner={owner} repo={repo}>
            {children}
        </RepoBrowseShell>
    );
}

export function ProviderIssuePage({
    provider,
    params,
}: IssuePageProps & ProviderProps) {
    return <IssueDetailPage provider={provider} params={params} />;
}

export function ProviderIssueLayout({
    provider,
    children,
    params,
}: IssueLayoutProps & ProviderProps) {
    return (
        <IssueLayout provider={provider} params={params}>
            {children}
        </IssueLayout>
    );
}

function PageFrame({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
    );
}
