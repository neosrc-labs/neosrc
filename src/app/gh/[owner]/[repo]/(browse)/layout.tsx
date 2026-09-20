import {
    ProviderBrowseLayout,
    type ProviderLayoutProps,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export default function BrowseLayout(props: ProviderLayoutProps) {
    return <ProviderBrowseLayout provider="gh" {...props} />;
}
