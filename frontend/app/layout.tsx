import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AID Healthcare Platform",
  description: "Clinical CRM, head physician command center, and anonymous patient feedback.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
