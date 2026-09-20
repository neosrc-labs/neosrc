import {
    generateTreeMetadata,
    ProviderTreePage,
    type ReferencePageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateTreeMetadata as generateMetadata };

export default function TreePage(props: ReferencePageProps) {
    return <ProviderTreePage provider="cb" {...props} />;
}
