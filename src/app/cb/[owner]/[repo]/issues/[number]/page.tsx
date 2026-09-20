import {
    generateIssuePageMetadata,
    type IssuePageProps,
    ProviderIssuePage,
} from "~/app/[owner]/[repo]/_components/provider-route-pages";

export { generateIssuePageMetadata as generateMetadata };

export default function IssuePage(props: IssuePageProps) {
    return <ProviderIssuePage provider="cb" {...props} />;
}
