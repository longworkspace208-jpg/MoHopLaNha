"use client";

import { useState } from "react";
import { FacebookOrderForm } from "@/components/facebook-order-form";

export function CollapsibleFacebookOrder() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-brand-950">
            Nhập đơn từ Facebook
          </h2>
          <p className="text-xs text-slate-600">
            Tạo nhanh đơn hàng thủ công nhận qua Facebook / tin nhắn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600"
        >
          {open ? "Thu gọn biểu mẫu" : "+ Nhập đơn từ Facebook"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FacebookOrderForm />
        </div>
      )}
    </section>
  );
}
