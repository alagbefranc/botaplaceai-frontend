"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  MessageCircle,
  Send,
  Loader2,
  X,
} from "lucide-react";
import { LandingNav, LandingFooter } from "./_components";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANDING_DEMO_AGENT_ID =
  process.env.NEXT_PUBLIC_LANDING_DEMO_AGENT_ID ??
  "00000000-b07a-0000-0000-000000000001";

// ─── Types ───────────────────────────────────────────────────────────────────

type AccordionState = Record<string, string>;

// ─── Data ────────────────────────────────────────────────────────────────────

const heroChips = [
  "Build a 24/7 support agent",
  "Launch outbound call missions",
  "Create a lead qualification bot",
  "Set up appointment scheduling",
];

const customerLogos = [
  { src: "https://www.telnyx.com/images/telnyx-logo.svg", alt: "Telnyx" },
  { src: "https://www.gstatic.com/devrel-devsite/prod/v0e0f589edd85502a40d78d7d0825db8ea5ef3b99ab4070381ee86977c9168730/cloud/images/cloud-logo.svg", alt: "Google Cloud" },
  { src: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg", alt: "Google Gemini" },
  { src: "https://supabase.com/dashboard/img/supabase-logo.svg", alt: "Supabase" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3ef535b74ee3ddec776d3_vonage.avif", alt: "Vonage" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3f03c42bfae49040f3fc2_twilio.avif", alt: "Twilio" },
];

const metrics = [
  { stat: "24/7 Availability", desc: "AI agents that never sleep, handling calls and chats around the clock" },
  { stat: "< 500ms Latency", desc: "Real-time voice conversations powered by Gemini Live API" },
  { stat: "Omnichannel", desc: "Voice, SMS, WhatsApp, web chat, and email from one platform" },
  { stat: "Smart Handoffs", desc: "Seamless transfer to human agents when needed" },
  { stat: "Mission Campaigns", desc: "Launch outbound call campaigns to thousands of contacts" },
];

const infrastructureCards = [
  {
    img: "/infra-voice-ai.png",
    title: "Gemini-Powered Voice AI",
    desc: "Real-time voice conversations using Google's Gemini Live API with sub-500ms latency. Natural, human-like interactions that understand context and nuance.",
  },
  {
    img: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3ec0fbe83d7add3a586b8_custom%20models.avif",
    title: "Fine-Tune on Your Data",
    desc: "Train custom models on your conversation history using Vertex AI supervised fine-tuning. Your agents get smarter with every interaction.",
  },
  {
    img: "/infra-telephony.png",
    title: "Enterprise-Grade Telephony",
    desc: "Powered by Telnyx for crystal-clear voice quality, global coverage, and carrier-grade reliability. Buy phone numbers, port existing ones, or bring your own.",
  },
  {
    img: "/infra-analytics.png",
    title: "Complete Call Analytics",
    desc: "Every conversation is transcribed, analyzed, and summarized. Track sentiment, extract insights, and measure success rates across all channels.",
  },
];

const platformSteps = [
  {
    key: "build",
    num: "01",
    title: "Build",
    desc: "Create AI agents with custom personalities, knowledge bases, and conversation flows. Configure voice settings, tools, and handoff rules.",
    bg: "bg-[#1D3B2D] border border-[#1D3B2D]",
    img: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b2f09692a18ad27c4ef8b5_bland_build_tab_1.png",
    accordion: [
      { key: "personas", title: "Agent Builder", content: "Visual editor to craft agent personalities, system prompts, and conversation styles. Test in real-time before deploying." },
      { key: "pathways", title: "Knowledge Base", content: "Upload documents, websites, and FAQs. Your agent learns your products, policies, and procedures instantly." },
      { key: "knowledge", title: "Custom Tools", content: "Connect to your CRM, calendar, or any API. Agents can book appointments, look up orders, and take actions." },
      { key: "voices", title: "Voice & Personality", content: "Choose from multiple AI voices and configure tone, speaking style, and language to match your brand." },
    ],
  },
  {
    key: "deploy",
    num: "02",
    title: "Deploy",
    desc: "Connect phone numbers, embed chat widgets, and launch across WhatsApp, SMS, and email. Go live in minutes, not months.",
    bg: "bg-[#5B438E] border border-[#5B438E]",
    img: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b2f145c4acfba8681d63ac_bland_deploy_tab_1.png",
    accordion: [
      { key: "routing", title: "Phone Numbers", content: "Buy new numbers or port existing ones. Assign to agents with automatic call routing and IVR support." },
      { key: "api", title: "Chat Widget", content: "Embed a customizable chat widget on your website. Supports voice calls directly from the browser." },
      { key: "campaigns", title: "Missions", content: "Launch outbound call campaigns to contact lists. Track progress, transcripts, and outcomes in real-time." },
    ],
  },
  {
    key: "monitor",
    num: "03",
    title: "Monitor",
    desc: "Real-time dashboards show active calls, conversation transcripts, and AI-generated summaries. Never miss an insight.",
    bg: "bg-white border border-[#E8E6DB]",
    img: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b2f1bd1de41bdcef326f34_bland_monitor_tab_1.png",
    accordion: [
      { key: "citations", title: "Live Calls", content: "Monitor active conversations in real-time. See transcripts as they happen and intervene when needed." },
      { key: "outcomes", title: "Call Analytics", content: "AI-powered analysis of every call: sentiment, success rate, key topics, and actionable insights." },
      { key: "compliance", title: "Handoff Queue", content: "When AI can't help, conversations transfer to your team with full context and suggested responses." },
    ],
  },
  {
    key: "refine",
    num: "04",
    title: "Refine",
    desc: "Fine-tune models on your conversation data. Agents learn from every interaction and continuously improve.",
    bg: "bg-[#4666AB] border border-[#4666AB]",
    img: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b2f29a2653ba21d198dd43_bland_refine_tab_1.png",
    accordion: [
      { key: "testbed", title: "Model Fine-Tuning", content: "Train custom Gemini models on your successful conversations using Vertex AI. Better responses, lower costs." },
      { key: "kb-gaps", title: "Conversation Insights", content: "Automatically identify knowledge gaps, common questions, and opportunities to improve agent responses." },
    ],
  },
];

const integrationLogos = [
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3ee33c27aeac8357bce86_Salesforce.com_logo.svg%201.avif", alt: "Salesforce" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3efb36f264009b9d95fdc_hubspot.avif", alt: "HubSpot" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3f0c8f3a8030ac03157c4_calendly.avif", alt: "Calendly" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3f0c8ba6f1825fe7f8ae2_zapier.svg", alt: "Zapier" },
  { src: "https://cdn.prod.website-files.com/66cddff3a7bb08f0bc015747/69b3ef835acea15d698d735b_slack.avif", alt: "Slack" },
];


// ─── Sub-components ───────────────────────────────────────────────────────────

function AccordionGroup({
  items,
  open,
  setOpen,
}: {
  items: { key: string; title: string; content: string }[];
  open: string;
  setOpen: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const isOpen = open === item.key;
        return (
          <div
            key={item.key}
            className={`border-b border-[#E8E6DB] pb-6 pt-2 transition-opacity ${isOpen ? "" : "opacity-60 hover:opacity-100"}`}
          >
            <button
              type="button"
              className="w-full flex justify-between items-center cursor-pointer text-[#151515]"
              onClick={() => setOpen(isOpen ? "" : item.key)}
            >
              <h4 className="font-bold text-[18px] text-left">{item.title}</h4>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-[#17DEBC] flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#5A5A5A] flex-shrink-0" />
              )}
            </button>
            {isOpen && (
              <p className="text-[#5A5A5A] mt-3 text-sm leading-relaxed pr-4">
                {item.content}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [heroInput, setHeroInput] = useState("");
  const [heroSubmitting, setHeroSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [accordions, setAccordions] = useState<AccordionState>({
    build: "personas",
    deploy: "routing",
    monitor: "citations",
    refine: "testbed",
  });
  // Chat widget state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // Audio state
  const [audioPlaying, setAudioPlaying] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );

  const setAccordionFor = (step: string, key: string) => {
    setAccordions((prev) => ({ ...prev, [step]: key }));
  };

  const handleChipClick = (chip: string) => {
    setHeroInput(chip);
    textareaRef.current?.focus();
  };

  const handleHeroSubmit = () => {
    if (!heroInput.trim()) return;
    setHeroSubmitting(true);
    window.location.href = `/app?prompt=${encodeURIComponent(heroInput)}`;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setPhoneLoading(true);
    setPhoneError("");
    try {
      const res = await fetch("/api/landing/demo-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPhoneError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setPhoneSent(true);
      }
    } catch {
      setPhoneError("Network error. Please check your connection and try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (audioPlaying) {
      el.pause();
      setAudioPlaying(false);
    } else {
      el.play().catch(() => setAudioPlaying(false));
      setAudioPlaying(true);
    }
  };

  const sendChatMessage = async (msg: string) => {
    if (!msg.trim() || chatLoading) return;
    const userMsg = { role: "user", content: msg };
    setChatMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: LANDING_DEMO_AGENT_ID,
          message: msg,
          sessionId: chatSessionId.current,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as { text?: string; greeting?: string; error?: string };
            const token = parsed.text ?? parsed.greeting ?? "";
            if (token) {
              assistantContent += token;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I ran into an issue. Please try again.",
        };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Auto-populate greeting when chat is first opened
  useEffect(() => {
    if (chatOpen && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "assistant",
          content:
            "Hi! I\u2019m Bota \u2014 Botaplace\u2019s demo AI. I can handle customer support, qualify leads, book appointments, and more. What would you like to know?",
        },
      ]);
    }
  }, [chatOpen, chatMessages.length]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div>
      {/* Announcement Bar */}
      <div className="bg-[#17DEBC] w-full text-[#151515] text-center py-2 font-medium text-sm md:text-base border-b border-[#151515]/10">
        Discover our new capabilities!{" "}
        <Link href="/landing#platform" className="underline hover:text-white transition-colors">
          Upgrade your legacy CX with Omnichannel AI
        </Link>
      </div>

      <LandingNav />

      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-32 lg:pt-32 lg:pb-48 bg-grid overflow-hidden border-b border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 items-center">
          {/* Hero Text */}
          <div className="max-w-2xl z-10">
            <h1
              className="font-heading font-bold text-[#151515] tracking-tight leading-tight mb-6"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.05 }}
            >
              The Omnichannel<br />AI CX Platform
            </h1>
            <p className="text-[22px] text-[#5A5A5A] mb-10 leading-relaxed font-normal">
              Deploy seamless customer experiences across voice, text, and chat instantly. Just tell it what you want to build.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-lg transition-colors flex items-center gap-2 shadow-lg"
              >
                Start Building Free <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Hero Interactive Graphic */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-8 animate-float">
              <img
                src="/bota-logo.png"
                alt="Botaplace AI"
                className="w-24 h-24 object-contain shadow-2xl rounded-full bg-[#FFFDF5] p-3 border border-[#E8E6DB]"
              />
            </div>

            {/* Input Box */}
            <div className="bg-white border border-[#E8E6DB] rounded-md shadow-xl w-full max-w-lg p-2 flex flex-col">
              <textarea
                ref={textareaRef}
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleHeroSubmit();
                }}
                className="w-full bg-transparent p-4 outline-none text-[#151515] placeholder:text-gray-400 resize-none h-32 text-[16px]"
                placeholder="Build a customer service agent for my e-commerce brand..."
              />
              <div className="flex justify-end p-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleHeroSubmit}
                  disabled={heroSubmitting}
                  className="bg-[#17DEBC] text-[#151515] w-10 h-10 flex items-center justify-center rounded-sm hover:bg-[#13C4A5] transition-colors disabled:opacity-60"
                  aria-label="Submit"
                >
                  {heroSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2 mt-4 max-w-lg justify-center w-full">
              {heroChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="bg-white border border-[#E8E6DB] px-3 py-1.5 text-sm rounded-sm whitespace-nowrap shadow-sm text-[#5A5A5A] cursor-pointer hover:border-[#17DEBC] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-24 border-b border-[#E8E6DB] bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-medium tracking-tight mb-12" style={{ fontSize: 40 }}>
            Powered by industry leaders
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-l border-[#E8E6DB] logo-grid logo-grid-6">
            {customerLogos.map((logo) => (
              <div
                key={logo.alt}
                className="flex items-center justify-center p-6 hover:bg-[#FFFDF5] transition-colors"
                style={{ aspectRatio: "5/3" }}
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="w-full h-full object-contain opacity-70 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 filter"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Feature Section */}
      <section className="py-24 border-b border-[#E8E6DB] bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="space-y-10">
            <h2
              className="font-heading font-bold tracking-tight"
              style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.1 }}
            >
              Automate channels without sacrificing quality
            </h2>
            <div className="space-y-8">
              {metrics.map((m) => (
                <div key={m.stat}>
                  <h4 className="font-bold text-xl mb-1 text-[#151515]">{m.stat}</h4>
                  <p className="text-[#5A5A5A] text-[15px]">{m.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 pt-4">
              <Link
                href="/landing#experience"
                className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 rounded-sm font-medium text-[15px] transition-colors"
              >
                Book a demo
              </Link>
              <Link
                href="/landing#platform"
                className="bg-white border border-[#E8E6DB] hover:bg-gray-50 px-6 py-3 rounded-sm font-medium text-[15px] transition-colors flex items-center gap-2 text-[#151515]"
              >
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Demo Audio Player */}
          <div className="bg-[#0D241C] relative w-full rounded-sm overflow-hidden flex items-start justify-end p-6 min-h-[360px] md:aspect-[4/3]">
            {/* Hidden audio element — src controlled by NEXT_PUBLIC_LANDING_DEMO_AUDIO_URL */}
            <audio
              ref={audioRef}
              src={process.env.NEXT_PUBLIC_LANDING_DEMO_AUDIO_URL ?? ""}
              preload="none"
              onEnded={() => setAudioPlaying(false)}
            />
            <button
              type="button"
              onClick={toggleAudio}
              className="bg-white/10 text-white backdrop-blur-sm px-4 py-2 text-sm rounded font-medium flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10 text-[13px]"
            >
              {audioPlaying ? (
                <>
                  <VolumeX className="w-4 h-4" /> Stop audio
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" /> Hear a real interaction
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Experience It Yourself CTA */}
      <section id="experience" className="bg-[#17DEBC] py-20 px-6 lg:px-12 w-full text-[#151515]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div>
            <h2
              className="font-heading font-bold mb-3 tracking-tight"
              style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.1 }}
            >
              Experience it yourself
            </h2>
            <p className="text-[20px] font-medium opacity-90">
              Have our AI agent call you right now. Answer your phone in about 15 seconds.
            </p>
          </div>
          <div className="w-full max-w-[400px]">
            {phoneSent ? (
              <div className="bg-white/20 border border-[#151515]/20 p-6 rounded-sm text-center">
                <p className="font-bold text-lg mb-1">On its way!</p>
                <p className="text-[15px] opacity-90">
                  Expect a call to <strong>{phone}</strong> within 15 seconds.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-3">
                <input
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={phoneLoading}
                  className="w-full bg-white/20 border border-[#151515]/20 placeholder:text-[#151515]/60 p-4 rounded-sm outline-none focus:border-[#151515] text-[#151515] font-medium transition-colors disabled:opacity-60"
                />
                {phoneError && (
                  <p className="text-[#151515] bg-white/30 border border-[#151515]/20 px-3 py-2 rounded-sm text-sm font-medium">
                    {phoneError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="w-full bg-[#151515] text-[#FFFDF5] py-4 rounded-sm font-bold text-[15px] hover:bg-black transition-colors shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {phoneLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Calling…
                    </>
                  ) : (
                    "Connect Now"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Infrastructure Grid */}
      <section className="py-24 border-b border-[#E8E6DB] bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-16 max-w-2xl">
            <h2
              className="font-heading font-bold tracking-tight mb-8"
              style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.1 }}
            >
              Self-hosted infrastructure optimized for speed, security, and reliability
            </h2>
            <Link
              href="#"
              className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 inline-flex rounded-sm font-medium text-[15px] transition-colors items-center gap-2"
            >
              Learn more <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {infrastructureCards.map((card) => (
              <div key={card.title}>
                <div className="bg-white border border-[#E8E6DB] rounded-sm overflow-hidden mb-6 flex items-center justify-center p-8" style={{ aspectRatio: "16/9" }}>
                  <img src={card.img} alt={card.title} className="w-full h-full object-contain" />
                </div>
                <h3 className="text-[22px] font-bold mb-3">{card.title}</h3>
                <p className="text-[#5A5A5A] text-[16px] leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Break */}
      <section className="py-24 border-b border-[#E8E6DB] bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="space-y-8">
            <h2
              className="font-heading font-bold tracking-tight leading-tight"
              style={{ fontSize: "clamp(32px, 3.5vw, 44px)" }}
            >
              Built for teams who value customer experience
            </h2>
            <Link
              href="/app"
              className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 inline-flex rounded-sm font-medium text-[15px] transition-colors items-center gap-2"
            >
              Start building today <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-white border border-[#E8E6DB] rounded-sm p-10 lg:p-14 shadow-sm">
            <div className="mb-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#17DEBC] border border-[#E8E6DB] flex items-center justify-center text-sm font-bold text-[#151515]">
                AI
              </div>
              <span className="font-medium text-[#5A5A5A] text-sm">Voice AI Platform</span>
            </div>
            <h3 className="text-[32px] font-bold mb-6 font-heading tracking-tight text-[#151515]">
              80%{" "}
              <span className="text-[20px] font-normal text-[#5A5A5A] ml-2 tracking-normal">calls automated</span>
            </h3>
            <p className="text-[22px] font-medium leading-relaxed text-[#151515] mb-10">
              &ldquo;Our AI agents handle thousands of calls daily with the same quality as our best human agents.&rdquo;
            </p>
            <div>
              <h4 className="font-bold text-[#151515]">Your Success Story</h4>
              <p className="text-[#5A5A5A] text-sm">Could be next</p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="platform" className="py-24 bg-[#FFFDF5] relative">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-end mb-24 border-b border-[#E8E6DB] pb-10 gap-8 flex-wrap">
            <h2
              className="font-heading font-bold tracking-tight max-w-xl"
              style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.1 }}
            >
              The most robust agent development platform
            </h2>
            <Link
              href="/landing#experience"
              className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 inline-flex rounded-sm font-medium text-[15px] transition-colors items-center gap-2 hidden md:inline-flex"
            >
              Book a demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-32 pb-20">
            {platformSteps.map((step) => (
              <div key={step.key} className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Step label + text */}
                <div className="lg:col-span-3 lg:sticky lg:top-32">
                  <span className="text-[#5A5A5A] text-sm mb-4 block tracking-widest uppercase">
                    {step.num}
                  </span>
                  <h3 className="text-[32px] font-bold font-heading mb-4 text-[#151515]">
                    {step.title}
                  </h3>
                  <p className="text-[#5A5A5A] leading-relaxed text-[16px]">{step.desc}</p>
                </div>

                {/* Screenshot */}
                <div
                  className={`lg:col-span-6 flex justify-center ${step.bg} pt-12 px-6 rounded-sm min-h-[400px] overflow-hidden`}
                >
                  <img
                    src={step.img}
                    alt={`${step.title} interface`}
                    className="w-full max-w-[497px] h-auto object-cover object-top shadow-2xl rounded-t-lg mt-auto translate-y-4"
                  />
                </div>

                {/* Accordion */}
                <div className="lg:col-span-3 lg:sticky lg:top-32">
                  <AccordionGroup
                    items={step.accordion}
                    open={accordions[step.key] ?? step.accordion[0].key}
                    setOpen={(k) => setAccordionFor(step.key, k)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="pb-24 pt-12 border-b border-[#E8E6DB] bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-12">
            <h2 className="font-heading font-bold mb-4 text-[#151515]" style={{ fontSize: 44 }}>
              Integrations
            </h2>
            <p className="text-[#5A5A5A] text-[18px]">
              Build custom workflows with our open REST API &amp; webhooks
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 border-t border-l border-[#E8E6DB] logo-grid logo-grid-5 bg-white">
            {integrationLogos.map((logo) => (
              <div
                key={logo.alt}
                className="flex items-center justify-center p-8 hover:bg-[#FFFDF5] transition-colors h-[120px]"
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="max-h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0 filter"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />

      {/* ── Floating Live Chat Widget ────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-[340px] bg-white rounded-xl shadow-2xl border border-[#E8E6DB] flex flex-col overflow-hidden"
            style={{ height: 480 }}>
            {/* Header */}
            <div className="bg-[#151515] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#17DEBC] animate-pulse" />
                <span className="text-white font-semibold text-sm">Bota — Live Demo</span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAF8]">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-[14px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#17DEBC] text-[#151515] rounded-br-sm"
                        : "bg-white border border-[#E8E6DB] text-[#151515] rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A5A] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A5A] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A5A] animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[#E8E6DB] bg-white flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChatMessage(chatInput);
                  }
                }}
                placeholder="Ask Bota anything…"
                disabled={chatLoading}
                className="flex-1 text-sm outline-none bg-[#FAFAF8] border border-[#E8E6DB] rounded-md px-3 py-2 placeholder:text-gray-400 focus:border-[#17DEBC] transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void sendChatMessage(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#17DEBC] text-[#151515] w-9 h-9 flex items-center justify-center rounded-md hover:bg-[#13C4A5] transition-colors disabled:opacity-50 flex-shrink-0"
                aria-label="Send"
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          className="w-14 h-14 bg-[#17DEBC] text-[#151515] rounded-full shadow-xl flex items-center justify-center hover:bg-[#13C4A5] transition-colors"
          aria-label={chatOpen ? "Close chat" : "Chat with Bota"}
        >
          {chatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
