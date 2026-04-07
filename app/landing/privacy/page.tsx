"use client";

import { LandingNav, LandingFooter, PageHero } from "../_components";

export default function PrivacyPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Privacy Policy"
        subtitle="Last updated: December 15, 2024"
      />

      <section className="py-16 bg-[#FFFDF5]">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12">
          <div className="prose prose-lg max-w-none">
            <div className="space-y-8 text-[#5A5A5A]">
              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">1. Introduction</h2>
                <p className="leading-relaxed">
                  Botaplace AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">2. Information We Collect</h2>
                <p className="leading-relaxed mb-4">We collect information that you provide directly to us, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account information (name, email, company)</li>
                  <li>Payment information (processed securely via third-party providers)</li>
                  <li>Communication data (support requests, feedback)</li>
                  <li>Usage data (how you interact with our platform)</li>
                  <li>Conversation data (transcripts, recordings when enabled)</li>
                </ul>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">3. How We Use Your Information</h2>
                <p className="leading-relaxed mb-4">We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process transactions and send related information</li>
                  <li>Send technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
                  <li>Analyze usage patterns to improve user experience</li>
                  <li>Train and improve AI models (with your consent)</li>
                </ul>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">4. Data Sharing</h2>
                <p className="leading-relaxed">
                  We do not sell your personal information. We may share information with third-party service providers who perform services on our behalf, such as payment processing, data analysis, and customer support. These providers are bound by contractual obligations to keep personal information confidential.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">5. Data Security</h2>
                <p className="leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption in transit and at rest, regular security assessments, and access controls.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">6. Data Retention</h2>
                <p className="leading-relaxed">
                  We retain your information for as long as your account is active or as needed to provide services. You may request deletion of your data at any time by contacting us at privacy@botaplace.ai.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">7. Your Rights</h2>
                <p className="leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Object to processing of your data</li>
                  <li>Request data portability</li>
                  <li>Withdraw consent at any time</li>
                </ul>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">8. Cookies</h2>
                <p className="leading-relaxed">
                  We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">9. Changes to This Policy</h2>
                <p className="leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </div>

              <div>
                <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">10. Contact Us</h2>
                <p className="leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p className="mt-4">
                  <strong className="text-[#151515]">Email:</strong> privacy@botaplace.ai<br />
                  <strong className="text-[#151515]">Address:</strong> Botaplace AI, Privacy Team
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
