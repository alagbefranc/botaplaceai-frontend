"use client";

import Link from "next/link";
import { ArrowRight, Shield, Globe, Headphones, TrendingUp, Lock, Server } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const benefits = [
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "SOC 2 Type II compliant infrastructure with end-to-end encryption, role-based access control, and comprehensive audit logs.",
  },
  {
    icon: Globe,
    title: "Global Scale",
    desc: "Deploy across regions with automatic failover. Handle millions of conversations with consistent low latency worldwide.",
  },
  {
    icon: Headphones,
    title: "Dedicated Support",
    desc: "24/7 priority support with dedicated customer success managers and technical account managers.",
  },
  {
    icon: TrendingUp,
    title: "Custom SLAs",
    desc: "Guaranteed uptime SLAs tailored to your business requirements with financial backing.",
  },
  {
    icon: Lock,
    title: "Data Residency",
    desc: "Choose where your data lives. Deploy in specific regions to meet compliance and regulatory requirements.",
  },
  {
    icon: Server,
    title: "Private Deployment",
    desc: "On-premise or VPC deployment options for organizations with strict data sovereignty requirements.",
  },
];

const stats = [
  { value: "99.99%", label: "Uptime SLA" },
  { value: "< 500ms", label: "Response Latency" },
  { value: "100+", label: "Countries Supported" },
  { value: "24/7", label: "Enterprise Support" },
];

export default function EnterprisesPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="AI customer experience at enterprise scale"
        subtitle="Trusted by leading organizations to handle millions of customer interactions with enterprise-grade security, compliance, and support."
        ctaText="Contact Sales"
        ctaHref="/landing/contact"
      />

      {/* Stats Section */}
      <section className="py-16 border-b border-[#E8E6DB] bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading font-bold text-[48px] text-[#17DEBC] mb-2">{stat.value}</div>
                <div className="text-[#5A5A5A] text-[15px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[40px] mb-4 text-[#151515] text-center">
            Built for enterprise requirements
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            Security, compliance, and reliability that meets the demands of the world's largest organizations.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="bg-white border border-[#E8E6DB] rounded-lg p-8 hover:border-[#17DEBC] transition-colors"
              >
                <benefit.icon className="w-10 h-10 text-[#17DEBC] mb-4" />
                <h3 className="font-bold text-[20px] mb-3 text-[#151515]">{benefit.title}</h3>
                <p className="text-[#5A5A5A] text-[15px] leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 border-t border-[#E8E6DB] bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading font-bold text-[36px] mb-6 text-[#151515]">
                Compliance you can trust
              </h2>
              <p className="text-[#5A5A5A] text-[18px] mb-8 leading-relaxed">
                We maintain rigorous security and compliance standards to protect your data and meet regulatory requirements across industries.
              </p>
              <ul className="space-y-4">
                {["SOC 2 Type II Certified", "GDPR Compliant", "HIPAA Ready", "PCI DSS Compliant", "ISO 27001"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#17DEBC] flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#151515]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-[#151515] font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#E8E6DB] rounded-lg aspect-square flex items-center justify-center">
              <Shield className="w-32 h-32 text-[#5A5A5A]/30" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#151515]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[40px] mb-4 text-[#FFFDF5]">
            Let's discuss your enterprise needs
          </h2>
          <p className="text-[#FFFDF5]/70 text-[18px] mb-8 max-w-2xl mx-auto">
            Our team will work with you to understand your requirements and create a custom solution.
          </p>
          <Link
            href="/landing/contact"
            className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-flex items-center gap-2"
          >
            Contact Sales <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
