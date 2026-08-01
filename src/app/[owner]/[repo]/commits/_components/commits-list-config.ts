export interface CommitsListConfig {
    provider: "gh" | "cb";
    basePath: string; // "/gh" or "/cb"
    showStatusChecks: boolean;
}

export const ghConfig: CommitsListConfig = {
    provider: "gh",
    basePath: "/gh",
    showStatusChecks: true,
};

export const cbConfig: CommitsListConfig = {
    provider: "cb",
    basePath: "/cb",
    showStatusChecks: false,
};
