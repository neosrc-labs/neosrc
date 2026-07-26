"use client";

import { createContext, type RefObject, useContext } from "react";

export const MainContentRefContext =
    createContext<RefObject<HTMLElement | null> | null>(null);

export function useMainContentRef(): RefObject<HTMLElement | null> | null {
    return useContext(MainContentRefContext);
}
