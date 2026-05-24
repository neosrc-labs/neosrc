"use client";

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useState,
} from "react";

interface RightSidebarContextValue {
    isOpen: boolean;
    toggle: () => void;
}

const RightSidebarContext = createContext<RightSidebarContextValue>({
    isOpen: true,
    toggle: () => {},
});

export function RightSidebarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(true);

    const toggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    return (
        <RightSidebarContext.Provider value={{ isOpen, toggle }}>
            {children}
        </RightSidebarContext.Provider>
    );
}

export function useRightSidebar() {
    return useContext(RightSidebarContext);
}
