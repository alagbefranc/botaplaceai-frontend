"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Agent Builder", href: "/landing/product#agents" },
    { label: "Voice & Telephony", href: "/landing/product#voice" },
    { label: "Missions", href: "/landing/product#missions" },
    { label: "Analytics", href: "/landing/product#analytics" },
    { label: "Integrations", href: "/landing/product#integrations" },
  ],
  company: [
    { label: "About", href: "/landing/about" },
    { label: "Blog", href: "/landing/blog" },
    { label: "Careers", href: "/landing/careers" },
    { label: "Contact", href: "/landing/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/landing/privacy" },
    { label: "Terms of Service", href: "/landing/terms" },
    { label: "Security", href: "/landing/security" },
    { label: "Compliance", href: "/landing/compliance" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="bg-[#151515] text-[#FFFDF5] py-16 px-6 lg:px-12">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/bota-logo.png" alt="Botaplace AI" className="h-8 w-auto" />
              <span className="font-bold text-lg">Botaplace</span>
            </div>
            <p className="text-[#FFFDF5]/60 text-sm leading-relaxed">
              The Omnichannel AI CX Platform for modern enterprises.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest text-[#FFFDF5]/60">Product</h4>
            <ul className="space-y-3 text-sm text-[#FFFDF5]/80">
              {footerLinks.product.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-[#17DEBC] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest text-[#FFFDF5]/60">Company</h4>
            <ul className="space-y-3 text-sm text-[#FFFDF5]/80">
              {footerLinks.company.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-[#17DEBC] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest text-[#FFFDF5]/60">Legal</h4>
            <ul className="space-y-3 text-sm text-[#FFFDF5]/80">
              {footerLinks.legal.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-[#17DEBC] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-[#FFFDF5]/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[#FFFDF5]/40 text-sm">
            &copy; {new Date().getFullYear()} Botaplace AI. All rights reserved.
          </p>
          <Link
            href="/auth/signup"
            className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-6 py-2.5 rounded-sm font-medium text-[14px] transition-colors flex items-center gap-2"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
