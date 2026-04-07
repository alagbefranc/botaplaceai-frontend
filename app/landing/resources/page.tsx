"use client";

import Link from "next/link";
import { ArrowRight, Book, FileText, Video, MessageCircle, Code, Zap } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const resources = [
  {
    id: "docs",
    icon: Book,
    title: "Documentation",
    desc: "Comprehensive guides, API references, and tutorials to help you build and deploy AI agents.",
    link: "/landing/resources#docs",
    cta: "Browse Docs",
  },
  {
    id: "api",
    icon: Code,
    title: "API Reference",
    desc: "Full REST API documentation with examples, authentication guides, and webhook specifications.",
    link: "/landing/resources#api",
    cta: "View API Docs",
  },
  {
    id: "guides",
    icon: FileText,
    title: "Getting Started Guides",
    desc: "Step-by-step tutorials to get your first AI agent up and running in minutes.",
    link: "/landing/resources#guides",
    cta: "Start Learning",
  },
  {
    id: "videos",
    icon: Video,
    title: "Video Tutorials",
    desc: "Watch walkthroughs of key features and best practices for building effective AI agents.",
    link: "/landing/resources#videos",
    cta: "Watch Videos",
  },
  {
    id: "community",
    icon: MessageCircle,
    title: "Community",
    desc: "Join our community of builders. Share ideas, get help, and learn from others.",
    link: "/landing/resources#community",
    cta: "Join Community",
  },
  {
    id: "changelog",
    icon: Zap,
    title: "Changelog",
    desc: "Stay up to date with the latest features, improvements, and bug fixes.",
    link: "/landing/resources#changelog",
    cta: "View Updates",
  },
];

const quickLinks = [
  { title: "Create Your First Agent", desc: "5 min read", href: "#" },
  { title: "Connect a Phone Number", desc: "3 min read", href: "#" },
  { title: "Launch Your First Mission", desc: "4 min read", href: "#" },
  { title: "Set Up Handoffs", desc: "6 min read", href: "#" },
  { title: "Integrate with Your CRM", desc: "8 min read", href: "#" },
  { title: "Fine-Tune Your Model", desc: "10 min read", href: "#" },
];

export default function ResourcesPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Resources to help you succeed"
        subtitle="Everything you need to build, deploy, and optimize AI-powered customer experiences. From documentation to tutorials and community support."
      />

      {/* Resources Grid */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {resources.map((resource) => (
              <div
                key={resource.id}
                id={resource.id}
                className="bg-white border border-[#E8E6DB] rounded-lg p-8 hover:border-[#17DEBC] transition-colors group"
              >
                <resource.icon className="w-10 h-10 text-[#17DEBC] mb-4" />
                <h3 className="font-bold text-[20px] mb-3 text-[#151515]">{resource.title}</h3>
                <p className="text-[#5A5A5A] text-[15px] leading-relaxed mb-6">{resource.desc}</p>
                <Link
                  href={resource.link}
                  className="text-[#17DEBC] font-medium text-[15px] inline-flex items-center gap-2 group-hover:gap-3 transition-all"
                >
                  {resource.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Guides */}
      <section className="py-20 border-t border-[#E8E6DB] bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515]">
            Quick Start Guides
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-12 max-w-2xl">
            Get up and running quickly with these step-by-step tutorials.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="flex items-center justify-between p-4 border border-[#E8E6DB] rounded-lg hover:border-[#17DEBC] hover:bg-[#FFFDF5] transition-colors group"
              >
                <div>
                  <div className="font-medium text-[#151515] group-hover:text-[#17DEBC] transition-colors">
                    {link.title}
                  </div>
                  <div className="text-[#5A5A5A] text-sm">{link.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#5A5A5A] group-hover:text-[#17DEBC] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="py-20 bg-[#151515]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-heading font-bold text-[36px] mb-4 text-[#FFFDF5]">
                Need help?
              </h2>
              <p className="text-[#FFFDF5]/70 text-[18px] mb-8">
                Our support team is here to help you succeed. Reach out anytime.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/landing/contact"
                  className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-6 py-3 rounded-sm font-medium text-[15px] transition-colors inline-flex items-center gap-2"
                >
                  Contact Support <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/landing#experience"
                  className="bg-transparent text-[#FFFDF5] hover:bg-[#FFFDF5]/10 px-6 py-3 rounded-sm font-medium text-[15px] transition-colors border border-[#FFFDF5]/30"
                >
                  Schedule a Call
                </Link>
              </div>
            </div>
            <div className="text-[#FFFDF5]/60 text-[15px] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#17DEBC]" />
                <span>Average response time: &lt; 2 hours</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#17DEBC]" />
                <span>24/7 support for enterprise customers</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#17DEBC]" />
                <span>Dedicated success managers available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
