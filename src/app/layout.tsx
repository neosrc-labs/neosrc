import "~/styles/globals.css";
import "~/styles/github-alert.css";
import "highlight.js/styles/github.min.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { Header } from "~/components/Header";
import { RightSidebarProvider } from "~/components/right-sidebar-context";
import { ThemeProvider } from "~/components/ThemeProvider";
import { ThemeStylesheets } from "~/components/ThemeStylesheets";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
    title: "Neosrc",
    description: "Neosrc",
    icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            className={`${geist.variable}`}
            lang="en"
            suppressHydrationWarning
        >
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <RightSidebarProvider>
                        <Header />
                        <ThemeStylesheets />
                        <TRPCReactProvider>{children}</TRPCReactProvider>
                    </RightSidebarProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
