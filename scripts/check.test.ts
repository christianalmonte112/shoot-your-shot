import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toVariableValues, VARIABLE_KEYS } from "../lib/brief.ts";
import { coachStartIndex, parseCoachingNotes } from "../lib/coaching.ts";
import { buildSampleCall } from "../lib/sample-call.ts";
import { applyTranscript } from "../lib/transcript.ts";
import { EMPTY_BRIEF } from "../lib/types.ts";
import { readFileSync } from "node:fs";
import { FREE_CALL_LIMIT, MAX_CALL_SECONDS, freeCallsLabel, remainingFreeCalls, safeNextPath } from "../lib/limits.ts";
import { friendlyCallError, isIgnorableVapiError } from "../lib/vapi-error.ts";

describe("toVariableValues", () => {
  it("fills every prompt key from the brief and the persona", () => {
    const values = toVariableValues({
      ...EMPTY_BRIEF,
      productName: "Ledgerline",
      productSummary: "Closes the books from the bank feed.",
      targetCustomer: "Finance leads",
      features: "Bank sync and an exception inbox",
      pricing: "$400 a month",
      currentSolution: "A spreadsheet",
      objections: ["Too expensive", "We have an accountant"],
      persona: "skeptical",
    });

    for (const key of VARIABLE_KEYS) {
      assert.equal(typeof values[key], "string");
      assert.ok(values[key].length > 0, `${key} should not be empty`);
    }

    assert.equal(values.product_name, "Ledgerline");
    assert.equal(values.buyer_name, "Jordan Hale");
    assert.equal(values.buyer_role, "VP of Operations");
    assert.match(values.buyer_personality, /Skeptical/);
    assert.match(values.objections, /Too expensive/);
    assert.match(values.objections, /accountant/);
  });

  it("uses fallbacks so a thin brief still fills the prompt", () => {
    const values = toVariableValues(EMPTY_BRIEF);
    for (const key of VARIABLE_KEYS) {
      assert.ok(values[key].length > 0, key);
    }
    assert.equal(values.buyer_name, "Jordan Hale");
  });
});

describe("applyTranscript", () => {
  it("replaces a partial with the final line of the same speaker", () => {
    const partial = applyTranscript([], "user", "We replace the", false);
    const finalTurn = applyTranscript(partial, "user", "We replace the Friday export.", true);
    assert.equal(finalTurn.length, 1);
    assert.equal(finalTurn[0]?.text, "We replace the Friday export.");
    assert.equal(finalTurn[0]?.final, true);
  });

  it("keeps two finished turns from the same speaker", () => {
    const first = applyTranscript([], "assistant", "Why switch?", true);
    const second = applyTranscript(first, "assistant", "What does it cost?", true);
    assert.equal(second.length, 2);
  });
});

describe("parseCoachingNotes", () => {
  it("reads the three labels after the marker", () => {
    const notes = parseCoachingNotes([
      { text: "We already use a spreadsheet." },
      {
        text: [
          "switching to coach mode",
          "What worked: You led with the cost.",
          "What to tighten: You dodged the switching question.",
          "One line to try next: It replaces the Friday export, not your CRM.",
        ].join("\n"),
      },
    ]);

    assert.ok(notes);
    assert.equal(notes.worked, "You led with the cost.");
    assert.equal(notes.tighten, "You dodged the switching question.");
    assert.equal(notes.nextLine, "It replaces the Friday export, not your CRM.");
    assert.equal(coachStartIndex([
      { text: "Hello" },
      { text: "switching to coach mode" },
    ]), 1);
  });

  it("is case insensitive and accepts the longer label", () => {
    const notes = parseCoachingNotes([
      {
        text: "Switching to coach mode. What worked: You named the buyer. What to tighten: The price was a shrug. One line to try next call: It is $400 a month, instead of the bookkeeper.",
      },
    ]);
    assert.ok(notes);
    assert.match(notes.worked ?? "", /named the buyer/);
    assert.match(notes.tighten ?? "", /shrug/);
    assert.match(notes.nextLine ?? "", /\$400/);
  });

  it("returns null when the buyer never switched", () => {
    assert.equal(parseCoachingNotes([{ text: "Tell me more." }]), null);
  });

  it("keeps the raw coach section when the labels are missing", () => {
    const notes = parseCoachingNotes([
      { text: "switching to coach mode You talked too fast and never named a price." },
    ]);
    assert.ok(notes);
    assert.equal(notes.worked, null);
    assert.match(notes.raw, /talked too fast/);
  });

  it("parses the scripted sample call", () => {
    const sample = buildSampleCall({
      ...EMPTY_BRIEF,
      productName: "Harbor",
      objections: ["We already have Datadog."],
    });
    const notes = parseCoachingNotes(sample.turns);
    assert.ok(notes?.worked);
    assert.ok(notes?.tighten);
    assert.ok(notes?.nextLine);
    assert.match(notes.worked, /Harbor/);
    assert.match(sample.turns[2]?.text ?? "", /Datadog/);
  });
});

describe("free call limit", () => {
  it("counts down from three and stops at zero", () => {
    assert.equal(FREE_CALL_LIMIT, 3);
    assert.equal(MAX_CALL_SECONDS, 420);
    assert.equal(remainingFreeCalls(0), 3);
    assert.equal(remainingFreeCalls(2), 1);
    assert.equal(remainingFreeCalls(3), 0);
    assert.equal(remainingFreeCalls(9), 0);
    assert.equal(freeCallsLabel(1), "2 of 3 free calls left");
    assert.equal(freeCallsLabel(2), "1 of 3 free calls left");
  });

  it("matches the limit written in the SQL migration", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/20261028160000_init.sql", import.meta.url),
      "utf8",
    );
    assert.match(sql, /call_limit constant integer := 3/);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /free_call_limit/);
    assert.match(sql, /revoke all on function public\.start_practice_call\(\) from public, anon/);
  });

  it("only allows in-app paths as the post-login redirect", () => {
    assert.equal(safeNextPath("/call"), "/call");
    assert.equal(safeNextPath("https://evil.example"), "/brief");
    assert.equal(safeNextPath("//evil.example"), "/brief");
    assert.equal(safeNextPath("/login"), "/brief");
  });

  it("passes the seven-minute cap through assistant overrides", () => {
    const source = readFileSync(new URL("../lib/use-vapi-call.ts", import.meta.url), "utf8");
    assert.match(source, /maxDurationSeconds:\s*MAX_CALL_SECONDS/);
    assert.match(source, /\/api\/calls/);
  });
});

describe("friendlyCallError", () => {
  it("hides noise-cancellation failures", () => {
    const error = { type: "audio-processing-setup-error", stage: "audio-processing-setup" };
    assert.equal(isIgnorableVapiError(error), true);
    assert.equal(friendlyCallError(error), null);
  });

  it("turns a mic denial into something a builder can act on", () => {
    const message = friendlyCallError({ error: { message: "Permission denied" } });
    assert.match(message ?? "", /microphone is blocked/i);
  });
});
