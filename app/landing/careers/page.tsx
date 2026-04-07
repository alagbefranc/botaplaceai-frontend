"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Clock, Briefcase } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const openings = [
  {
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    desc: "Build the core platform that powers AI agents across voice, chat, and messaging channels.",
  },
  {
    title: "AI/ML Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    desc: "Work on fine-tuning, prompt engineering, and optimizing AI models for real-time conversations.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
    desc: "Design intuitive interfaces that make complex AI capabilities accessible to everyone.",
  },
  {
    title: "Customer Success Manager",
    department: "Customer Success",
    location: "Remote",
    type: "Full-time",
    desc: "Help customers succeed with AI agents and drive adoption across their organizations.",
  },
  {
    title: "Technical Writer",
    department: "Product",
    location: "Remote",
    type: "Full-time",
    desc: "Create documentation, tutorials, and guides that help developers build with our platform.",
  },
];

const benefits = [
  "Competitive salary and equity",
  "Remote-first culture",
  "Unlimited PTO",
  "Health, dental, and vision insurance",
  "Home office stipend",
  "Learning and development budget",
  "Team offsites",
  "Latest equipment",
];

export default function CareersPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Join us in building the future of CX"
        subtitle="We're looking for talented people who are passionate about AI, customer experience, and building products that make a difference."
      />

      {/* Why Join Section */}
      <section className="py-24 bg-white border-b border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading font-bold text-[36px] mb-6 text-[#151515]">
                Why Botaplace?
              </h2>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed mb-6">
                We're at the forefront of AI-powered customer experience. Every day, our platform handles thousands of conversations, helping businesses connect with their customers in more meaningful ways.
              </p>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed mb-8">
                Join a team where your work has real impact, where you'll learn from talented colleagues, and where we're building something that matters.
              </p>
              <h3 className="font-bold text-[20px] mb-4 text-[#151515]">Benefits & Perks</h3>
              <div className="grid grid-cols-2 gap-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#17DEBC]" />
                    <span className="text-[#5A5A5A] text-[14px]">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#17DEBC] rounded-lg aspect-square flex items-center justify-center">
              <Briefcase className="w-32 h-32 text-[#151515]/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515]">
            Open Positions
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-12">
            Find your next role and help us build the future of customer experience.
          </p>
          <div className="space-y-4">
            {openings.map((job) => (
              <div
                key={job.title}
                className="bg-white border border-[#E8E6DB] rounded-lg p-6 hover:border-[#17DEBC] transition-colors group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[20px] mb-2 text-[#151515] group-hover:text-[#17DEBC] transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-[#5A5A5A] text-[15px] mb-3">{job.desc}</p>
                    <div className="flex flex-wrap items-center gap-4 text-[#5A5A5A] text-[13px]">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {job.type}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/landing/contact"
                    className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 rounded-sm font-medium text-[14px] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    Apply Now <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Don't See Your Role CTA */}
      <section className="py-20 bg-[#151515]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#FFFDF5]">
            Don't see your role?
          </h2>
          <p className="text-[#FFFDF5]/70 text-[18px] mb-8 max-w-2xl mx-auto">
            We're always looking for exceptional people. Send us your resume and tell us how you'd like to contribute.
          </p>
          <Link
            href="/landing/contact"
            className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-flex items-center gap-2"
          >
            Get in Touch <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
