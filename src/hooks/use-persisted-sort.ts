import { useState, useEffect } from 'react';

type SortOrder = 'asc' | 'desc';

export function usePersistedSort(key: string, defaultSortBy: string, defaultSortOrder: SortOrder = 'asc') {
    // Initialize with default values
    const [sortBy, setSortByState] = useState<string>(defaultSortBy);
    const [sortOrder, setSortOrderState] = useState<SortOrder>(defaultSortOrder);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const savedSortBy = localStorage.getItem(`${key}-sortBy`);
        const savedSortOrder = localStorage.getItem(`${key}-sortOrder`) as SortOrder;

        if (savedSortBy) {
            setSortByState(savedSortBy);
        }
        if (savedSortOrder) {
            setSortOrderState(savedSortOrder);
        }
        setIsLoaded(true);
    }, [key]);

    // Save to localStorage whenever values change, but only after initial load
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(`${key}-sortBy`, sortBy);
            localStorage.setItem(`${key}-sortOrder`, sortOrder);
        }
    }, [key, sortBy, sortOrder, isLoaded]);

    const setSortBy = (value: string) => {
        setSortByState(value);
    };

    const setSortOrder = (value: SortOrder) => {
        setSortOrderState(value);
    };

    return [sortBy, setSortBy, sortOrder, setSortOrder] as const;
}
