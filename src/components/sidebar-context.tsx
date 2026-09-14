"use client";

import { usePathname } from "next/navigation";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";
import { isChangesPage } from "~/utils/route";

interface SidebarContextValue {
    isLeftOpen: boolean;
    isRightOpen: boolean;
    toggleLeft: () => void;
    toggleRight: () => void;
    setLeftOpen: (open: boolean) => void;
    setRightOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    isLeftOpen: true,
    isRightOpen: true,
    toggleLeft: () => {},
    toggleRight: () => {},
    setLeftOpen: () => {},
    setRightOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(!isChangesPage(pathname));

    const toggleLeft = useCallback(() => {
        setIsLeftOpen((prev) => !prev);
    }, []);

    const toggleRight = useCallback(() => {
        setIsRightOpen((prev) => !prev);
    }, []);

    const setLeftOpen = useCallback((open: boolean) => {
        setIsLeftOpen(open);
    }, []);

    const setRightOpen = useCallback((open: boolean) => {
        setIsRightOpen(open);
    }, []);

    return (
        <SidebarContext.Provider
            value={{
                isLeftOpen,
                isRightOpen,
                toggleLeft,
                toggleRight,
                setLeftOpen,
                setRightOpen,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
