"use client";

import Link from "next/link";
import { ArrowRight, Target, Heart, Zap, Users } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const values = [
  {
    icon: Target,
    title: "Customer First",
    desc: "Every decision we make starts with how it impacts our customers and their customers.",
  },
  {
    icon: Heart,
    title: "Quality Obsessed",
    desc: "We believe AI should enhance human connection, not replace it. Quality over quantity, always.",
  },
  {
    icon: Zap,
    title: "Move Fast",
    desc: "The AI landscape evolves rapidly. We ship quickly, iterate constantly, and stay ahead.",
  },
  {
    icon: Users,
    title: "Transparency",
    desc: "We're open about our capabilities, limitations, and roadmap. No black boxes.",
  },
];

const team = [
  { name: "Leadership", count: "Experienced founders" },
  { name: "Engineering", count: "World-class team" },
  { name: "Customer Success", count: "Dedicated support" },
  { name: "Product", count: "User-focused design" },
];

export default function AboutPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Building the future of customer experience"
        subtitle="We're on a mission to make AI-powered customer interactions accessible to every business, regardless of size or technical expertise."
      />

      {/* Mission Section */}
      <section className="py-24 bg-white border-b border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading font-bold text-[36px] mb-6 text-[#151515]">
                Our Mission
              </h2>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed mb-6">
                Customer experience shouldn't be limited by team size or budget. We believe every business deserves access to the same AI-powered tools that enterprise companies use.
              </p>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed mb-6">
                Botaplace makes it possible to build, deploy, and optimize AI agents that handle customer interactions across voice, chat, and messaging — without writing a single line of code.
              </p>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed">
                We're building the platform we wished existed: powerful enough for enterprises, simple enough for startups.
              </p>
            </div>
            <div className="bg-[#17DEBC] rounded-lg aspect-square flex items-center justify-center p-12">
              <img src="/bota-logo.png" alt="Botaplace AI" className="w-32 h-32 object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515] text-center">
            Our Values
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            The principles that guide everything we do.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#17DEBC] flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-8 h-8 text-[#151515]" />
                </div>
                <h3 className="font-bold text-[20px] mb-3 text-[#151515]">{value.title}</h3>
                <p className="text-[#5A5A5A] text-[15px] leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 bg-white border-t border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515] text-center">
            Our Team
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            A diverse team of engineers, designers, and customer experience experts building the future of AI.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((dept) => (
              <div
                key={dept.name}
                className="bg-[#FFFDF5] border border-[#E8E6DB] rounded-lg p-8 text-center"
              >
                <h3 className="font-bold text-[20px] mb-2 text-[#151515]">{dept.name}</h3>
                <p className="text-[#5A5A5A] text-[15px]">{dept.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
      <section className="py-20 bg-[#151515]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[40px] mb-4 text-[#FFFDF5]">
            Join our team
          </h2>
          <p className="text-[#FFFDF5]/70 text-[18px] mb-8 max-w-2xl mx-auto">
            We're always looking for talented people who share our passion for building great products.
          </p>
          <Link
            href="/landing/careers"
            className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-flex items-center gap-2"
          >
            View Open Positions <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
