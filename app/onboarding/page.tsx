"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Typography, App as AntdApp } from "antd";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const GOALS = [
  { key: "build_ai_agent", label: "Build an AI Agent" },
  { key: "handle_calls", label: "Handle customer calls" },
  { key: "automate_support", label: "Automate support" },
  { key: "integrate_channels", label: "Integrate messaging channels" },
  { key: "just_exploring", label: "I'm just exploring" },
] as const;

interface OnboardingFormValues {
  companyName: string;
  website: string;
}

export default function OnboardingPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [form] = Form.useForm<OnboardingFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap account on load (for OAuth users arriving via callback)
  useEffect(() => {
    if (bootstrapped) return;
    const run = async () => {
      try {
        await fetch("/api/auth/bootstrap", { method: "POST" });
      } catch {}
      setBootstrapped(true);
    };
    void run();
  }, [bootstrapped]);

  // Check if user is even logged in
  useEffect(() => {
    if (!supabase) return;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/auth/signup");
      }
    };
    void check();
  }, [supabase, router]);

  const handleSubmit = useCallback(
    async (values: OnboardingFormValues) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onboarding: {
              companyName: values.companyName,
              website: values.website || null,
              goal: selectedGoal,
            },
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || "Failed to save onboarding data");
        }

        // Set onboarding cookie
        document.cookie = "bo-onboarding-done=1; path=/; max-age=31536000; samesite=lax";

        message.success("Welcome to Botaplace! Your workspace is ready.");
        router.push("/");
      } catch (err) {
        message.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedGoal, message, router],
  );

  return (
    <div className="auth-page">
      <div className="auth-page-left">
        <div className="auth-page-left-inner">
          <div className="auth-logo-row">
            <img src="/bota-logo.png" alt="Botaplace AI" className="auth-logo" />
            <Typography.Text strong style={{ fontSize: 16 }}>Botaplace</Typography.Text>
          </div>

          <div className="auth-form-section">
            <div className="auth-heading-row">
              <div>
                <Typography.Title level={2} style={{ marginBottom: 4 }}>
                  Some details about your company
                </Typography.Title>
                <Typography.Text type="secondary">
                  Fill in your company information to continue (you can edit it later).
                </Typography.Text>
              </div>
              <Typography.Text type="secondary" className="auth-step-label">
                STEP 2 / 2
              </Typography.Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={handleSubmit}
              size="large"
            >
              <Form.Item
                name="companyName"
                label="What is the name of your company?"
                rules={[{ required: true, message: "Company name is required" }]}
              >
                <Input placeholder="Company name" autoComplete="organization" />
              </Form.Item>

              <Form.Item
                name="website"
                label="What is your website domain?"
              >
                <Input placeholder="www.acme.com" autoComplete="url" />
              </Form.Item>

              <div style={{ marginBottom: 24 }}>
                <Typography.Text style={{ display: "block", marginBottom: 10, fontWeight: 500 }}>
                  Which is your main goal with Botaplace?
                </Typography.Text>
                <div className="onboarding-goal-grid">
                  {GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      className={`onboarding-goal-pill${selectedGoal === g.key ? " onboarding-goal-pill-active" : ""}`}
                      onClick={() => setSelectedGoal(g.key === selectedGoal ? null : g.key)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                block
                type="primary"
                htmlType="submit"
                loading={submitting}
                className="auth-submit-btn"
                disabled={!form.getFieldValue("companyName") && !submitting}
              >
                Continue
              </Button>
            </Form>
          </div>
        </div>
      </div>

      <div className="auth-page-right">
        <div className="auth-right-inner">
          <Typography.Title level={3} style={{ color: "#0F172A", textAlign: "center", marginBottom: 4 }}>
            You&apos;re almost there
          </Typography.Title>
          <Typography.Text
            style={{ display: "block", textAlign: "center", color: "#64748B", marginBottom: 32 }}
          >
            Just a few details so we can personalize
            <br />
            your Botaplace workspace
          </Typography.Text>

          <div className="onboarding-features">
            {[
              {
                icon: "/assets/icons/bota/mint/Verified_3.svg",
                title: "AI Agents",
                desc: "Build and deploy voice & chat agents in minutes",
              },
              {
                icon: "/assets/icons/bota/mint/Call_3.svg",
                title: "Omnichannel",
                desc: "Connect WhatsApp, voice, SMS, email, Slack & Teams",
              },
              {
                icon: "/assets/icons/bota/mint/Dashboard_3.svg",
                title: "Analytics",
                desc: "Real-time insights into every conversation",
              },
              {
                icon: "/assets/icons/bota/mint/Send-Point_3.svg",
                title: "Workflows",
                desc: "Automate complex tasks with agentic workflows",
              },
            ].map((f) => (
              <div key={f.title} className="onboarding-feature-card">
                <img src={f.icon} alt="" width={24} height={24} className="onboarding-feature-icon" />
                <div>
                  <Typography.Text strong style={{ fontSize: 13, display: "block" }}>
                    {f.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {f.desc}
                  </Typography.Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
