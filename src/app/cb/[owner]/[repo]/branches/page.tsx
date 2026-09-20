import {
    generateBranchesMetadata,
    ProviderBranchesPage,
    type RepoPageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateBranchesMetadata as generateMetadata };

export default function BranchesPage(props: RepoPageProps) {
    return <ProviderBranchesPage provider="cb" {...props} />;
}
