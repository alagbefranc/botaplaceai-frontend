"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PageHeroProps {
  title: string;
  subtitle: string;
  ctaText?: string;
  ctaHref?: string;
}

export function PageHero({ title, subtitle, ctaText, ctaHref }: PageHeroProps) {
  return (
    <section className="relative w-full pt-24 pb-20 lg:pt-32 lg:pb-28 bg-grid overflow-hidden border-b border-[#E8E6DB]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="max-w-3xl">
          <h1
            className="font-heading font-bold text-[#151515] tracking-tight leading-tight mb-6"
            style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.1 }}
          >
            {title}
          </h1>
          <p className="text-[20px] text-[#5A5A5A] mb-8 leading-relaxed font-normal">
            {subtitle}
          </p>
          {ctaText && ctaHref && (
            <Link
              href={ctaHref}
              className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-lg transition-colors inline-flex items-center gap-2 shadow-lg"
            >
              {ctaText} <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
