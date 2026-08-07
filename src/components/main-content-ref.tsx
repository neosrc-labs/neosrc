"use client";

import { createContext, type RefObject } from "react";

export const MainContentRefContext =
    createContext<RefObject<HTMLElement | null> | null>(null);
