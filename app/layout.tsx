import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTSAR Input Pipeline",
  description: "Parse URLs, chat, and memos into OTSAR vault nodes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
