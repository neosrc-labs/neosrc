import {
    generatePullsMetadata,
    ProviderPullsPage,
    type RepoListPageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generatePullsMetadata as generateMetadata };

export default function PullsPage(props: RepoListPageProps) {
    return <ProviderPullsPage provider="gh" {...props} />;
}
