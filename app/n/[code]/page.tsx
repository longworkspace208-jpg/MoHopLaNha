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
    <main className="min-h-screen bg-forest px-4 py-8 sm:py-12">
      <article className="mx-auto w-full max-w-lg border-2 border-forest-dark bg-ivory p-6 shadow-2xl sm:p-8">
        <header className="border-b-2 border-forest pb-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
              Mở Hộp Là Nhà · Minh bạch dinh dưỡng
            </p>
            <span className="bg-forest px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
              Snapshot
            </span>
          </div>

          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-forest">
            {portion.dishName}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="bg-forest px-3 py-1 font-bold text-white shadow-sm">
              Mã suất: {portion.qrCode}
            </span>
            <span className="border border-forest bg-white px-3 py-1 font-bold text-forest shadow-sm">
              Cân thực tế: {portion.actualGrams}g
            </span>
          </div>
        </header>

        {/* Định lượng thực & thời gian chế biến / đóng gói */}
        <section className="grid grid-cols-2 divide-x divide-rule border-b border-rule">
          <div className="py-4 pr-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Định lượng thực
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-coral">
              {portion.actualGrams}g
            </p>
          </div>
          <div className="py-4 pl-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Ngày chế biến
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-ink">
              {formatDateVi(portion.cookedAt)}
            </p>
          </div>
          <div className="col-span-2 border-t border-rule py-3.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Thời điểm đóng gói
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
              {formatDateTimeVi(portion.packedAt)}
            </p>
          </div>
        </section>

        {/* Thành phần dinh dưỡng (ước tính) */}
        <section className="border-b border-rule py-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-forest">
              Dinh dưỡng khẩu phần
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Giá trị ước tính
            </span>
          </div>

          <div className="mt-4 border border-rule bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between border-b border-rule pb-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Năng lượng (ước tính)
              </span>
              <strong className="font-mono text-2xl font-bold tabular-nums text-forest">
                {portion.kcal} kcal
              </strong>
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-rule text-center">
              <div className="pr-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Protein
                </p>
                <p className="mt-1 font-mono text-base font-bold tabular-nums text-forest">
                  {portion.proteinG}g
                </p>
              </div>
              <div className="px-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Carbs
                </p>
                <p className="mt-1 font-mono text-base font-bold tabular-nums text-ink">
                  {portion.carbsG}g
                </p>
              </div>
              <div className="pl-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Fat
                </p>
                <p className="mt-1 font-mono text-base font-bold tabular-nums text-coral">
                  {portion.fatG}g
                </p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Số liệu dinh dưỡng là giá trị <strong>ước tính</strong> theo công thức
            nguyên liệu và định lượng cân thực tế tại thời điểm đóng gói.
          </p>
        </section>

        {/* Nguyên liệu & chất gây dị ứng */}
        <section className="border-b border-rule py-5">
          <h2 className="font-display text-xl font-semibold text-forest">
            Nguyên liệu &amp; chất gây dị ứng
          </h2>

          {portion.ingredients && portion.ingredients.length > 0 ? (
            <ul className="mt-3 divide-y divide-rule text-sm">
              {portion.ingredients.map((ing, idx) => (
                <li
                  key={`${ing.name}-${idx}`}
                  className="flex items-baseline justify-between gap-2 py-2.5"
                >
                  <span className="font-medium text-ink">
                    {ing.name}
                    {ing.allergens && ing.allergens.length > 0 && (
                      <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-coral">
                        [Dị ứng: {ing.allergens.join(", ")}]
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-forest">
                    {ing.rawG}g
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Chưa có danh sách nguyên liệu chi tiết cho suất ăn này.
            </p>
          )}

          {allAllergens.length > 0 ? (
            <div className="mt-4 border-l-4 border-coral bg-coral/10 px-4 py-3 text-xs text-ink">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-coral">
                Cảnh báo chất gây dị ứng
              </p>
              <p className="mt-1 font-semibold">{allAllergens.join(", ")}</p>
            </div>
          ) : (
            <div className="mt-4 border-l-4 border-forest bg-forest/5 px-4 py-3 text-xs font-semibold text-forest">
              ✓ Không ghi nhận chất gây dị ứng phổ biến trong công thức món này.
            </div>
          )}
        </section>

        {/* Nguồn gốc & mã lô */}
        <section className="py-5">
          <h2 className="font-display text-xl font-semibold text-forest">
            Nguồn gốc &amp; mã lô (Lot)
          </h2>
          <dl className="mt-3 divide-y divide-rule text-xs">
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="font-mono uppercase tracking-[0.12em] text-muted">
                Mã lô (Lot code)
              </dt>
              <dd className="text-right font-mono font-bold text-forest">
                {portion.lotCode || "Chưa ghi nhận"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="shrink-0 font-mono uppercase tracking-[0.12em] text-muted">
                Nguồn gốc
              </dt>
              <dd className="text-right font-semibold text-ink">
                {portion.sourceNote || "Chưa ghi nhận"}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="border-t-2 border-forest pt-4 text-center font-mono text-xs leading-relaxed text-muted">
          Dữ liệu được khóa cố định tại thời điểm đóng gói · Mã suất{" "}
          <span className="font-bold text-forest">{portion.qrCode}</span>{" "}
          · Mở Hộp Là Nhà
        </footer>
      </article>
    </main>
  );
}
