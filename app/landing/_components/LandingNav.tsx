"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";

const navLinks = [
  { 
    label: "Product", 
    hasDropdown: true,
    items: [
      { label: "Agent Builder", href: "/landing/product#agents", desc: "Create AI agents with custom personalities" },
      { label: "Voice & Telephony", href: "/landing/product#voice", desc: "Phone numbers, calls, and IVR" },
      { label: "Missions", href: "/landing/product#missions", desc: "Outbound call campaigns" },
      { label: "Analytics", href: "/landing/product#analytics", desc: "Insights and reporting" },
    ]
  },
  { label: "Enterprises", hasDropdown: false, href: "/landing/enterprises" },
  { 
    label: "Case Studies", 
    hasDropdown: true,
    items: [
      { label: "Customer Support", href: "/landing/case-studies#support", desc: "24/7 automated support" },
      { label: "Sales & Lead Gen", href: "/landing/case-studies#sales", desc: "Qualify and convert leads" },
      { label: "Appointments", href: "/landing/case-studies#appointments", desc: "Scheduling automation" },
    ]
  },
  { 
    label: "Resources", 
    hasDropdown: true,
    items: [
      { label: "Documentation", href: "/landing/resources#docs", desc: "API docs and guides" },
      { label: "Blog", href: "/landing/blog", desc: "Latest updates and insights" },
      { label: "Contact", href: "/landing/contact", desc: "Get in touch" },
    ]
  },
];

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <nav className="sticky top-0 z-50 bg-[#FFFDF5]/90 backdrop-blur-md border-b border-[#E8E6DB] w-full">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex justify-between items-center h-20">
        {/* Logo */}
        <Link href="/landing" className="flex-shrink-0 flex items-center gap-2">
          <img src="/bota-logo.png" alt="Botaplace AI" className="h-8 w-auto" />
          <span className="font-bold text-[#151515] text-lg hidden sm:block">Botaplace</span>
        </Link>

        {/* Center Links */}
        <ul className="hidden lg:flex items-center space-x-10 font-medium text-[15px]">
          {navLinks.map((link) => (
            <li key={link.label} className="relative">
              {link.hasDropdown ? (
                <div
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    className="flex items-center cursor-pointer hover:text-[#17DEBC] transition-colors gap-1"
                  >
                    {link.label}
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  </button>
                  {openDropdown === link.label && link.items && (
                    <div className="absolute top-full left-0 pt-2 w-64">
                      <div className="bg-white border border-[#E8E6DB] rounded-lg shadow-xl p-2">
                        {link.items.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="block px-4 py-3 rounded-md hover:bg-[#FFFDF5] transition-colors"
                          >
                            <span className="font-medium text-[#151515] block">{item.label}</span>
                            <span className="text-[#5A5A5A] text-xs">{item.desc}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href={link.href ?? "#"} className="hover:text-[#17DEBC] transition-colors">
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center space-x-6">
          <Link href="/auth/login" className="text-[15px] font-medium hover:text-[#17DEBC] transition-colors">
            Sign in
          </Link>
          <Link href="/auth/signup" className="text-[15px] font-medium hover:text-[#17DEBC] transition-colors">
            Sign up
          </Link>
          <Link
            href="/landing#experience"
            className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 rounded-sm font-medium text-[15px] transition-colors flex items-center gap-2"
          >
            Talk to Us <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          className="lg:hidden text-[#151515] p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FFFDF5] border-t border-[#E8E6DB] px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <div key={link.label}>
              {link.hasDropdown && link.items ? (
                <div className="border-b border-[#E8E6DB] pb-4">
                  <div className="text-[16px] font-medium py-2">{link.label}</div>
                  <div className="pl-4 space-y-2">
                    {link.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="block text-[14px] text-[#5A5A5A] hover:text-[#17DEBC]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  href={link.href ?? "#"}
                  className="block text-[16px] font-medium py-2 border-b border-[#E8E6DB]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )}
            </div>
          ))}
          <div className="pt-4 flex flex-col gap-3">
            <Link href="/auth/login" className="text-[15px] font-medium">Sign in</Link>
            <Link href="/auth/signup" className="text-[15px] font-medium">Sign up</Link>
            <Link
              href="/landing#experience"
              className="bg-[#151515] text-[#FFFDF5] px-6 py-3 rounded-sm font-medium text-[15px] text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Talk to Us
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
