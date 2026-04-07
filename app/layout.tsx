import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { AntdStyleRegistry } from "./antd-style-registry";
import { Providers } from "./providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Botaplace AI",
  description:
    "Botaplace AI — Omnichannel AI Agent Platform for chat, voice, phone, and integrated tool workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={spaceGrotesk.className}>
        {/* AntdStyleRegistry extracts CSS-in-JS at SSR time — fixes FOUC */}
        <AntdStyleRegistry>
          <Providers>{children}</Providers>
        </AntdStyleRegistry>
      </body>
    </html>
  );
}
