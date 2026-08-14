import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface PaginationControlsProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
}

export function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
    if (totalPages <= 1) return null;

    // Helper to generate page numbers to show
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first, last, current, and neighbors
            const leftSiblingIndex = Math.max(currentPage - 1, 1);
            const rightSiblingIndex = Math.min(currentPage + 1, totalPages);

            const shouldShowLeftDots = leftSiblingIndex > 2;
            const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

            if (!shouldShowLeftDots && shouldShowRightDots) {
                const leftItemCount = 3 + 2 * 1;
                for (let i = 1; i <= leftItemCount; i++) {
                    pages.push(i);
                }
                pages.push("...");
                pages.push(totalPages);
            } else if (shouldShowLeftDots && !shouldShowRightDots) {
                const rightItemCount = 3 + 2 * 1;
                pages.push(1);
                pages.push("...");
                for (let i = totalPages - rightItemCount + 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push("...");
                for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
                    pages.push(i);
                }
                pages.push("...");
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="flex flex-col items-stretch gap-3 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
            <div className="text-center text-sm text-muted-foreground sm:mr-4 sm:text-left">
                Page {currentPage} of {totalPages}
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="hidden h-8 w-8 lg:flex"
            >
                <ChevronsLeft className="h-4 w-4" />
                <span className="sr-only">First page</span>
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8"
            >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
            </Button>

            <div className="hidden items-center space-x-1 sm:flex">
                {getPageNumbers().map((page, index) => (
                    <Button
                        key={index}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 ${page === "..." ? "cursor-default hover:bg-transparent" : ""}`}
                        onClick={() => typeof page === 'number' && onPageChange(page)}
                        disabled={page === "..."}
                    >
                        {page}
                    </Button>
                ))}
            </div>

            <div className="flex items-center justify-center px-2 text-sm font-medium sm:hidden">
                {currentPage} / {totalPages}
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8"
            >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next page</span>
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="hidden h-8 w-8 lg:flex"
            >
                <ChevronsRight className="h-4 w-4" />
                <span className="sr-only">Last page</span>
            </Button>
        </div>
    )
}
