"use client";

import { useState } from "react";
import { ArrowRight, Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate form submission
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div>
      <LandingNav />

      <PageHero
        title="Get in touch"
        subtitle="Have questions about Botaplace? Want to see a demo? We'd love to hear from you."
      />

      {/* Contact Section */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Contact Form */}
            <div className="bg-white border border-[#E8E6DB] rounded-lg p-8 lg:p-12">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#17DEBC] flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-[#151515]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-[24px] mb-3 text-[#151515]">Message sent!</h3>
                  <p className="text-[#5A5A5A] text-[16px]">
                    Thanks for reaching out. We'll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[#151515] font-medium text-[14px] mb-2">Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border border-[#E8E6DB] rounded-sm outline-none focus:border-[#17DEBC] transition-colors text-[#151515]"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-[#151515] font-medium text-[14px] mb-2">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border border-[#E8E6DB] rounded-sm outline-none focus:border-[#17DEBC] transition-colors text-[#151515]"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#151515] font-medium text-[14px] mb-2">Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E8E6DB] rounded-sm outline-none focus:border-[#17DEBC] transition-colors text-[#151515]"
                      placeholder="Your company"
                    />
                  </div>
                  <div>
                    <label className="block text-[#151515] font-medium text-[14px] mb-2">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E8E6DB] rounded-sm outline-none focus:border-[#17DEBC] transition-colors text-[#151515] bg-white"
                    >
                      <option value="">Select a topic</option>
                      <option value="demo">Request a Demo</option>
                      <option value="sales">Sales Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="partnership">Partnership</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#151515] font-medium text-[14px] mb-2">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 border border-[#E8E6DB] rounded-sm outline-none focus:border-[#17DEBC] transition-colors text-[#151515] resize-none"
                      placeholder="How can we help?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] py-4 rounded-sm font-medium text-[16px] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        Send Message <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-12">
              <div>
                <h2 className="font-heading font-bold text-[32px] mb-6 text-[#151515]">
                  Let's talk
                </h2>
                <p className="text-[#5A5A5A] text-[18px] leading-relaxed">
                  Whether you're looking for a demo, have questions about our platform, or want to explore a partnership, we're here to help.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#17DEBC] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#151515]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] mb-1 text-[#151515]">Email</h3>
                    <p className="text-[#5A5A5A]">hello@botaplace.ai</p>
                    <p className="text-[#5A5A5A]">support@botaplace.ai</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#17DEBC] flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#151515]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] mb-1 text-[#151515]">Phone</h3>
                    <p className="text-[#5A5A5A]">+1 (555) 123-4567</p>
                    <p className="text-[#5A5A5A] text-sm">Mon-Fri, 9am-6pm EST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#17DEBC] flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-[#151515]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] mb-1 text-[#151515]">Office</h3>
                    <p className="text-[#5A5A5A]">Remote-first company</p>
                    <p className="text-[#5A5A5A] text-sm">Team members worldwide</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#151515] rounded-lg p-8">
                <h3 className="font-bold text-[20px] mb-3 text-[#FFFDF5]">
                  Enterprise inquiries
                </h3>
                <p className="text-[#FFFDF5]/70 text-[15px] mb-6">
                  Looking for custom solutions, dedicated support, or volume pricing? Our enterprise team is ready to help.
                </p>
                <a
                  href="mailto:enterprise@botaplace.ai"
                  className="text-[#17DEBC] font-medium text-[15px] inline-flex items-center gap-2 hover:gap-3 transition-all"
                >
                  enterprise@botaplace.ai <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
