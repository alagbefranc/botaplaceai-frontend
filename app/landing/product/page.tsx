"use client";

import Link from "next/link";
import { ArrowRight, Bot, Phone, Rocket, BarChart3, Plug, MessageSquare, Users, Zap } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const features = [
  {
    id: "agents",
    icon: Bot,
    title: "Agent Builder",
    desc: "Create AI agents with custom personalities, system prompts, and conversation flows. Configure knowledge bases, tools, and handoff rules.",
    highlights: [
      "Visual prompt editor with real-time testing",
      "Upload documents, websites, and FAQs to knowledge base",
      "Connect custom tools and APIs",
      "Configure voice personality and speaking style",
    ],
  },
  {
    id: "voice",
    icon: Phone,
    title: "Voice & Telephony",
    desc: "Enterprise-grade phone system powered by Telnyx. Buy numbers, port existing ones, and handle inbound/outbound calls with AI.",
    highlights: [
      "Buy phone numbers in 100+ countries",
      "Port existing numbers seamlessly",
      "Real-time voice with Gemini Live API",
      "Call recording and transcription",
    ],
  },
  {
    id: "missions",
    icon: Rocket,
    title: "Missions",
    desc: "Launch outbound call campaigns to contact lists. Track progress, transcripts, and outcomes in real-time.",
    highlights: [
      "Upload contact lists or sync from CRM",
      "Schedule campaigns for optimal times",
      "AI-generated call summaries",
      "Success tracking and analytics",
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Analytics & Insights",
    desc: "Every conversation is transcribed, analyzed, and summarized. Track sentiment, extract insights, and measure success.",
    highlights: [
      "Real-time conversation monitoring",
      "AI-powered sentiment analysis",
      "Custom insight extraction",
      "Exportable reports and dashboards",
    ],
  },
  {
    id: "integrations",
    icon: Plug,
    title: "Integrations",
    desc: "Connect to your existing tools and workflows. REST API, webhooks, and native integrations with popular platforms.",
    highlights: [
      "Salesforce, HubSpot, Calendly",
      "Zapier and custom webhooks",
      "Full REST API access",
      "Real-time event streaming",
    ],
  },
];

const channels = [
  { icon: Phone, label: "Voice Calls", desc: "Inbound and outbound phone calls" },
  { icon: MessageSquare, label: "Web Chat", desc: "Embeddable chat widget" },
  { icon: Zap, label: "SMS", desc: "Two-way text messaging" },
  { icon: Users, label: "WhatsApp", desc: "Business messaging" },
];

export default function ProductPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Everything you need to build AI-powered customer experiences"
        subtitle="From agent creation to deployment, monitoring, and optimization — Botaplace gives you the complete platform to automate customer interactions across every channel."
        ctaText="Start Building Free"
        ctaHref="/auth/signup"
      />

      {/* Channels Section */}
      <section className="py-20 border-b border-[#E8E6DB] bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[32px] mb-4 text-[#151515]">
            One platform, every channel
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-12 max-w-2xl">
            Deploy your AI agents across voice, chat, SMS, and messaging platforms from a single dashboard.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map((channel) => (
              <div
                key={channel.label}
                className="bg-[#FFFDF5] border border-[#E8E6DB] rounded-lg p-6 hover:border-[#17DEBC] transition-colors"
              >
                <channel.icon className="w-10 h-10 text-[#17DEBC] mb-4" />
                <h3 className="font-bold text-[18px] mb-2 text-[#151515]">{channel.label}</h3>
                <p className="text-[#5A5A5A] text-[14px]">{channel.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="space-y-24">
            {features.map((feature, idx) => (
              <div
                key={feature.id}
                id={feature.id}
                className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${idx % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
              >
                <div className={idx % 2 === 1 ? "lg:order-2" : ""}>
                  <feature.icon className="w-12 h-12 text-[#17DEBC] mb-6" />
                  <h3 className="font-heading font-bold text-[32px] mb-4 text-[#151515]">
                    {feature.title}
                  </h3>
                  <p className="text-[#5A5A5A] text-[18px] mb-8 leading-relaxed">
                    {feature.desc}
                  </p>
                  <ul className="space-y-3">
                    {feature.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#17DEBC] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-[#151515]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[#151515] text-[15px]">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`bg-[#E8E6DB] rounded-lg aspect-video flex items-center justify-center ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
                  <feature.icon className="w-24 h-24 text-[#5A5A5A]/30" />
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
            Ready to transform your customer experience?
          </h2>
          <p className="text-[#151515]/80 text-[20px] mb-8 max-w-2xl mx-auto">
            Start building AI agents today. No credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/landing#experience"
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
