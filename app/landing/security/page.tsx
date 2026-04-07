"use client";

import { Shield, Lock, Eye, Server, CheckCircle, FileCheck } from "lucide-react";
import { LandingNav, LandingFooter, PageHero } from "../_components";

const securityFeatures = [
  {
    icon: Lock,
    title: "Encryption",
    desc: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption.",
  },
  {
    icon: Eye,
    title: "Access Control",
    desc: "Role-based access control (RBAC) ensures users only access what they need.",
  },
  {
    icon: Server,
    title: "Infrastructure",
    desc: "Hosted on enterprise-grade cloud infrastructure with redundancy and failover.",
  },
  {
    icon: FileCheck,
    title: "Audit Logs",
    desc: "Comprehensive audit logging tracks all system access and changes.",
  },
];

const certifications = [
  { name: "SOC 2 Type II", status: "Certified" },
  { name: "GDPR", status: "Compliant" },
  { name: "HIPAA", status: "Ready" },
  { name: "PCI DSS", status: "Compliant" },
  { name: "ISO 27001", status: "In Progress" },
];

export default function SecurityPage() {
  return (
    <div>
      <LandingNav />

      <PageHero
        title="Security at Botaplace"
        subtitle="We take security seriously. Learn about the measures we take to protect your data and ensure the integrity of our platform."
      />

      {/* Security Features */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-4 text-[#151515] text-center">
            Security by Design
          </h2>
          <p className="text-[#5A5A5A] text-[18px] mb-16 max-w-2xl mx-auto text-center">
            Security is built into every layer of our platform, from infrastructure to application.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {securityFeatures.map((feature) => (
              <div
                key={feature.title}
                className="bg-white border border-[#E8E6DB] rounded-lg p-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#17DEBC] flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-[#151515]" />
                </div>
                <h3 className="font-bold text-[20px] mb-3 text-[#151515]">{feature.title}</h3>
                <p className="text-[#5A5A5A] text-[15px] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-white border-t border-[#E8E6DB]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-heading font-bold text-[36px] mb-6 text-[#151515]">
                Compliance & Certifications
              </h2>
              <p className="text-[#5A5A5A] text-[18px] leading-relaxed mb-8">
                We maintain rigorous compliance standards to meet the requirements of regulated industries and enterprise customers.
              </p>
              <div className="space-y-4">
                {certifications.map((cert) => (
                  <div
                    key={cert.name}
                    className="flex items-center justify-between p-4 bg-[#FFFDF5] border border-[#E8E6DB] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-[#17DEBC]" />
                      <span className="font-medium text-[#151515]">{cert.name}</span>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      cert.status === "Certified" || cert.status === "Compliant"
                        ? "bg-[#17DEBC]/20 text-[#0D7D6A]"
                        : "bg-[#E8E6DB] text-[#5A5A5A]"
                    }`}>
                      {cert.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#151515] rounded-lg p-12 text-center">
              <Shield className="w-24 h-24 text-[#17DEBC] mx-auto mb-6" />
              <h3 className="font-bold text-[24px] mb-4 text-[#FFFDF5]">
                Security First
              </h3>
              <p className="text-[#FFFDF5]/70 text-[16px]">
                Our security team continuously monitors and improves our security posture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="py-24 bg-[#FFFDF5]">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12">
          <h2 className="font-heading font-bold text-[36px] mb-12 text-[#151515] text-center">
            Our Security Practices
          </h2>
          <div className="space-y-8 text-[#5A5A5A]">
            <div>
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Data Protection</h3>
              <p className="leading-relaxed">
                All customer data is encrypted using industry-standard AES-256 encryption at rest and TLS 1.3 in transit. We implement strict data isolation between customers and maintain comprehensive backup and disaster recovery procedures.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Infrastructure Security</h3>
              <p className="leading-relaxed">
                Our infrastructure is hosted on enterprise-grade cloud platforms with SOC 2 certification. We employ network segmentation, firewalls, intrusion detection systems, and regular vulnerability scanning.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Application Security</h3>
              <p className="leading-relaxed">
                We follow secure development practices including code reviews, static analysis, and penetration testing. Our team stays current with security best practices and promptly addresses any vulnerabilities.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Incident Response</h3>
              <p className="leading-relaxed">
                We maintain a comprehensive incident response plan with defined procedures for detection, containment, eradication, and recovery. Customers are notified promptly of any security incidents that may affect their data.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-[20px] mb-3 text-[#151515]">Employee Security</h3>
              <p className="leading-relaxed">
                All employees undergo background checks and security training. Access to customer data is limited to authorized personnel on a need-to-know basis, with all access logged and audited.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 bg-[#17DEBC]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
          <h2 className="font-heading font-bold text-[32px] mb-4 text-[#151515]">
            Security Questions?
          </h2>
          <p className="text-[#151515]/80 text-[18px] mb-6">
            Contact our security team at <a href="mailto:security@botaplace.ai" className="underline">security@botaplace.ai</a>
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
