import { describe, expect, it } from "vitest";
import { baseParse, compile, type ElementNode } from "@vue/compiler-dom";
import { parse } from "@vue/compiler-sfc";
import * as Vue from "vue";
import { zh } from "@/i18n/messages/zh";
import home from "../home/device-row.vue?raw";
import feed from "../home/home-running-tasks.vue?raw";
import card from "./device-card-pc.vue?raw";
import history from "./task-center.vue?raw";
import inventory from "../me/device-inventory-row.vue?raw";
import deactivate from "../me/device-deactivate-sheet.vue?raw";

function block(raw: string, match: (node: ElementNode) => boolean): string {
  const visit = (node: any): ElementNode[] => [node, ...(node.children ?? []).flatMap(visit)];
  return visit(baseParse(parse(raw).descriptor.template!.content)).find(node => node.type === 1 && match(node))!.loc.source;
}
const hasClass = (name: string) => (node: ElementNode) => node.props.some(p => p.type === 6 && p.name === "class" && p.value?.content.split(" ").includes(name));
const when = (condition: string) => (node: ElementNode) => node.props.some(p => p.type === 7 && p.name === "if" && p.exp?.type === 4 && p.exp.content === condition);
const nameText = (node: ElementNode) => node.tag === "text" && node.children.some(p => p.type === 5 && p.content.type === 4 && p.content.content === "task.type");
const surfaces = [
  ["Home device", block(home, hasClass("hf-device-task"))],
  ["Home activity", parse(feed).descriptor.template!.content],
  ["Earn collapsed", block(card, hasClass("nx-device-current-task"))],
  ["Earn expanded / device detail", block(card, when("!stage && task && !reconnecting"))],
  ["P62 Earn stage", block(card, node => node.tag === "template" && when("stage")(node))],
  ["phone reconnect", block(card, when("reconnecting && device.kind === 'phone'"))],
  ["device inventory", block(inventory, hasClass("device-inventory-row__task"))],
  ["deactivation preview", block(deactivate, nameText)],
  ["device completed preview", block(card, nameText)],
  ["account completed preview", block(history, hasClass("earn-history-description"))],
] as const;

function render(template: string, ctx: Record<string, unknown>) {
  const code = compile(template, { mode: "function", prefixIdentifiers: true, isCustomElement: () => true,
    directiveTransforms: { "viz-inview": () => ({ props: [] }) } }).code;
  return new Function("Vue", code)(Vue)(ctx);
}
function text(node: any): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return node && node.type !== Vue.Comment ? text(node.children) : "";
}

describe("ordinary task names use the configured name only", () => {
  it.each(surfaces)("%s keeps distinct frozen names and hides execution metadata", (_name, template) => {
    for (const name of ["PC 短文本嵌入", "PC 长文索引"]) {
      const task = { id: "CV2-INTERNAL-TASK", type: name, model: "TEST_BGE_M3_V1", client: "INTERNAL_EXECUTOR",
        location: "INTERNAL_LOCATION", category: "EM", status: "RUNNING", reward: 0.00001, protocolVersion: 2 };
      const tree = render(template, { task, device: { currentTask: task, kind: "phone" },
        rows: [{ name, status: "RUNNING", reward: task.reward, pct: 35 }], visibility: { hidden: false, mask: String },
        t: zh, computeCopy: { statuses: { RUNNING: "RUNNING" } }, expanded: false, reconnecting: _name === "phone reconnect",
        active: true, taskRunning: true, stage: _name === "P62 Earn stage", stageJob: "task", stageOffline: false, jobRunning: true,
        sectionLabelStyle: {}, progressPct: 35, progressLabel: "35%",
        progressBarStyle: {}, awaitingExecutionResultConfirmation: false, reconnectHoldText: "hold",
        formatUsd: () => "$0.000010", formatAmount: String });
      const output = text(tree);
      expect(output).toContain(name);
      for (const hidden of [task.model, task.client, task.location, task.id]) expect(output).not.toContain(hidden);
      if (_name === "P62 Earn stage") expect(tree.children.find((node: any) => node.props?.label)?.props.label).toBe(name);
    }
  });

  it("keeps the task number in the explicit audit detail", () => {
    const output = text(render(block(history, when("selectedTask")), {
      selectedTask: { id: "CV2-AUDIT-TASK", settlementStatus: "NONE" }, visibility: { mask: String },
      computeCopy: { details: "Details", close: "Close" },
    }));
    expect(output).toContain("CV2-AUDIT-TASK");
  });
});
