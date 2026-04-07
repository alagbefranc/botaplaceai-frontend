"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const posts = [
  {
    title: "Introducing Gemini-Powered Voice AI",
    excerpt: "We're excited to announce our integration with Google's Gemini Live API, bringing sub-500ms latency voice conversations to your AI agents.",
    date: "2024-12-15",
    category: "Product",
    readTime: "4 min read",
  },
  {
    title: "How to Build Your First AI Support Agent",
    excerpt: "A step-by-step guide to creating an AI agent that handles customer support inquiries 24/7 with human-like conversations.",
    date: "2024-12-10",
    category: "Tutorial",
    readTime: "8 min read",
  },
  {
    title: "The Future of Outbound Campaigns",
    excerpt: "Learn how AI-powered missions are transforming outbound sales and customer outreach with personalized, scalable conversations.",
    date: "2024-12-05",
    category: "Insights",
    readTime: "6 min read",
  },
  {
    title: "Fine-Tuning Models on Your Conversation Data",
    excerpt: "Discover how to use Vertex AI supervised fine-tuning to create custom models that understand your business perfectly.",
    date: "2024-11-28",
    category: "Technical",
    readTime: "10 min read",
  },
  {
    title: "Best Practices for AI-to-Human Handoffs",
    excerpt: "When should AI hand off to humans? Learn the strategies that maximize automation while maintaining customer satisfaction.",
    date: "2024-11-20",
    category: "Best Practices",
    readTime: "5 min read",
  },
  {
    title: "Omnichannel CX: Voice, Chat, and Beyond",
    excerpt: "Why the best customer experiences span multiple channels, and how to build a unified AI strategy across all touchpoints.",
    date: "2024-11-15",
    category: "Strategy",
    readTime: "7 min read",
  },
];

const categories = ["All", "Product", "Tutorial", "Insights", "Technical", "Best Practices", "Strategy"];

export default function BlogPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Blog"
        subtitle="Insights, tutorials, and updates from the Botaplace team. Learn how to build better AI-powered customer experiences."
      />

      {/* Categories */}
      <section className="py-8 border-b border-[#E8E6DB] bg-white sticky top-20 z-40">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full text-[14px] font-medium transition-colors ${
                  cat === "All"
                    ? "bg-[#151515] text-[#FFFDF5]"
                    : "bg-[#FFFDF5] text-[#5A5A5A] hover:bg-[#E8E6DB] border border-[#E8E6DB]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.title}
                className="bg-white border border-[#E8E6DB] rounded-lg overflow-hidden hover:border-[#17DEBC] transition-colors group"
              >
                <div className="aspect-video bg-[#E8E6DB]" />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[#17DEBC] text-xs font-medium uppercase tracking-wider">
                      {post.category}
                    </span>
                    <span className="text-[#5A5A5A] text-xs">•</span>
                    <span className="text-[#5A5A5A] text-xs">{post.readTime}</span>
                  </div>
                  <h3 className="font-bold text-[18px] mb-3 text-[#151515] group-hover:text-[#17DEBC] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-[#5A5A5A] text-[14px] leading-relaxed mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 text-[#5A5A5A] text-xs">
                    <Calendar className="w-3 h-3" />
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 bg-[#17DEBC]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515]">
            Stay in the loop
          </h2>
          <p className="text-[#151515]/80 text-[18px] mb-8 max-w-xl mx-auto">
            Get the latest articles, tutorials, and product updates delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-sm border border-[#151515]/20 bg-white/20 placeholder:text-[#151515]/60 text-[#151515] outline-none focus:border-[#151515]"
            />
            <button className="bg-[#151515] text-[#FFFDF5] hover:bg-black px-6 py-3 rounded-sm font-medium text-[15px] transition-colors flex items-center justify-center gap-2">
              Subscribe <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
