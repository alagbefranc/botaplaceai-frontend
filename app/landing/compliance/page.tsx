"use client";

import { Shield, FileCheck, Globe, Building, Scale, Lock } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const frameworks = [
  {
    icon: Shield,
    name: "SOC 2 Type II",
    status: "Certified",
    desc: "Independent verification of our security controls, availability, and confidentiality practices.",
  },
  {
    icon: Globe,
    name: "GDPR",
    status: "Compliant",
    desc: "Full compliance with EU data protection regulations, including data subject rights and cross-border transfers.",
  },
  {
    icon: Building,
    name: "HIPAA",
    status: "Ready",
    desc: "Technical safeguards and BAA availability for healthcare organizations handling protected health information.",
  },
  {
    icon: FileCheck,
    name: "PCI DSS",
    status: "Compliant",
    desc: "Secure handling of payment card data through certified payment processors.",
  },
  {
    icon: Scale,
    name: "CCPA",
    status: "Compliant",
    desc: "California Consumer Privacy Act compliance for California residents' data rights.",
  },
  {
    icon: Lock,
    name: "ISO 27001",
    status: "In Progress",
    desc: "International standard for information security management systems.",
  },
];

const dataHandling = [
  {
    title: "Data Processing Agreements",
    desc: "We provide DPAs that meet GDPR and other regulatory requirements for all customers.",
  },
  {
    title: "Data Residency",
    desc: "Choose where your data is stored to meet local compliance requirements.",
  },
  {
    title: "Data Retention",
    desc: "Configurable retention policies to meet your regulatory obligations.",
  },
  {
    title: "Right to Deletion",
    desc: "Full support for data subject deletion requests and data portability.",
  },
  {
    title: "Subprocessor Management",
    desc: "Transparent list of subprocessors with notification of changes.",
  },
  {
    title: "Audit Support",
    desc: "Documentation and access for your compliance audits and assessments.",
  },
];

export default function CompliancePage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Compliance"
        subtitle="We maintain comprehensive compliance programs to help you meet your regulatory obligations across industries and regions."
      />

      {/* Compliance Frameworks */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515] text-center">
            Compliance Frameworks
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            We adhere to industry-leading compliance standards to ensure your data is protected.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {frameworks.map((framework) => (
              <div
                key={framework.name}
                className="bg-white border border-[#E8E6DB] rounded-lg p-8 hover:border-[#17DEBC] transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <framework.icon className="w-10 h-10 text-[#17DEBC]" />
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    framework.status === "Certified" || framework.status === "Compliant"
                      ? "bg-[#17DEBC]/20 text-[#0D7D6A]"
                      : "bg-[#E8E6DB] text-[#5A5A5A]"
                  }`}>
                    {framework.status}
                  </span>
                </div>
                <h3 className="font-bold text-[20px] mb-3 text-[#151515]">{framework.name}</h3>
                <p className="text-[#5A5A5A] text-[15px] leading-relaxed">{framework.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Handling */}
      <section className="py-24 bg-white border-t border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515] text-center">
            Data Handling & Privacy
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            We provide the tools and agreements you need to maintain compliance.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataHandling.map((item) => (
              <div
                key={item.title}
                className="bg-[#FFFDF5] border border-[#E8E6DB] rounded-lg p-6"
              >
                <h3 className="font-bold text-[18px] mb-2 text-[#151515]">{item.title}</h3>
                <p className="text-[#5A5A5A] text-[14px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Specific */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-12 text-[#151515] text-center">
            Industry-Specific Compliance
          </h2>
          <div className="space-y-8 text-[#5A5A5A]">
            <div className="bg-white border border-[#E8E6DB] rounded-lg p-8">
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Healthcare</h3>
              <p className="leading-relaxed">
                HIPAA-ready infrastructure with Business Associate Agreements (BAA) available. Technical safeguards include encryption, access controls, and audit logging to protect PHI.
              </p>
            </div>
            <div className="bg-white border border-[#E8E6DB] rounded-lg p-8">
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Financial Services</h3>
              <p className="leading-relaxed">
                PCI DSS compliant payment handling, SOC 2 certified infrastructure, and comprehensive audit trails for regulatory examinations.
              </p>
            </div>
            <div className="bg-white border border-[#E8E6DB] rounded-lg p-8">
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Government</h3>
              <p className="leading-relaxed">
                Data residency options, enhanced security controls, and documentation to support government procurement requirements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 bg-[#151515]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[32px] mb-4 text-[#FFFDF5]">
            Need Compliance Documentation?
          </h2>
          <p className="text-[#FFFDF5]/70 text-[18px] mb-6">
            Contact us for SOC 2 reports, DPAs, or other compliance documentation.
          </p>
          <a
            href="mailto:compliance@botaplace.ai"
            className="bg-[#17DEBC] text-[#151515] hover:bg-[#13C4A5] px-8 py-4 rounded-sm font-medium text-[16px] transition-colors inline-block"
          >
            compliance@botaplace.ai
          </a>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
