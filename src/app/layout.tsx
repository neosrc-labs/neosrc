import "~/styles/globals.css";
import "~/styles/github-alert.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer } from "~/components/footer";
import { Header } from "~/components/header/header";
import { SidebarProvider } from "~/components/sidebar-context";
import { ThemeProvider } from "~/components/theme-provider";
import { ThemeStylesheets } from "~/components/theme-stylesheets";
import { TooltipProvider } from "~/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
    title: "Neosrc",
    description: "Neosrc",
    icons: [{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" }],
};

const font = Inter({
    subsets: ["latin"],
    variable: "--font-inter-sans",
});

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html className={`${font.variable}`} lang="en" suppressHydrationWarning>
            <body className="flex min-h-svh flex-col bg-surface">
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
                                <div className="flex min-w-0 flex-1 flex-col">
                                    {children}
                                </div>
                                <Footer />
                            </TRPCReactProvider>
                        </SidebarProvider>
                    </ThemeProvider>
                </TooltipProvider>
            </body>
        </html>
    );
}
