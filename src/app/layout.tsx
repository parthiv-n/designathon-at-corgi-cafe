import type { Metadata } from "next";
import { Caveat, Special_Elite } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const specialElite = Special_Elite({
  subsets: ["latin"],
  variable: "--font-special-elite",
  weight: "400",
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
      className={`${caveat.variable} ${specialElite.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
