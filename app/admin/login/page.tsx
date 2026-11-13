import { adminLogin } from "../actions";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retryAfter?: string }>;
}) {
  const { error, retryAfter } = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-sm place-items-center p-5">
      <form action={adminLogin} className="w-full rounded-card bg-white p-6 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-orange-600">
          Mở Hộp Là Nhà
        </p>
        <h1 className="mt-2 text-2xl font-black text-brand-950">
          Đăng nhập quản trị
        </h1>
        {error === "ratelimit" && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            Bạn đã thử đăng nhập quá nhiều lần (tối đa 5 lần/15 phút). Vui lòng thử lại sau{" "}
            {retryAfter ? `${retryAfter} giây` : "ít phút"}.
          </p>
        )}
        {error === "1" && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            Mã truy cập không đúng. Vui lòng thử lại.
          </p>
        )}
        {error === "config" && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
          >
            Biến môi trường ADMIN_PASSCODE chưa được cấu hình trên server.
          </p>
        )}
        <label className="mt-6 block text-sm font-medium">
          ADMIN_PASSCODE
          <input
            name="token"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-brand-600"
          />
        </label>
        <button className="mt-5 w-full rounded-full bg-brand-700 py-3 font-bold text-white hover:bg-brand-800">
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
