import {
    type IssueLayoutProps,
    ProviderIssueLayout,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export default function IssueLayout(props: IssueLayoutProps) {
    return <ProviderIssueLayout provider="gh" {...props} />;
}
