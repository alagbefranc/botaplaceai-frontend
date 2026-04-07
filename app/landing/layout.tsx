import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./landing.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Botaplace AI — The Omnichannel AI CX Platform",
  description:
    "Deploy seamless customer experiences across voice, text, and chat instantly. Build, deploy, monitor and refine AI agents with Botaplace.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} font-sans text-[18px] bg-[#FFFDF5] text-[#151515] antialiased`}
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {children}
    </div>
  );
}
