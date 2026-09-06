import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const myFirstFont = localFont({
  src: "../../fonts/My First Font.otf",
  variable: "--font-my-first",
  display: "swap",
});

const productSans = localFont({
  src: "../../fonts/Product Sans Regular.ttf",
  variable: "--font-product-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "scrapbook — trip planning",
  description: "A digital scrapbook for planning a trip.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${myFirstFont.variable} ${productSans.variable} h-full`}
    >
      <body className={`${myFirstFont.className} min-h-full`}>{children}</body>
    </html>
  );
}
