type GqlAssignee = { login: string; avatarUrl: string };
type GqlLabel = {
    id: string;
    name: string;
    color: string;
    description: string | null;
};
type GqlAuthor = { login: string; avatarUrl: string; url: string };

type CbAssignee = { login: string; avatar_url: string };
type CbLabel = {
    id: number;
    name: string;
    color: string;
    description: string | null;
};
type CbAuthor = { login: string; avatar_url: string };

type Assignee = { login: string; avatarUrl: string };
type Label = {
    id: string;
    name: string;
    color: string;
    description: string | null;
};
type Author = { login: string; avatarUrl: string; url: string };

export function mapGqlAssignee(a: GqlAssignee): Assignee {
    return { login: a.login, avatarUrl: a.avatarUrl };
}

export function mapGqlLabel(l: GqlLabel): Label {
    return {
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description,
    };
}

export function mapGqlAuthor(a: GqlAuthor | null): Author | null {
    if (!a) return null;
    return { login: a.login, avatarUrl: a.avatarUrl, url: a.url };
}

export function mapCbAssignee(a: CbAssignee): Assignee {
    return { login: a.login, avatarUrl: a.avatar_url };
}

export function mapCbLabel(l: CbLabel): Label {
    return {
        id: String(l.id),
        name: l.name,
        color: l.color,
        description: l.description,
    };
}

export function mapCbAuthor(a: CbAuthor | null): Author | null {
    if (!a) return null;
    return { login: a.login, avatarUrl: a.avatar_url, url: "" };
}

export function nullSafe<T>(arr: T[] | null | undefined): T[] {
    return arr ?? [];
}
