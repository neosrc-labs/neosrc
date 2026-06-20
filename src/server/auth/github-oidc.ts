import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "~/env";

const JWKS = createRemoteJWKSet(
    new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

interface GitHubOIDCClaims {
    repository: string;
}

export async function verifyGitHubOIDCToken(
    token: string,
): Promise<GitHubOIDCClaims> {
    const { payload } = await jwtVerify(token, JWKS, {
        issuer: "https://token.actions.githubusercontent.com",
        audience: env.REPORTS_OIDC_AUDIENCE,
    });

    const repository = payload.repository;
    if (typeof repository !== "string") {
        throw new Error("Token missing repository claim");
    }

    return { repository };
}
