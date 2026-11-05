import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { startPracticeCall, visibleCalls, type Ledger } from "../lib/call-accounting.ts";
import { evaluateOutbound } from "../lib/outbound-policy.ts";
import { coachSeller, quotesAreSellerWords, type SpokenTurn } from "../lib/seller-coaching.ts";
import { decideWebhook, parseEndOfCallReport, secretsMatch } from "../lib/vapi-webhook.ts";
import { publicVapiError } from "../lib/vapi-error.ts";

const emptyLedger = (): Ledger => ({ usage: {}, calls: [] });

describe("outbound dialing gate", () => {
  it("refuses to dial when the switch is off or the allowlist is empty", () => {
    assert.equal(
      evaluateOutbound({ enabled: false, allowlist: ["+15551234567"], requestedPhone: "+15551234567" }).ok,
      false,
    );
    const empty = evaluateOutbound({ enabled: true, allowlist: [], requestedPhone: "+15551234567" });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, "disabled");
  });

  it("refuses numbers that are not on the allowlist", () => {
    const decision = evaluateOutbound({
      enabled: true,
      allowlist: ["+1 (555) 123-4567"],
      requestedPhone: "+19998887777",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.code, "not_allowlisted");
  });

  it("dials only the normalized allowlisted number", () => {
    const decision = evaluateOutbound({
      enabled: true,
      allowlist: ["+1 (555) 123-4567"],
      requestedPhone: "+15551234567",
    });
    assert.deepEqual(decision, { ok: true, number: "+15551234567" });
  });

  it("checks the gate before a free call is counted", () => {
    const route = readFileSync(new URL("../app/api/call-me/route.ts", import.meta.url), "utf8");
    assert.ok(route.indexOf("evaluateOutbound") < route.indexOf("start_practice_call"));
    assert.doesNotMatch(route, /NEXT_PUBLIC_VAPI_PRIVATE/);
  });
});

describe("call accounting", () => {
  it("does not count a replayed idempotency key or an open call twice", () => {
    const first = startPracticeCall(emptyLedger(), {
      userId: "seller-a",
      channel: "web",
      idempotencyKey: "same-key-1",
      now: 0,
    });
    const replay = startPracticeCall(first.ledger, {
      userId: "seller-a",
      channel: "web",
      idempotencyKey: "same-key-1",
      now: 1_000,
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.used, 1);
    assert.equal(replay.callId, first.callId);

    const doubleClick = startPracticeCall(first.ledger, {
      userId: "seller-a",
      channel: "phone",
      idempotencyKey: "other-key-2",
      now: 1_000,
    });
    assert.equal(doubleClick.replayed, true);
    assert.equal(doubleClick.used, 1);
  });

  it("stops at three calls and keeps another seller's count separate", () => {
    let ledger = emptyLedger();
    for (let index = 0; index < 3; index += 1) {
      const next = startPracticeCall(ledger, {
        userId: "seller-a",
        channel: "web",
        idempotencyKey: `key-${index}`,
        now: index * 60_000,
      });
      assert.equal(next.status, 200);
      ledger = next.ledger;
    }
    const fourth = startPracticeCall(ledger, {
      userId: "seller-a",
      channel: "phone",
      idempotencyKey: "key-4",
      now: 999_999,
    });
    assert.equal(fourth.status, 403);
    assert.equal(fourth.used, 3);

    const other = startPracticeCall(ledger, {
      userId: "seller-b",
      channel: "web",
      idempotencyKey: "b-1",
      now: 999_999,
    });
    assert.equal(other.status, 200);
    assert.equal(visibleCalls(other.ledger, "seller-b").length, 1);
    assert.equal(visibleCalls(other.ledger, "seller-b").some((call) => call.userId === "seller-a"), false);
    assert.equal(visibleCalls(other.ledger, "seller-a").every((call) => call.userId === "seller-a"), true);
  });

  it("matches the locked SQL counter", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/20261105160000_buyer_settings_and_call_safety.sql", import.meta.url),
      "utf8",
    );
    assert.match(sql, /for update/);
    assert.match(sql, /idempotency_key/);
    assert.match(sql, /call_limit constant integer := 3/);
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /apply_vapi_report/);
    assert.match(sql, /revoke all on function public\.apply_vapi_report[\s\S]*from public, anon, authenticated/);
  });
});

describe("seller coaching", () => {
  const turns: SpokenTurn[] = [
    { role: "assistant", text: "What worked: I asked a sharp question about risk." },
    { role: "user", text: "Harbor replaces the Friday spreadsheet export." },
  ];

  it("quotes the seller and does not treat the buyer as the person being coached", () => {
    const notes = coachSeller(turns);
    assert.equal(quotesAreSellerWords(notes, turns), true);
    assert.match(notes.worked, /Harbor replaces the Friday spreadsheet export/);
    assert.doesNotMatch(`${notes.worked} ${notes.tighten} ${notes.nextLine}`, /sharp question/);
    assert.doesNotMatch(`${notes.worked} ${notes.tighten} ${notes.nextLine}`, /What worked: I asked/);
  });

  it("does not invent evidence when the seller never spoke", () => {
    const buyerOnly: SpokenTurn[] = [
      { role: "assistant", text: "Jordan Hale. Why should we look at Harbor?" },
    ];
    const notes = coachSeller(buyerOnly);
    assert.deepEqual(notes.evidence, []);
    assert.equal(quotesAreSellerWords(notes, buyerOnly), true);
    assert.doesNotMatch(`${notes.worked} ${notes.tighten} ${notes.nextLine}`, /Jordan Hale/);
  });
});

describe("vapi webhook", () => {
  const report = {
    message: {
      type: "end-of-call-report",
      call: { id: "vapi-1" },
      artifact: {
        messages: [
          { role: "bot", message: "Why switch?" },
          { role: "user", message: "It replaces the export." },
        ],
      },
    },
  };

  it("keeps both sides of the transcript and ignores other events", () => {
    const parsed = parseEndOfCallReport(report);
    assert.ok(parsed);
    assert.equal(parsed.turns.length, 2);
    assert.equal(parsed.turns[1]?.role, "user");
    assert.equal(parseEndOfCallReport({ message: { type: "transcript" } }), null);
    assert.equal(secretsMatch("same-secret", "same-secret"), true);
    assert.equal(secretsMatch("nope", "same-secret"), false);
  });

  it("rejects a bad secret, ignores duplicates, and retries an unknown call", () => {
    const parsed = parseEndOfCallReport(report);
    assert.equal(
      decideWebhook({
        secretConfigured: false,
        secretOk: false,
        parsed,
        alreadyApplied: false,
        callFound: true,
      }).action,
      "unconfigured",
    );
    assert.equal(
      decideWebhook({
        secretConfigured: true,
        secretOk: false,
        parsed,
        alreadyApplied: false,
        callFound: true,
      }).http,
      401,
    );
    assert.equal(
      decideWebhook({
        secretConfigured: true,
        secretOk: true,
        parsed,
        alreadyApplied: true,
        callFound: true,
      }).action,
      "duplicate",
    );
    assert.equal(
      decideWebhook({
        secretConfigured: true,
        secretOk: true,
        parsed,
        alreadyApplied: false,
        callFound: false,
      }).action,
      "retry",
    );
  });

  it("hides bearer tokens in Vapi errors", () => {
    assert.equal(publicVapiError({ message: "Bearer super-secret-key failed" }), "Vapi could not place the call.");
    assert.match(publicVapiError({ message: "The number is not verified." }), /not verified/);
  });
});
