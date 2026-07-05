"use client";

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 per page" },
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

export default function PageSizeSelect({ value, onChange }) {
  return (
    <div className="form-control">
      <select
        className="select select-bordered"
        value={value || "10"}
        onChange={(e) => onChange(e.target.value)}
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
