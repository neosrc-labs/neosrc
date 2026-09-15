const authorAssociationLabels: Record<string, string> = {
    COLLABORATOR: "Collaborator",
    CONTRIBUTOR: "Contributor",
    FIRST_TIMER: "First Timer",
    FIRST_TIME_CONTRIBUTOR: "First-time Contributor",
    MANNEQUIN: "Mannequin",
    MEMBER: "Member",
    OWNER: "Owner",
};

export function RoleBadge({
    authorAssociation,
}: {
    authorAssociation: string | null | undefined;
}) {
    if (!authorAssociation || authorAssociation === "NONE") return null;

    return (
        <span className="whitespace-nowrap rounded-full bg-surface-tertiary px-2 py-0.5 font-medium text-text-secondary text-xs">
            {authorAssociationLabels[authorAssociation] ?? authorAssociation}
        </span>
    );
}
