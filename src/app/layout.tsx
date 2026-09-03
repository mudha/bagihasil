import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mudha - Profit Share",
  description: "Sistem Manajemen Bagi Hasil Mudha",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover"
  }
};

import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          storageKey="mudha-theme"
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>

  );
}
