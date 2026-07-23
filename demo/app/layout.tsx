import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vinyl Night",
  description: "Drop the needle. The tracklist writes itself.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen">
        <div className="border-b border-line bg-surface px-6 py-2 text-center font-mono text-xs text-muted">
          Static demo — live recognition, RSVPs and the projector feed need the real app.{" "}
          <a
            href="https://github.com/gioguarin/Vinyl-night2"
            className="text-amber hover:underline"
          >
            github.com/gioguarin/Vinyl-night2
          </a>
        </div>
        {children}
      </body>
    </html>
  );
}
