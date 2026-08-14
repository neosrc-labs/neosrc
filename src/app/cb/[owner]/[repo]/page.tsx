import {
    RepoHomePage,
    type RepoHomePageProps,
} from "~/app/[owner]/[repo]/_components/repo-pages/repo-home-page";

export { generateRepoHomeMetadata as generateMetadata } from "~/app/[owner]/[repo]/_components/repo-pages/repo-home-page";

export default function Page(props: RepoHomePageProps) {
    return <RepoHomePage {...props} provider="cb" />;
}
