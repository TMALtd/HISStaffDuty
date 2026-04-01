import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student Filter Portal",
  description: "Private staff dashboard for browsing students by class filters."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
