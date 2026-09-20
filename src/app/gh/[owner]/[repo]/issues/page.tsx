import {
    generateIssuesMetadata,
    ProviderIssuesPage,
    type RepoListPageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateIssuesMetadata as generateMetadata };

export default function IssuesPage(props: RepoListPageProps) {
    return <ProviderIssuesPage provider="gh" {...props} />;
}
