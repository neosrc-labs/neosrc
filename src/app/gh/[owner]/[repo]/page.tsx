import {
    generateRepoMetadata,
    ProviderRepoPage,
    type RepoPageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateRepoMetadata as generateMetadata };

export default function RepoPage(props: RepoPageProps) {
    return <ProviderRepoPage provider="gh" {...props} />;
}
