"use client";

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";

interface SidebarContextValue {
    isLeftOpen: boolean;
    isRightOpen: boolean;
    toggleLeft: () => void;
    toggleRight: () => void;
    setRightOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    isLeftOpen: true,
    isRightOpen: true,
    toggleLeft: () => {},
    toggleRight: () => {},
    setRightOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);

    const toggleLeft = useCallback(() => {
        setIsLeftOpen((prev) => !prev);
    }, []);

    const toggleRight = useCallback(() => {
        setIsRightOpen((prev) => !prev);
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
