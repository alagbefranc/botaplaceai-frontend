"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Form, Input, Typography, App as AntdApp } from "antd";
import { GoogleOutlined, WindowsFilled } from "@ant-design/icons";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Integration logos from CDN (SimpleIcons) - organized by rows for marquee
const logoRows = [
  // Row 1 - moves right
  [
    { name: "Slack", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/slack.svg" },
    { name: "WhatsApp", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" },
    { name: "Telegram", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/telegram.svg" },
    { name: "Messenger", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/messenger.svg" },
    { name: "Gmail", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/gmail.svg" },
    { name: "Microsoft", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/microsoft.svg" },
    { name: "Slack", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/slack.svg" },
    { name: "WhatsApp", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" },
  ],
  // Row 2 - moves left
  [
    { name: "Twilio", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twilio.svg" },
    { name: "Salesforce", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/salesforce.svg" },
    { name: "HubSpot", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/hubspot.svg" },
    { name: "Zendesk", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/zendesk.svg" },
    { name: "Intercom", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/intercom.svg" },
    { name: "Stripe", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/stripe.svg" },
    { name: "Twilio", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twilio.svg" },
    { name: "Salesforce", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/salesforce.svg" },
  ],
  // Row 3 - moves right
  [
    { name: "Shopify", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/shopify.svg" },
    { name: "Google", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg" },
    { name: "OpenAI", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg" },
    { name: "Discord", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg" },
    { name: "Zapier", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/zapier.svg" },
    { name: "Notion", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/notion.svg" },
    { name: "Shopify", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/shopify.svg" },
    { name: "Google", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg" },
  ],
  // Row 4 - moves left
  [
    { name: "Airtable", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/airtable.svg" },
    { name: "Jira", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/jira.svg" },
    { name: "GitHub", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/github.svg" },
    { name: "Linear", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linear.svg" },
    { name: "Figma", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/figma.svg" },
    { name: "Trello", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/trello.svg" },
    { name: "Airtable", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/airtable.svg" },
    { name: "Jira", url: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/jira.svg" },
  ],
];

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const redirect = searchParams.get("redirect") || "/";

  const handleEmailLogin = useCallback(
    async (values: LoginFormValues) => {
      if (!supabase) {
        message.error("Authentication is not configured.");
        return;
      }

      setSubmitting(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) {
          message.error(error.message);
          return;
        }

        try {
          const res = await fetch("/api/auth/bootstrap", { method: "POST" });
          const json = await res.json();
          if (json.org && !json.org.onboarding_completed) {
            router.push("/onboarding");
            return;
          }
        } catch {}

        router.push(redirect);
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, message, router, redirect],
  );

  const handleGoogleLogin = useCallback(async () => {
    if (!supabase) {
      message.error("Authentication is not configured.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
            : undefined,
      },
    });

    if (error) {
      setSubmitting(false);
      message.error(error.message);
    }
  }, [supabase, message, redirect]);

  return (
    <div className="auth-page-v2">
      {/* Dark Left Panel */}
      <div className="auth-left-dark">
        <div className="auth-left-content">
          <div className="auth-brand">
            <img src="/bota-logo.png" alt="Botaplace" className="auth-brand-logo" />
            <span className="auth-brand-name">Botaplace</span>
          </div>

          <h1 className="auth-tagline">
            Voice, SMS and<br />
            WhatsApp, all in one<br />
            place
          </h1>

          {/* Integration Logos with Marquee Animation */}
          <div className="auth-marquee-container">
            {logoRows.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className={`auth-marquee-row ${rowIndex % 2 === 0 ? 'auth-marquee-right' : 'auth-marquee-left'}`}
              >
                <div className="auth-marquee-track">
                  {/* Triple the logos for seamless infinite loop */}
                  {[...row, ...row, ...row].map((logo, i) => (
                    <div key={`${logo.name}-${i}`} className="auth-icon-box" title={logo.name}>
                      <img src={logo.url} alt={logo.name} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* White Right Panel - Form */}
      <div className="auth-right-form">
        <div className="auth-right-header">
          <Typography.Text type="secondary">Don&apos;t have an account?</Typography.Text>{" "}
          <Link href="/auth/signup" className="auth-link-teal">Sign up.</Link>
        </div>

        <div className="auth-form-container">
          <div className="auth-form-header">
            <Typography.Title level={2} style={{ marginBottom: 4, fontWeight: 600 }}>
              Welcome back
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              Sign in to your Botaplace account to continue.
            </Typography.Text>
          </div>

          {/* OAuth Buttons */}
          <div className="auth-oauth-row">
            <Button
              size="large"
              icon={<GoogleOutlined />}
              loading={submitting}
              onClick={handleGoogleLogin}
              className="auth-oauth-btn"
            >
              Sign in with Google
            </Button>
            <Button
              size="large"
              icon={<WindowsFilled />}
              className="auth-oauth-btn"
              disabled
            >
              Sign in with Microsoft
            </Button>
          </div>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleEmailLogin}
            size="large"
            className="auth-form-v2"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "" },
                { type: "email", message: "Enter a valid email" },
              ]}
              style={{ marginBottom: 16 }}
            >
              <Input placeholder="Email Address" autoComplete="email" className="auth-input-v2" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "" }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password placeholder="Password" autoComplete="current-password" className="auth-input-v2" />
            </Form.Item>

            <Button
              block
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="auth-submit-btn-v2"
            >
              Log In
            </Button>
          </Form>

          <div className="auth-terms-text">
            By signing in you agree to our{" "}
            <Link href="/landing/terms" className="auth-link-underline">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/landing/privacy" className="auth-link-underline">Privacy Policy</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
