import Telnyx from "telnyx";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ProvisionVoiceLineInput {
  admin: SupabaseClient;
  orgId: string;
  agentId?: string | null;
  countryCode?: string;
  city?: string;
  displayLabel?: string | null;
}

interface ProvisionVoiceLineResult {
  orderId: string | null;
  phoneNumber: {
    id: string;
    telnyx_number: string;
    display_label: string | null;
    status: "active" | "provisioning";
    region: string | null;
    created_at: string;
  };
}

function normalizeCountryCode(input?: string) {
  if (!input) {
    return "US";
  }

  return input.trim().toUpperCase().slice(0, 2) || "US";
}

function generateFallbackPhoneNumber() {
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `+1 (204) 555-${suffix}`;
}

export async function provisionVoiceLine(input: ProvisionVoiceLineInput): Promise<ProvisionVoiceLineResult> {
  const countryCode = normalizeCountryCode(input.countryCode);
  const city = input.city?.trim() ? input.city.trim() : undefined;
  const displayLabel = input.displayLabel?.trim() ? input.displayLabel.trim() : null;

  const telnyxApiKey = process.env.TELNYX_API_KEY;

  let orderId: string | null = null;
  let selectedNumber = generateFallbackPhoneNumber();
  const selectedStatus: "active" | "provisioning" = telnyxApiKey ? "provisioning" : "active";

  if (telnyxApiKey) {
    const telnyx = new Telnyx({ apiKey: telnyxApiKey });

    const availablePhoneNumbers = await telnyx.availablePhoneNumbers.list({
      filter: {
        country_code: countryCode,
        features: ["voice"],
        limit: 1,
        ...(city ? { locality: city } : {}),
      },
    });

    const firstAvailable = availablePhoneNumbers.data?.[0] as
      | { phone_number?: string; phoneNumber?: string }
      | undefined;

    const phoneNumber = firstAvailable?.phone_number ?? firstAvailable?.phoneNumber;

    if (!phoneNumber) {
      throw new Error("No available numbers were found for the selected region.");
    }

    selectedNumber = phoneNumber;

    const order = await telnyx.numberOrders.create({
      phone_numbers: [{ phone_number: phoneNumber }],
    });

    orderId =
      (order as { data?: { id?: string } }).data?.id ?? (order as { id?: string }).id ?? null;
  }

  const { data: createdPhoneNumber, error: createError } = await input.admin
    .from("phone_numbers")
    .insert({
      org_id: input.orgId,
      agent_id: input.agentId ?? null,
      telnyx_number: selectedNumber,
      display_label: displayLabel,
      region: city ?? countryCode,
      status: selectedStatus,
    })
    .select("id, telnyx_number, display_label, status, region, created_at")
    .single();

  if (createError || !createdPhoneNumber) {
    throw new Error(createError?.message ?? "Failed to persist voice line.");
  }

  return {
    orderId,
    phoneNumber: createdPhoneNumber,
  };
}
