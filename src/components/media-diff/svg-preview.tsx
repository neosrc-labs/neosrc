export function SvgPreview({
    content,
    title,
}: {
    content: string;
    title: string;
}) {
    const srcDoc = `<!DOCTYPE html>
<html style="margin:0;padding:0;width:100%;height:100%;">
<body style="margin:0;padding:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
<style>svg { max-width: 100%; max-height: 100%; height: auto; }</style>
${content}
</body>
</html>`;
    return (
        <iframe
            className="w-full overflow-hidden"
            sandbox=""
            srcDoc={srcDoc}
            style={{ height: "60vh", maxHeight: "600px", minHeight: "200px" }}
            title={title}
        />
    );
}
