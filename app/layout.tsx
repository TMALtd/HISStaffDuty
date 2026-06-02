import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "HELP International School | Student Filter Portal",
  description: "Private staff dashboard for browsing students by class filters."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-frame">
          <header className="site-header">
            <div className="site-header-inner">
              <div className="brand-lockup">
                <Image
                  src="/help-international-school-logo.png"
                  alt="HELP International School logo"
                  className="brand-logo"
                  width={282}
                  height={122}
                  priority
                />
                <div className="brand-copy">
                  <p className="brand-kicker">HELP International School</p>
                  <p className="brand-subtitle">Student information and management dashboard</p>
                </div>
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
