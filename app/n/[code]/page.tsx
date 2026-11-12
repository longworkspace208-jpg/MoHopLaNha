import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortionByQrCode } from "@/lib/orders-db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code).trim();
  const portion = await getPortionByQrCode(decodedCode);

  return {
    title: portion
      ? `${portion.dishName} (${portion.qrCode}) · Mở Hộp Là Nhà`
      : "Không tìm thấy mã suất · Mở Hộp Là Nhà",
    description: portion
      ? `Thông tin dinh dưỡng ước tính và truy xuất nguồn gốc cho mã suất ${portion.qrCode}.`
      : "Không tìm thấy thông tin khẩu phần theo mã QR.",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

function formatDateVi(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime())
    ? dateStr
    : parsed.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatDateTimeVi(isoStr: string): string {
  const parsed = new Date(isoStr);
  return Number.isNaN(parsed.getTime())
    ? isoStr
    : parsed.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour12: false,
      });
}

export default async function PublicNutritionSnapshotPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code).trim();

  if (!decodedCode) {
    notFound();
  }

  // Chỉ đọc từ nutrition_snapshots theo qr_code — tuyệt đối không truy vấn thông tin khách hàng
  const portion = await getPortionByQrCode(decodedCode);
  if (!portion) {
    notFound();
  }

  const allAllergens = Array.from(
    new Set([
      ...(portion.allergens ?? []),
      ...(portion.ingredients ?? []).flatMap((ing) => ing.allergens ?? []),
    ])
  ).filter(Boolean);

  return (
    <main className="min-h-screen bg-brand-950 px-4 py-6">
      <article className="mx-auto w-full max-w-md rounded-[2rem] bg-cream p-5 shadow-2xl sm:p-6">
        <header className="border-b border-brand-100 pb-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
            Mở Hộp Là Nhà · Minh bạch dinh dưỡng
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-brand-950">
            {portion.dishName}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-950 px-3 py-1 font-mono text-xs font-bold text-white">
              Mã suất: {portion.qrCode}
            </span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
              Cân thực tế: {portion.actualGrams}g
            </span>
          </div>
        </header>

        {/* Định lượng thực & thời gian chế biến / đóng gói */}
        <section className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Định lượng thực</p>
            <p className="mt-0.5 text-lg font-black text-brand-950">
              {portion.actualGrams}g
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">Ngày chế biến</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">
              {formatDateVi(portion.cookedAt)}
            </p>
          </div>
          <div className="col-span-2 border-t border-slate-100 pt-2.5">
            <p className="text-[11px] font-medium text-slate-500">
              Thời điểm đóng gói
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">
              {formatDateTimeVi(portion.packedAt)}
            </p>
          </div>
        </section>

        {/* Thành phần dinh dưỡng (ước tính) */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-black text-brand-950">
              Dinh dưỡng khẩu phần (ước tính)
            </h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Giá trị ước tính
            </span>
          </div>

          <div className="mt-3 rounded-xl bg-brand-50 p-3 text-center">
            <p className="text-xs font-semibold text-brand-800">
              Năng lượng — Calories (ước tính)
            </p>
            <p className="mt-0.5 text-2xl font-black text-brand-950">
              {portion.kcal} kcal
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[11px] font-semibold text-slate-500">
                Protein (ước tính)
              </p>
              <p className="mt-0.5 text-base font-black text-emerald-700">
                {portion.proteinG}g
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[11px] font-semibold text-slate-500">
                Carbs (ước tính)
              </p>
              <p className="mt-0.5 text-base font-black text-amber-800">
                {portion.carbsG}g
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[11px] font-semibold text-slate-500">
                Fat (ước tính)
              </p>
              <p className="mt-0.5 text-base font-black text-sky-700">
                {portion.fatG}g
              </p>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
            Số liệu dinh dưỡng là giá trị <strong>ước tính</strong> theo công thức
            nguyên liệu và định lượng cân thực tế tại thời điểm đóng gói.
          </p>
        </section>

        {/* Nguyên liệu & chất gây dị ứng */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-brand-950">
            Nguyên liệu & chất gây dị ứng
          </h2>

          {portion.ingredients && portion.ingredients.length > 0 ? (
            <ul className="mt-2.5 divide-y divide-slate-100 text-sm text-slate-700">
              {portion.ingredients.map((ing, idx) => (
                <li
                  key={`${ing.name}-${idx}`}
                  className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="font-medium text-slate-800">
                    {ing.name}
                    {ing.allergens && ing.allergens.length > 0 && (
                      <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        Dị ứng: {ing.allergens.join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-600">
                    {ing.rawG}g
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Chưa có danh sách nguyên liệu chi tiết cho suất ăn này.
            </p>
          )}

          {allAllergens.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-bold">⚠️ Cảnh báo chất gây dị ứng:</p>
              <p className="mt-0.5 font-semibold">{allAllergens.join(", ")}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              ✓ Không ghi nhận chất gây dị ứng phổ biến trong công thức món này.
            </div>
          )}
        </section>

        {/* Nguồn gốc & mã lô */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-brand-950">
            Nguồn gốc & mã lô (Lot)
          </h2>
          <dl className="mt-2.5 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-slate-500">Mã lô (Lot code):</dt>
              <dd className="font-mono font-bold text-brand-950 text-right">
                {portion.lotCode || "Chưa ghi nhận"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-2">
              <dt className="shrink-0 text-slate-500">Nguồn gốc:</dt>
              <dd className="font-semibold text-slate-800 text-right">
                {portion.sourceNote || "Chưa ghi nhận"}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
          Dữ liệu được khóa cố định tại thời điểm đóng gói (mã suất{" "}
          <span className="font-mono font-semibold text-slate-700">
            {portion.qrCode}
          </span>
          ) · Mở Hộp Là Nhà
        </footer>
      </article>
    </main>
  );
}
