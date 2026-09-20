import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { FondoGlobal } from "@/components/fondo/FondoGlobal";
import { siteConfig } from "@/lib/config/site";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} · Cada luz es una persona que necesita ayuda`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "es_CO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} font-sans antialiased selection:bg-[var(--accent)] selection:text-white`}>
        <QueryProvider>
          {/* Global star background — hidden on home page by FondoGlobal */}
          <FondoGlobal />

          {/* Ambient background glow */}
          <div className="ambient-background" aria-hidden="true">
            <div className="ambient-blob-1" />
            <div className="ambient-blob-2" />
          </div>

          <Header />
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
            <Footer />
          </div>
          <BottomNav />
        </QueryProvider>
      </body>
    </html>
  );
}
