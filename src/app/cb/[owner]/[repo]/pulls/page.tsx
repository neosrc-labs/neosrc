import {
    PullsPage,
    type PullsPageProps,
} from "~/app/[owner]/[repo]/_components/repo-pages/pulls-page";

export { generatePullsMetadata as generateMetadata } from "~/app/[owner]/[repo]/_components/repo-pages/pulls-page";

export default function Page(props: PullsPageProps) {
    return <PullsPage {...props} provider="cb" />;
}
