import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mở Hộp Là Nhà", description: "Đặt cơm nhà lành mạnh" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className="bg-cream text-ink">{children}</body></html>;
}
