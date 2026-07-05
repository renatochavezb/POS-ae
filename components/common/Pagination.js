"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

export default function Pagination({ paginationData, setPage }) {
  const { page, totalPages } = paginationData;

  // If there's only one page, don't show pagination
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 7) {
      // If there are 7 or fewer pages, show all
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (page <= 4) {
        // If we're in the first 4 pages
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (page >= totalPages - 3) {
        // If we're in the last 4 pages
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        // If we're in the middle
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = page - 1; i <= page + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  return (
    <div className="mt-4 w-full border-t border-gray-200 px-4 py-3 sm:px-6">
      {/* Mobile version */}
      <div className="flex w-full justify-between sm:hidden">
        <button
          className={`${
            page === 1
              ? "cursor-not-allowed bg-gray-200 text-gray-800"
              : "bg-gray-600 text-gray-100"
          } relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium`}
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <button
          className={`${
            page === totalPages
              ? "cursor-not-allowed bg-gray-200 text-gray-800"
              : "bg-gray-600 text-gray-100"
          } relative ml-3 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium`}
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>

      {/* Desktop version */}
      <div className="wrapper flex w-full items-center justify-center">
        <div className="hidden md:flex md:flex-col md:items-center md:justify-center">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </p>
          <div className="mt-2">
            <nav
              className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                className={`${
                  page === 1 && "cursor-not-allowed"
                } relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50`}
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </button>

              {renderPageNumbers().map((pageNumber, index) => (
                <button
                  key={index}
                  className={`${
                    page === pageNumber
                      ? "bg-gray-600 text-gray-100"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  } relative inline-flex items-center border border-gray-300 px-4 py-2 text-sm font-medium`}
                  onClick={() => {
                    if (typeof pageNumber === "number") {
                      setPage(pageNumber);
                    }
                  }}
                  disabled={typeof pageNumber !== "number"}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                className={`${
                  page === totalPages && "cursor-not-allowed"
                } relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50`}
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
