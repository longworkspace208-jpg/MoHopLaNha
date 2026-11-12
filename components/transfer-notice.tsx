"use client";
import { useState } from "react";
/** Deliberately informational: this button never updates the order status. */
export function TransferNotice() { const [shown, setShown] = useState(false); return <div className="mt-4">{shown ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Cảm ơn bạn. Đơn vẫn chờ quản trị viên đối soát và xác nhận.</p> : <button type="button" onClick={() => setShown(true)} className="text-sm font-bold text-emerald-700 underline">Tôi đã chuyển khoản</button>}</div>; }
