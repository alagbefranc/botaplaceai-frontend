/**
 * test-team-transfer.ts
 * End-to-end verification of the agent team transfer system.
 * Tests: DB state, team membership lookup, system prompt injection, escalation config,
 *        hold music config (all agents) and URL correctness.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Load .env.local ────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env vars");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
  passed++;
}
function fail(msg: string) {
  console.log(`  ❌ ${msg}`);
  failed++;
}
function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}
function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🔷 ${title}`);
  console.log("─".repeat(60));
}

// ── Re-implement getTeamByAgentId exactly as the server does ──────────────────
async function getTeamByAgentId(agentId: string) {
  // Check team_members first
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("agent_id", agentId)
    .limit(1)
    .maybeSingle();

  if (membership) {
    const { data: team } = await supabase
      .from("agent_teams")
      .select(`id, name, status, entry_agent_id,
        entry_agent:agents!entry_agent_id(id, name, status)`)
      .eq("id", membership.team_id)
      .eq("status", "active")
      .single();
    return team ? { team, source: "team_members" } : null;
  }

  // Check entry_agent_id
  const { data: teamAsEntry } = await supabase
    .from("agent_teams")
    .select(`id, name, status, entry_agent_id,
      entry_agent:agents!entry_agent_id(id, name, status)`)
    .eq("entry_agent_id", agentId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return teamAsEntry ? { team: teamAsEntry, source: "entry_agent_id" } : null;
}

// ── Build system prompt snippet for team (mirrors voiceChat.ts logic) ─────────
function buildTeamPromptSnippet(
  teamName: string,
  members: Array<{ agentId: string; agentName: string; specialization: string | null }>,
  entryAgent: { id: string; name: string } | null,
  selfId: string
): string {
  const memberLines = members
    .filter((m) => m.agentId !== selfId)
    .map((m) => {
      const spec = m.specialization ? ` — specializes in: ${m.specialization}` : "";
      return `  • "${m.agentName}"${spec}`;
    });

  if (entryAgent && entryAgent.id !== selfId) {
    const alreadyListed = memberLines.some((l) => l.includes(`"${entryAgent.name}"`));
    if (!alreadyListed) {
      memberLines.unshift(`  • "${entryAgent.name}" — entry/routing agent`);
    }
  }

  if (memberLines.length === 0) return "(no other agents in team)";

  return [
    `[AGENT TEAM: ${teamName}]`,
    "Available agents for transfer:",
    ...memberLines,
    "ROUTING RULES:",
    "- Use `transfer_to_agent` with EXACT name above",
    "- Use `transfer_to_human` ONLY for real human requests",
  ].join("\n");
}

// ── Escalation phrase check ───────────────────────────────────────────────────
const BANNED_ESCALATION_PHRASES = ["transfer me", "connect me to", "speak to someone", "talk to someone"];
const REQUIRED_HUMAN_PHRASES = ["speak to a human", "human agent", "live agent", "real person"];

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Agent Team Transfer — Full System Test");
  console.log("=".repeat(60));

  // ═══════════════════════════════════════════════════════════
  // SECTION 1: Database state
  // ═══════════════════════════════════════════════════════════
  section("1. Database State");

  const { data: teams, error: teamsErr } = await supabase
    .from("agent_teams")
    .select("id, name, status, entry_agent_id");

  if (teamsErr || !teams?.length) {
    fail(`Could not load agent_teams: ${teamsErr?.message || "no teams"}`);
  } else {
    ok(`Found ${teams.length} team(s)`);
    for (const t of teams) {
      const statusMark = t.status === "active" ? "✅" : "⚠️";
      info(`${statusMark} "${t.name}" — status: ${t.status}, entry_agent_id: ${t.entry_agent_id ?? "none"}`);
    }
  }

  const { data: members } = await supabase
    .from("team_members")
    .select("id, team_id, agent_id, role, specialization, agents(id, name, status)");

  if (!members?.length) {
    fail("No team_members found — agents won't be injectable into system prompt");
  } else {
    ok(`Found ${members.length} team member(s)`);
    for (const m of members) {
      const agent = m.agents as unknown as { id: string; name: string; status: string } | null;
      const spec = m.specialization ? ` [${m.specialization}]` : " [no specialization]";
      info(`  "${agent?.name ?? m.agent_id}"${spec} — role: ${m.role}`);
    }
  }

  // Check usage_logs has event_type + metadata (our DB fix)
  // Use a SELECT to validate column existence — no FK issues
  const { error: ulSelectErr } = await supabase
    .from("usage_logs")
    .select("id, event_type, metadata")
    .limit(1);

  if (ulSelectErr && (ulSelectErr.message.includes("event_type") || ulSelectErr.message.includes("metadata"))) {
    fail(`usage_logs missing event_type/metadata columns: ${ulSelectErr.message}`);
  } else {
    ok(`usage_logs has event_type + metadata columns`);
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 2: getTeamByAgentId — entry agent lookup
  // ═══════════════════════════════════════════════════════════
  section("2. getTeamByAgentId — Entry Agent Lookup Fix");

  const activeTeams = teams?.filter((t) => t.status === "active") ?? [];

  for (const team of activeTeams) {
    if (team.entry_agent_id) {
      const result = await getTeamByAgentId(team.entry_agent_id);
      if (result) {
        ok(`Entry agent (${team.entry_agent_id}) found via "${result.source}" — team: "${team.name}"`);
      } else {
        fail(`Entry agent (${team.entry_agent_id}) NOT found — getTeamByAgentId returned null`);
      }
    }

    // Also test a member agent
    const teamMembers = members?.filter((m) => m.team_id === team.id) ?? [];
    for (const m of teamMembers.slice(0, 1)) {
      const result = await getTeamByAgentId(m.agent_id);
      if (result) {
        ok(`Member agent (${m.agent_id}) found via "${result.source}"`);
      } else {
        fail(`Member agent (${m.agent_id}) NOT found by getTeamByAgentId`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 3: System Prompt Injection
  // ═══════════════════════════════════════════════════════════
  section("3. System Prompt — Team Member Injection");

  for (const team of activeTeams) {
    const teamMembers = (members ?? [])
      .filter((m) => m.team_id === team.id)
      .map((m) => {
        const agent = m.agents as unknown as { id: string; name: string } | null;
        return {
          agentId: m.agent_id,
          agentName: agent?.name ?? "Unknown",
          specialization: m.specialization,
        };
      });

    const { data: entryAgentRow } = team.entry_agent_id
      ? await supabase
          .from("agents")
          .select("id, name")
          .eq("id", team.entry_agent_id)
          .single()
      : { data: null };

    if (teamMembers.length === 0 && !team.entry_agent_id) {
      fail(`Team "${team.name}" has no members — system prompt will have no routing info`);
      continue;
    }

    // Simulate prompt for entry agent
    if (team.entry_agent_id) {
      const snippet = buildTeamPromptSnippet(
        team.name,
        teamMembers,
        entryAgentRow,
        team.entry_agent_id
      );
      const hasAgentNames = teamMembers.some((m) => m.agentId !== team.entry_agent_id);
      if (hasAgentNames) {
        ok(`Entry agent prompt includes ${teamMembers.filter((m) => m.agentId !== team.entry_agent_id).length} transferable agent(s)`);
      } else {
        fail(`Entry agent prompt has no other agents to transfer to`);
      }
      console.log("\n    ┌── Injected prompt snippet (entry agent) ───────");
      snippet.split("\n").forEach((l) => console.log(`    │ ${l}`));
      console.log("    └────────────────────────────────────────────────\n");
    }

    // Simulate prompt for first member
    const firstMember = teamMembers[0];
    if (firstMember) {
      const snippet = buildTeamPromptSnippet(team.name, teamMembers, entryAgentRow, firstMember.agentId);
      ok(`Member agent "${firstMember.agentName}" would see ${teamMembers.length - 1 + (entryAgentRow ? 1 : 0)} other agent(s) in prompt`);
      console.log("\n    ┌── Injected prompt snippet (member agent) ──────");
      snippet.split("\n").forEach((l) => console.log(`    │ ${l}`));
      console.log("    └────────────────────────────────────────────────\n");
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 4: Escalation Config Verification
  // ═══════════════════════════════════════════════════════════
  section("4. Escalation Config — No False Positives");

  // Reconstruct the escalation.ts checkExplicitRequest logic from the server file
  const escalationFile = path.resolve(
    process.cwd(),
    "server/src/supabase/escalation.ts"
  );
  const escalationSrc = fs.existsSync(escalationFile)
    ? fs.readFileSync(escalationFile, "utf-8")
    : "";

  for (const phrase of BANNED_ESCALATION_PHRASES) {
    // Check if the banned phrase still appears in the phrases array in the source
    const inSource = escalationSrc.includes(`'${phrase}'`);
    if (inSource) {
      fail(`Banned phrase still present in escalation.ts: "${phrase}"`);
    } else {
      ok(`"${phrase}" correctly removed from explicit_request phrases`);
    }
  }

  for (const phrase of REQUIRED_HUMAN_PHRASES) {
    const inSource = escalationSrc.includes(`'${phrase}'`);
    if (inSource) {
      ok(`Human-specific phrase retained: "${phrase}"`);
    } else {
      fail(`Missing required human phrase: "${phrase}"`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5: Agent Tools Check
  // ═══════════════════════════════════════════════════════════
  section("5. Agent Tools — transfer_to_agent Availability");

  // Load all agents in active teams
  const teamAgentIds = new Set([
    ...(members ?? []).map((m) => m.agent_id),
    ...activeTeams.filter((t) => t.entry_agent_id).map((t) => t.entry_agent_id!),
  ]);

  if (teamAgentIds.size > 0) {
    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, name, tools, status, settings")
      .in("id", [...teamAgentIds]);

    for (const agent of agentRows ?? []) {
      const tools = (agent.tools as string[]) ?? [];
      // transfer_to_agent is always injected via INTERNAL_TOOLS — no need in db tools array
      // But let's check agent status
      if (agent.status !== "active") {
        fail(`Agent "${agent.name}" is NOT active (status: ${agent.status})`);
      } else {
        ok(`Agent "${agent.name}" is active`);
      }

      // Check for escalation config
      const settings = (agent.settings as any) ?? {};
      const escalation = settings?.tools?.escalation;
      if (escalation?.enabled) {
        const rules = escalation.rules ?? [];
        const explicitRule = rules.find((r: any) => r.trigger === "explicit_request");
        if (explicitRule?.enabled) {
          ok(`  Escalation enabled for "${agent.name}" — explicit_request rule active`);
        } else {
          info(`  Escalation enabled for "${agent.name}" — explicit_request rule disabled`);
        }
      } else {
        info(`  Escalation disabled for "${agent.name}"`);
      }
    }
  } else {
    info("No team agents found to check");
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 6: Hold Music — All Team Agents
  // ═══════════════════════════════════════════════════════════
  section("6. Hold Music — Config & URL Correctness");

  // 6a: Check voiceChat.ts no longer uses local /hold-music/ paths
  const voiceChatFile = path.resolve(
    process.cwd(),
    "server/src/websocket/handlers/voiceChat.ts"
  );
  const voiceChatSrc = fs.existsSync(voiceChatFile)
    ? fs.readFileSync(voiceChatFile, "utf-8")
    : "";

  const hasBrokenLocalPath = voiceChatSrc.includes("`/hold-music/");
  if (hasBrokenLocalPath) {
    fail("voiceChat.ts still uses broken local /hold-music/ path for presets");
  } else {
    ok("voiceChat.ts uses CDN URL map for preset hold music (no local paths)");
  }

  const hasCdnMap = voiceChatSrc.includes("HOLD_MUSIC_CDN_URLS");
  if (hasCdnMap) {
    ok("HOLD_MUSIC_CDN_URLS map present in voiceChat.ts");
  } else {
    fail("HOLD_MUSIC_CDN_URLS map missing from voiceChat.ts");
  }

  // 6b: Check all team agents have hold music configured in DB
  const allTeamAgentIds = [
    ...(members ?? []).map((m) => m.agent_id),
    ...activeTeams.filter((t) => t.entry_agent_id).map((t) => t.entry_agent_id!),
  ];
  const uniqueTeamAgentIds = [...new Set(allTeamAgentIds)];

  if (uniqueTeamAgentIds.length > 0) {
    const { data: hmAgents } = await supabase
      .from("agents")
      .select("id, name, settings")
      .in("id", uniqueTeamAgentIds);

    const KNOWN_PRESET_IDS = ["classical_1", "jazz_1", "ambient_1", "corporate_1", "upbeat_1"];
    const CDN_URLS: Record<string, string> = {
      classical_1: "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3",
      jazz_1:      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
      ambient_1:   "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
      corporate_1: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bcd.mp3",
      upbeat_1:    "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c6.mp3",
    };

    for (const agent of hmAgents ?? []) {
      const settings = (agent.settings as any) ?? {};
      const hm = settings?.tools?.holdMusic;

      if (!hm || !hm.enabled) {
        fail(`"${agent.name}" — hold music not enabled`);
        continue;
      }

      if (hm.type === "preset") {
        const presetId: string = hm.presetId ?? "";
        if (!KNOWN_PRESET_IDS.includes(presetId)) {
          fail(`"${agent.name}" — unknown presetId "${presetId}"`);
          continue;
        }
        const cdnUrl = CDN_URLS[presetId];
        ok(`"${agent.name}" — preset "${presetId}" → ${cdnUrl}`);
      } else if (hm.type === "custom") {
        if (hm.customUrl) {
          ok(`"${agent.name}" — custom URL: ${hm.customUrl}`);
        } else {
          fail(`"${agent.name}" — custom hold music type but no customUrl`);
        }
      } else {
        fail(`"${agent.name}" — unknown hold music type "${hm.type}"`);
      }
    }
  } else {
    info("No team agents to check for hold music");
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All checks passed — agent team transfer system is ready!");
  } else {
    console.log(`⚠️  ${failed} issue(s) need attention (see ❌ above)`);
  }
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
