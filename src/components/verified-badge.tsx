"use client";

import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { GQLGitSignature, GQLGpgSignature } from "~/server/github-graphql";

function signatureTypeLabel(sig: GQLGitSignature): string {
    switch (sig.__typename) {
        case "GpgSignature":
            return "GPG";
        case "SshSignature":
            return "SSH";
        case "SmimeSignature":
            return "S/MIME";
    }
}

function signatureKeyId(sig: GQLGitSignature): string | null {
    switch (sig.__typename) {
        case "GpgSignature":
            return (sig as GQLGpgSignature).keyId;
        case "SshSignature":
        case "SmimeSignature":
            return null;
    }
}

function signatureStateLabel(state: string): string {
    switch (state) {
        case "VALID":
            return "Valid";
        case "INVALID":
            return "Invalid signature";
        case "UNKNOWN_KEY":
            return "Signed with an unknown key";
        case "BAD_EMAIL":
            return "Invalid email";
        case "EXPIRED_KEY":
            return "Signed with an expired key";
        case "NOT_SIGNING_KEY":
            return "Not a signing key";
        case "NO_USER":
            return "No user associated with the key";
        case "EXPIRED":
            return "Expired signature";
        default:
            return state;
    }
}

function VerifiedBadgeHoverContent({
    signature,
}: {
    signature: GQLGitSignature;
}) {
    const keyId = signatureKeyId(signature);
    const typeLabel = signatureTypeLabel(signature);

    return (
        <div className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-gray-900 text-sm dark:text-gray-100">
                    {signature.isValid ? "Verified" : "Unverified"} signature
                </span>
            </div>
            <p className="text-gray-600 text-xs dark:text-gray-400">
                This commit was signed with a {typeLabel} key.
            </p>
            {keyId && (
                <div className="mt-1 rounded bg-gray-50 px-2 py-1 font-mono text-gray-700 text-xs dark:bg-zinc-900 dark:text-gray-300">
                    Key ID: {keyId}
                </div>
            )}
            {!signature.isValid && (
                <p className="text-red-600 text-xs dark:text-red-400">
                    {signatureStateLabel(signature.state)}
                </p>
            )}
        </div>
    );
}

export function VerifiedBadge({ signature }: { signature: GQLGitSignature }) {
    if (!signature) return null;

    return (
        <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1 text-green-600 text-xs dark:text-green-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="font-medium">Verified</span>
                </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 bg-white p-0 dark:bg-zinc-950">
                <VerifiedBadgeHoverContent signature={signature} />
            </HoverCardContent>
        </HoverCard>
    );
}

export function VerifiedBadgeInline({
    signature,
    children,
}: {
    signature: GQLGitSignature | null | undefined;
    children: ReactNode;
}) {
    if (!signature) return <>{children}</>;

    return (
        <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-64 bg-white p-0 dark:bg-zinc-950">
                <VerifiedBadgeHoverContent signature={signature} />
            </HoverCardContent>
        </HoverCard>
    );
}

function restVerificationReasonLabel(reason: string): string {
    switch (reason) {
        case "VALID":
            return "Valid signature";
        case "INVALID":
            return "Invalid signature";
        case "UNKNOWN_KEY":
            return "Signed with an unknown key";
        case "BAD_EMAIL":
            return "Invalid email";
        case "EXPIRED_KEY":
            return "Signed with an expired key";
        case "NOT_SIGNING_KEY":
            return "Not a signing key";
        case "NO_USER":
            return "No user associated with the key";
        case "GPGVERIFY_SIGNING_KEY_NOT_LOADED":
            return "Signing key could not be loaded";
        case "GPGVERIFY_NO_MATCHING_KEY":
            return "No matching key found";
        case "unknown_signature_type":
            return "Unknown signature type";
        default:
            return reason;
    }
}

export function RestVerificationBadge({
    verified,
    reason,
}: {
    verified: boolean;
    reason: string | null;
}) {
    if (verified) {
        return (
            <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 text-green-600 text-xs dark:text-green-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="font-medium">Verified</span>
                    </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-56 bg-white p-0 dark:bg-zinc-950">
                    <div className="flex flex-col gap-1.5 p-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-gray-900 text-sm dark:text-gray-100">
                                Verified commit
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs dark:text-gray-400">
                            This commit was signed and the signature was
                            verified.
                        </p>
                    </div>
                </HoverCardContent>
            </HoverCard>
        );
    }

    if (reason && reason !== "VALID") {
        return (
            <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 text-gray-400 text-xs dark:text-zinc-500">
                        <ShieldQuestion className="h-3.5 w-3.5" />
                        <span className="font-medium">Unverified</span>
                    </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-56 bg-white p-0 dark:bg-zinc-950">
                    <div className="flex flex-col gap-1.5 p-3">
                        <div className="flex items-center gap-2">
                            <ShieldQuestion className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-900 text-sm dark:text-gray-100">
                                Unverified commit
                            </span>
                        </div>
                        <p className="text-red-600 text-xs dark:text-red-400">
                            {restVerificationReasonLabel(reason)}
                        </p>
                    </div>
                </HoverCardContent>
            </HoverCard>
        );
    }

    return null;
}
