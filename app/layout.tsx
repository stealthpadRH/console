import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";

const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });
const display = Sora({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://app.stealthpad.online"),
  title: { default: "Stealthpad · the board", template: "%s · Stealthpad" },
  description: "Launch a coin whose creator tax fills a vault with no keys. Holders claim their share as USDG, Zcash or Aleo dollars.",
  applicationName: "Stealthpad",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Stealthpad",
    description: "Every trade tops up a vault nobody holds the keys to.",
    url: "https://app.stealthpad.online",
    siteName: "Stealthpad",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#05110F", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${code.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
