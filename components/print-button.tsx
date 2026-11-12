"use client";

export function PrintButton({ label = "In tem" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-950"
    >
      {label}
    </button>
  );
}
