import "~/styles/globals.css";
import "~/styles/github-alert.css";
import "highlight.js/styles/github.min.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { Header } from "~/components/header/header";
import { SidebarProvider } from "~/components/sidebar-context";
import { ThemeProvider } from "~/components/ThemeProvider";
import { ThemeStylesheets } from "~/components/ThemeStylesheets";
import { TooltipProvider } from "~/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
    title: "Neosrc",
    description: "Neosrc",
    icons: [{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" }],
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
            <body className="bg-white dark:bg-zinc-950">
                <TooltipProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                    >
                        <SidebarProvider>
                            <ThemeStylesheets />
                            <TRPCReactProvider>
                                <Header />
                                {children}
                            </TRPCReactProvider>
                        </SidebarProvider>
                    </ThemeProvider>
                </TooltipProvider>
            </body>
        </html>
    );
}
