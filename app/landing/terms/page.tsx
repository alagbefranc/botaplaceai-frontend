"use client";

import { LandingNav, LandingFooter, PageHero } from "../_components";

export default function TermsPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Terms of Service"
        subtitle="Last updated: December 15, 2024"
      />

      <section className="py-16 bg-[#FFFDF5]">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12">
          <div className="space-y-8 text-[#5A5A5A]">
            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By accessing or using Botaplace AI's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">2. Description of Service</h2>
              <p className="leading-relaxed">
                Botaplace AI provides an omnichannel AI customer experience platform that enables businesses to build, deploy, and manage AI-powered agents across voice, chat, SMS, and other communication channels.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">3. Account Registration</h2>
              <p className="leading-relaxed mb-4">To use our services, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly update any changes to your information</li>
                <li>Be at least 18 years old or have legal authority to enter into this agreement</li>
              </ul>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">4. Acceptable Use</h2>
              <p className="leading-relaxed mb-4">You agree not to use our services to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Send spam or unsolicited communications</li>
                <li>Distribute malware or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Engage in fraudulent or deceptive practices</li>
                <li>Harass, abuse, or harm others</li>
              </ul>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">5. Payment Terms</h2>
              <p className="leading-relaxed">
                Paid services are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law or as explicitly stated in these terms. We reserve the right to change our pricing with 30 days' notice.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">6. Intellectual Property</h2>
              <p className="leading-relaxed">
                Our platform, including all software, content, and trademarks, is owned by Botaplace AI. You retain ownership of your data and content. By using our services, you grant us a license to use your content solely to provide and improve our services.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">7. Data and Privacy</h2>
              <p className="leading-relaxed">
                Your use of our services is also governed by our Privacy Policy. You are responsible for ensuring that your use of our services complies with applicable data protection laws, including obtaining necessary consents from your end users.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">8. Service Availability</h2>
              <p className="leading-relaxed">
                We strive to maintain high availability but do not guarantee uninterrupted service. We may perform maintenance or updates that temporarily affect service availability. We will provide reasonable notice when possible.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">9. Limitation of Liability</h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, Botaplace AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">10. Indemnification</h2>
              <p className="leading-relaxed">
                You agree to indemnify and hold harmless Botaplace AI from any claims, damages, or expenses arising from your use of our services or violation of these terms.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">11. Termination</h2>
              <p className="leading-relaxed">
                Either party may terminate this agreement at any time. Upon termination, your right to use our services will cease immediately. We may retain your data for a reasonable period to comply with legal obligations.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">12. Changes to Terms</h2>
              <p className="leading-relaxed">
                We may modify these terms at any time. We will notify you of material changes via email or through our platform. Continued use of our services after changes constitutes acceptance of the new terms.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-[24px] mb-4 text-[#151515]">13. Contact</h2>
              <p className="leading-relaxed">
                For questions about these Terms of Service, please contact us at legal@botaplace.ai.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
