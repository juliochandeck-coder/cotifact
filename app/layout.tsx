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
  weight: ["200", "300", "400", "500", "600", "700"],
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
      <head>
        {/* Montserrat (opción de tipografía en Diseño). Se carga en el navegador,
            no al compilar, para que la publicación no dependa de Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
