import { FileQuestion } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <FileQuestion className="size-12 text-text-muted" />
            <h1 className="font-semibold text-text-primary text-xl">
                404 - Page not found
            </h1>
            <p className="max-w-sm text-sm text-text-tertiary">
                The page you are looking for does not exist.
            </p>
        </div>
    );
}
