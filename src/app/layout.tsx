import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "مجلس لسان العربي", template: "%s | مجلس لسان العربي" },
  description: "منصة إدارة أنشطة مجلس لسان العربي ومشاركيه",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
