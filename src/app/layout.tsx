import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PitchArena",
    template: "%s",
  },
  description:
    "Girişim fikirlerini birbiriyle çelişen yapay zeka ajanlarıyla analiz eden, yatırımcı simülasyonu ve uygulanabilirlik değerlendirmesi yapan platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
