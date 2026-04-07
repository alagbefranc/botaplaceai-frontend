"use client";

import Link from "next/link";
import { ArrowRight, Headphones, TrendingUp, Calendar, Quote } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const caseStudies = [
  {
    id: "support",
    icon: Headphones,
    category: "Customer Support",
    title: "24/7 Automated Support",
    metric: "80%",
    metricLabel: "calls automated",
    description: "Deploy AI agents that handle customer inquiries around the clock, reducing wait times and improving satisfaction scores.",
    highlights: [
      "Instant response to common questions",
      "Seamless handoff to human agents when needed",
      "Multi-language support",
      "Consistent quality at any scale",
    ],
    quote: "Our AI agents handle thousands of support calls daily with the same quality as our best human agents.",
  },
  {
    id: "sales",
    icon: TrendingUp,
    category: "Sales & Lead Generation",
    title: "Qualify and Convert Leads",
    metric: "3x",
    metricLabel: "more qualified leads",
    description: "AI agents that engage prospects, qualify leads, and schedule demos — working 24/7 to fill your pipeline.",
    highlights: [
      "Instant lead engagement",
      "Smart qualification questions",
      "CRM integration",
      "Automated follow-ups",
    ],
    quote: "We've tripled our qualified leads without adding headcount. The AI handles initial conversations perfectly.",
  },
  {
    id: "appointments",
    icon: Calendar,
    category: "Appointment Scheduling",
    title: "Automated Booking",
    metric: "60%",
    metricLabel: "reduction in no-shows",
    description: "Let AI handle appointment scheduling, confirmations, and reminders. Reduce no-shows and free up your team.",
    highlights: [
      "Calendar integration",
      "Automated reminders",
      "Rescheduling support",
      "Multi-timezone handling",
    ],
    quote: "No-shows dropped by 60% after implementing AI-powered reminders and easy rescheduling.",
  },
];

export default function CaseStudiesPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Real results from real customers"
        subtitle="See how organizations are transforming their customer experience with AI-powered agents across support, sales, and operations."
        ctaText="Start Your Success Story"
        ctaHref="/auth/signup"
      />

      {/* Case Studies */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="space-y-24">
            {caseStudies.map((study, idx) => (
              <div
                key={study.id}
                id={study.id}
                className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
              >
                <div className={idx % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-2 mb-4">
                    <study.icon className="w-5 h-5 text-[#17DEBC]" />
                    <span className="text-[#17DEBC] font-medium text-sm uppercase tracking-wider">
                      {study.category}
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515]">
                    {study.title}
                  </h2>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="font-heading font-bold text-[56px] text-[#17DEBC]">{study.metric}</span>
                    <span className="text-[#5A5A5A] text-[18px]">{study.metricLabel}</span>
                  </div>
                  <p className="text-[#5A5A5A] text-[18px] mb-8 leading-relaxed">
                    {study.description}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {study.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#17DEBC] flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-[#151515]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[#151515] text-[15px]">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`bg-white border border-[#E8E6DB] rounded-lg p-10 ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
                  <Quote className="w-10 h-10 text-[#17DEBC] mb-6" />
                  <p className="text-[#151515] text-[22px] font-medium leading-relaxed mb-8">
                    "{study.quote}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#17DEBC] flex items-center justify-center text-[#151515] font-bold">
                      {study.category.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-[#151515]">Success Story</div>
                      <div className="text-[#5A5A5A] text-sm">{study.category}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#17DEBC]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[40px] mb-4 text-[#151515]">
            Ready to write your success story?
          </h2>
          <p className="text-[#151515]/80 text-[18px] mb-8 max-w-2xl mx-auto">
            Join organizations that are transforming customer experience with AI.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/landing/contact"
              className="bg-white text-[#151515] hover:bg-gray-50 px-8 py-4 rounded-sm font-medium text-[16px] transition-colors border border-[#151515]/20"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
