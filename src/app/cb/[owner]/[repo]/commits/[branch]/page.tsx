import {
    generateCommitsMetadata,
    ProviderCommitsPage,
    type ReferencePageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateCommitsMetadata as generateMetadata };

export default function CommitsPage(props: ReferencePageProps) {
    return <ProviderCommitsPage provider="cb" {...props} />;
}
