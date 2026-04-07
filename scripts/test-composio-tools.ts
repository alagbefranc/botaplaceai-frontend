/**
 * Test script: verifies GOOGLECALENDAR_CREATE_EVENT and GMAIL_SEND_EMAIL work
 * Run: cd server && npx tsx ../scripts/test-composio-tools.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY ?? 'ak_jXsFd5bUdPIIgtElu33f';
const ORG_ID = '59764ad1-b420-4e92-a654-d6284ed5b396';

// Known active account IDs (from v1 API)
const GMAIL_ACCOUNT_ID = 'b809a60d-37a5-4a88-b345-11ddee2d59ca';
const GCAL_ACCOUNT_ID  = '9eb05763-d6ab-43f3-b931-5897cb8d5373';

async function executeAction(actionName: string, input: Record<string, unknown>, connectedAccountId: string) {
  const { OpenAIToolSet } = await import('composio-core');
  const toolset = new OpenAIToolSet({ apiKey: COMPOSIO_API_KEY });
  return await (toolset as any).executeAction(actionName, input, connectedAccountId);
}

async function main() {
  console.log('Connected accounts:');
  console.log(`  📅 Google Calendar: ${GCAL_ACCOUNT_ID}`);
  console.log(`  📧 Gmail:           ${GMAIL_ACCOUNT_ID}\n`);

  // ── Test 1: GOOGLECALENDAR_CREATE_EVENT ──────────────────────────────────
  console.log('── Test 1: GOOGLECALENDAR_CREATE_EVENT ──');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '');

  const calInput = {
    calendarId: 'primary',
    title: 'TEST - Appointment Booking Test',
    start_datetime: toISO(tomorrow),
    end_datetime: toISO(tomorrowEnd),
    description: 'Automated test from test-composio-tools.ts',
    attendees: [{ email: 'frankalasho@gmail.com' }],
  };

  console.log('Input:', JSON.stringify(calInput, null, 2));
  try {
    const calResult = await executeAction('GOOGLECALENDAR_CREATE_EVENT', calInput, GCAL_ACCOUNT_ID);
    if (calResult?.successful === false || calResult?.error) {
      console.log(`❌ FAILED: ${calResult.error}`);
    } else {
      console.log('✅ Calendar event created!');
      const data = calResult?.data ?? calResult;
      const summary = typeof data === 'object' ? JSON.stringify(data).slice(0, 400) : String(data);
      console.log('Result:', summary);
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e?.message ?? e}`);
  }

  console.log('');

  // ── Test 2: GMAIL_SEND_EMAIL ─────────────────────────────────────────────
  console.log('── Test 2: GMAIL_SEND_EMAIL ──');
  const gmailInput = {
    recipient_email: 'frankalasho@gmail.com',
    subject: 'TEST - Appointment Confirmation',
    body: 'This is an automated test email. Your appointment has been booked for tomorrow at 10 AM.',
  };

  console.log('Input:', JSON.stringify(gmailInput, null, 2));
  try {
    const gmailResult = await executeAction('GMAIL_SEND_EMAIL', gmailInput, GMAIL_ACCOUNT_ID);
    if (gmailResult?.successful === false || gmailResult?.error) {
      console.log(`❌ FAILED: ${gmailResult.error}`);
    } else {
      console.log('✅ Email sent!');
      const data = gmailResult?.data ?? gmailResult;
      console.log('Result:', JSON.stringify(data).slice(0, 400));
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e?.message ?? e}`);
  }
}

main().catch(console.error);
