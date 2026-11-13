import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mở Hộp Là Nhà — Bếp Cơm Định Lượng & Dinh Dưỡng Minh Bạch",
  description:
    "Cơm nhà nấu mới mỗi ngày theo mẻ, cân thực tế từng gram khi đóng gói và truy xuất Nutrition QR trên từng hộp.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-ivory font-sans text-ink antialiased selection:bg-coral selection:text-white">
        {children}
      </body>
    </html>
  );
}
