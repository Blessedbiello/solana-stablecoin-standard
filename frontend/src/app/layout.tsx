import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SSS Admin Dashboard",
  description:
    "Admin dashboard for the Solana Stablecoin Standard (SSS) protocol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-950 font-sans text-white">
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
