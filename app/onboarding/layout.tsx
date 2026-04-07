import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Botaplace AI — Setup Your Workspace",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
