import {
    CommitsPage,
    type CommitsPageProps,
} from "~/app/[owner]/[repo]/_components/repo-pages/commits-page";
import { ghConfig } from "~/app/[owner]/[repo]/commits/_components/commits-list-config";

export { generateCommitsMetadata as generateMetadata } from "~/app/[owner]/[repo]/_components/repo-pages/commits-page";

export default function Page(props: CommitsPageProps) {
    return <CommitsPage {...props} config={ghConfig} />;
}
