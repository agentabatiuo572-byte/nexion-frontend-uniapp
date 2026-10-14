import ts from "typescript";
import { computed, reactive, ref } from "vue";
import { expect, it } from "vitest";
import source from "./chat.vue?raw";
import { zh } from "@/i18n/messages/zh";
import { en } from "@/i18n/messages/en";
import { vi as vietnamese } from "@/i18n/messages/vi";
const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
const ast = ts.createSourceFile("chat.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const wanted = new Set(["advisorApplies", "headerName", "showUnassignedReceived", "displayAgentName", "isWaitingForAgent"]);
const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) ? wanted.has(node.name?.text ?? "")
  : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => wanted.has(d.name.getText(ast))));
const code = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(messages = zh) {
  const cid = ref("CV-old-support"), startType = ref<string | null>(null);
  const conv = ref<any>({ id: cid.value, type: "support", status: "open", agentName: "Original S", messages: [{ sender: "user" }] });
  const store = reactive({ advisor: { assignmentState: "ASSIGNED", currentAdvisorName: "Current A" }, advisorError: false, advisorLoading: false });
  const state = new Function("computed", "isAi", "isClosedSession", "cid", "startType", "conv", "convStore", "t", "humanType",
    code + ";return { advisorApplies, headerName, showUnassignedReceived };")(
      computed, ref(false), ref(false), cid, startType, conv, store, ref(messages), ref("advisor"));
  return { state, conv, cid, startType, store };
}
it.each([zh, en, vietnamese])("keeps the existing thread's real owner while account advisor changes or becomes unbound", messages => {
  const h = harness(messages);
  expect(h.state.headerName.value).toBe("Original S"); expect(h.state.advisorApplies.value).toBe(false);
  h.store.advisor.assignmentState = "UNBOUND"; h.store.advisor.currentAdvisorName = "";
  expect(h.state.headerName.value).toBe("Original S"); expect(h.state.showUnassignedReceived.value).toBe(false);
  h.conv.value = { ...h.conv.value, agentName: "Refreshed S" };
  expect(h.state.headerName.value).toBe("Refreshed S"); expect(h.cid.value).toBe("CV-old-support");
  h.conv.value = { ...h.conv.value, agentName: "Unassigned" };
  expect(h.state.headerName.value).toBe(messages.conversations.unassignedAgent);
  expect(h.state.showUnassignedReceived.value).toBe(true);
  h.cid.value = ""; h.conv.value = undefined; h.startType.value = "advisor";
  expect(h.state.advisorApplies.value).toBe(true);
  expect(h.state.headerName.value).toBe(messages.conversations.image.unassigned);
});