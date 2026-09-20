"use client";

import {
    type Dispatch,
    type SetStateAction,
    useCallback,
    useState,
} from "react";
import { readAutosave, useAutosave } from "./use-autosave";

export interface OptimisticTextEditor {
    isEditing: boolean;
    editValue: string;
    savedValue: string | null;
    setEditValue: Dispatch<SetStateAction<string>>;
    setSavedValue: Dispatch<SetStateAction<string | null>>;
    startEditing: (currentValue: string) => void;
    cancelEditing: () => void;
    applySave: () => void;
    rollbackSave: () => void;
    finishSave: () => void;
}

export function useOptimisticTextEditor(
    autosaveKey: string,
): OptimisticTextEditor {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(
        () => readAutosave(autosaveKey) ?? "",
    );
    const [savedValue, setSavedValue] = useState<string | null>(null);
    const { clear } = useAutosave(autosaveKey, editValue);

    const startEditing = useCallback((currentValue: string) => {
        setEditValue((value) => value || currentValue);
        setIsEditing(true);
    }, []);

    const cancelEditing = useCallback(() => {
        setIsEditing(false);
        setEditValue("");
    }, []);

    const applySave = useCallback(() => {
        setSavedValue(editValue);
        setIsEditing(false);
    }, [editValue]);

    const rollbackSave = useCallback(() => {
        setSavedValue(null);
        setIsEditing(true);
    }, []);

    const finishSave = useCallback(() => {
        clear();
        setEditValue("");
    }, [clear]);

    return {
        isEditing,
        editValue,
        savedValue,
        setEditValue,
        setSavedValue,
        startEditing,
        cancelEditing,
        applySave,
        rollbackSave,
        finishSave,
    };
}
