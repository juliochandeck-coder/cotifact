import type { Metadata, Viewport } from "next";
import { Arimo, Inter } from "next/font/google";
import "./globals.css";

const body = Arimo({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

// Los numeros (montos, cantidades, numeros de documento) usan Inter: sus
// cifras tabulares alinean bien en columnas aunque no sea una fuente
// monoespaciada de verdad.
const mono = Inter({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CotiFact",
  description: "Cotiza y factura en un mismo lugar.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
