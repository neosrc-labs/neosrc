import {
    generateActionsMetadata,
    ProviderActionsPage,
    type RepoPageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateActionsMetadata as generateMetadata };

export default function ActionsPage(props: RepoPageProps) {
    return <ProviderActionsPage provider="cb" {...props} />;
}
