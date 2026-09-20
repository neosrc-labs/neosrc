import {
    generateBlobMetadata,
    ProviderBlobPage,
    type ReferencePageProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateBlobMetadata as generateMetadata };

export default function BlobPage(props: ReferencePageProps) {
    return <ProviderBlobPage provider="gh" {...props} />;
}
