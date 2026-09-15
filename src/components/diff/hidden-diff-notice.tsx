export function HiddenDiffNotice({
    message,
    onShow,
}: {
    message: string;
    onShow: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-2 border-border border-t px-4 py-6 text-sm text-text-tertiary">
            <span>{message}</span>
            <button
                className="cursor-pointer font-medium text-blue-600 underline underline-offset-2"
                onClick={onShow}
                type="button"
            >
                Show changes
            </button>
        </div>
    );
}
