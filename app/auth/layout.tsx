import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Botaplace AI — Sign In",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
