import type { Metadata } from "next";
import { Roboto, Roboto_Slab, Roboto_Mono } from "next/font/google";
import "./globals.css";

const body = Roboto({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "700"],
});
// Fuente distinta y propia, solo para titulos reales — asi un titulo no solo
// pesa mas, es literalmente otra familia tipografica frente al cuerpo.
const title = Roboto_Slab({
  subsets: ["latin"],
  variable: "--font-title",
  weight: ["700"],
});

const mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CotiFact",
  description: "Cotiza y factura en un mismo lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${body.variable} ${title.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
