import "./globals.css";
import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-sans",
});

const playfairDisplay = Playfair_Display({
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-display",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-mono",
  preload: false,
});

export const metadata: Metadata = {
  title: "Mở Hộp Là Nhà — Bếp Cơm Định Lượng & Dinh Dưỡng Minh Bạch",
  description:
    "Cơm nhà nấu mới mỗi ngày theo mẻ, cân thực tế từng gram khi đóng gói và truy xuất Nutrition QR trên từng hộp.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${playfairDisplay.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-ivory font-sans text-ink antialiased selection:bg-coral selection:text-white">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
