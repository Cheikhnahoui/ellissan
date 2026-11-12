import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "مجلس اللسان العربي", template: "%s | مجلس اللسان العربي" },
  description: "منصة إدارة أنشطة مجلس اللسان العربي ومشاركيه",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
