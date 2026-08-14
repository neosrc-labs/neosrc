import {
    IssuesPage,
    type IssuesPageProps,
} from "~/app/[owner]/[repo]/_components/repo-pages/issues-page";

export { generateIssuesMetadata as generateMetadata } from "~/app/[owner]/[repo]/_components/repo-pages/issues-page";

export default function Page(props: IssuesPageProps) {
    return <IssuesPage {...props} provider="cb" />;
}
