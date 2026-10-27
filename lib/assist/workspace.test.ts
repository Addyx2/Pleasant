import assert from "node:assert/strict";
import { test } from "node:test";

import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { isAllowed, normalisePolicy, TOOL_GROUPS } from "./policy";
import { ASSIST_TOOLS, findTool, toolsFor } from "./tools";
import { pendingActions, titleFrom, toTurns } from "./transcript";

test("every Assist tool belongs to a policy group", () => {
  for (const t of ASSIST_TOOLS) assert.ok(TOOL_GROUPS[t.name], `${t.name} has no policy group`);
});

test("normalisePolicy turns off changing when reading is off and drops junk", () => {
  assert.deepEqual(normalisePolicy(["payroll:read", "shifts:write", "bogus", "x:delete"]), [
    "payroll:read",
    "payroll:write",
    "shifts:write",
  ]);
});

test("isAllowed respects read and write switches", () => {
  const disabled = ["shifts:write", "payroll:read", "payroll:write"];
  assert.equal(isAllowed(disabled, "general", "read"), true);
  assert.equal(isAllowed(disabled, "shifts", "read"), true);
  assert.equal(isAllowed(disabled, "shifts", "write"), false);
  assert.equal(isAllowed(disabled, "payroll", "read"), false);
  assert.equal(isAllowed(disabled, "clients", "write"), true);
});

test("toolsFor applies the agency policy and read-only scope", () => {
  const names = (scope = {}) => toolsFor("ADMIN", scope).map((t) => t.name);
  assert.ok(names().includes("create_shift"));
  assert.ok(!names({ disabled: ["shifts:write"] }).includes("create_shift"));
  assert.ok(names({ disabled: ["shifts:write"] }).includes("list_shifts"));
  assert.ok(!names({ disabled: ["shifts:read", "shifts:write"] }).includes("list_shifts"));
  const readOnly = toolsFor("ADMIN", { readOnly: true });
  assert.ok(readOnly.length > 0);
  assert.ok(readOnly.every((t) => t.kind === "read"));
  assert.equal(findTool("ADMIN", "create_shift", { readOnly: true }), undefined);
});

test("toTurns rebuilds the chat with decisions and failures", () => {
  const messages: BetaMessageParam[] = [
    { role: "user", content: "Cancel shift A and B" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "Let me look." },
        { type: "tool_use", id: "r1", name: "list_shifts", input: {} },
      ],
    },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "r1", content: "[]" }] },
    {
      role: "assistant",
      content: [
        { type: "tool_use", id: "w1", name: "set_shift_status", input: {} },
        { type: "tool_use", id: "w2", name: "set_shift_status", input: {} },
        { type: "tool_use", id: "w3", name: "set_shift_status", input: {} },
      ],
    },
    {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "w1", content: '{"ok":true}' },
        { type: "tool_result", tool_use_id: "w2", content: "The user declined this action." },
        { type: "tool_result", tool_use_id: "w3", content: '{"ok":false,"error":"x"}' },
      ],
    },
    { role: "assistant", content: [{ type: "text", text: "Done." }] },
    { role: "user", content: "And C" },
    { role: "assistant", content: [{ type: "tool_use", id: "w4", name: "set_shift_status", input: {} }] },
  ];
  const turns = toTurns(messages, { w1: "Cancel A" }, (n) => n === "set_shift_status");
  assert.equal(turns.length, 4);
  const first = turns[1];
  assert.equal(first.role, "assistant");
  if (first.role !== "assistant") return;
  assert.equal(first.text, "Let me look.\n\nDone.");
  assert.equal(first.activity.length, 1);
  assert.deepEqual(
    first.actions.map((a) => [a.summary, a.decision, a.failed]),
    [
      ["Cancel A", "approve", false],
      ["set_shift_status", "decline", false],
      ["set_shift_status", "approve", true],
    ],
  );
  assert.deepEqual(pendingActions(turns).map((a) => a.id), ["w4"]);
});

test("titleFrom trims long first messages", () => {
  assert.equal(titleFrom("  hello\n there "), "hello there");
  assert.equal(titleFrom("x".repeat(80)).length, 58);
  assert.equal(titleFrom("   "), "New conversation");
});
