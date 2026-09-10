import { describe, expect, it } from "vitest";
import source from "./app.ts?raw";
import cardContent from "../components/earn/device-card-pc.vue?raw";
import ts from "typescript";
import { isActiveSlotDevice, requiresActivationConfirmation } from "../lib/device-slot-policy";

const ast = ts.createSourceFile("app.ts", source, ts.ScriptTarget.Latest, true);
let body = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "canonicalDevice") body = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
if (!body) throw new Error("canonicalDevice missing");
const compiled = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const project = new Function("canonicalKind", `${compiled}; return canonicalDevice;`)((device: {kind?:string}) => device.kind ?? "cloud-share");
const fixture = { id: 42, status: "ACTIVE", activatedAt: 123, purchasedAt: 100, pendingDeactivate: false,
  capacityPct: 100, dailyUsdt: 2, dailyNex: 3, todayEarningsUsdt: 7, todayEarningsNex: 8,
  cumulativeOutputUsdt: 9, actualPaidUsdt: 10 };
describe("remote fleet lifecycle and online state are independent", () => {
  it.each(["OFFLINE", "UNKNOWN", undefined])("does not report active hardware online for %s", runtimeStatus => {
    const result = project({ ...fixture, runtimeStatus }, 1000, 20);
    expect(result.status).toBe("offline");
    expect(result.runtimeStatus).toBe(runtimeStatus ?? "UNKNOWN");
    expect(result.activatedAt).toBe(123);
    expect(result.todayEarnings).toBe(7);
    expect(result.cumulativeEarningsUsdt).toBe(9);
  });
  it.each(["OFFLINE", "RUNNING"])("preserves a PC-activated %s device and its slot", status => {
    const result = project({ ...fixture, kind: "stellarbox-s1", status, runtimeStatus: "OFFLINE" }, 1000, 20);
    expect(result.activatedAt).toBe(123);
    expect(result.status).toBe("offline");
    expect(isActiveSlotDevice(result)).toBe(true);
    expect(isActiveSlotDevice({...result, pendingDeactivate:true})).toBe(false);
  });
  it.each([null, undefined])("does not invent activation time when the server returns %s", activatedAt => {
    const result = project({...fixture, kind:"stellarbox-s1", activatedAt, runtimeStatus:"ONLINE"},1000,20);
    expect(result.activatedAt).toBeNull();
    expect(result.activationUnconfirmed).toBe(true);
    expect(requiresActivationConfirmation(result)).toBe(true);
    expect(result.status).toBe("offline");
    expect(isActiveSlotDevice(result)).toBe(false);
  });
  it("keeps legal inventory activatable without inventing an activation time", () => {
    const result = project({ ...fixture, kind: "stellarbox-s1", status: "INVENTORY", activatedAt: null }, 1000, 20);
    expect(result.activatedAt).toBeNull();
    expect(result.activationUnconfirmed).toBe(false);
    expect(requiresActivationConfirmation(result)).toBe(false);
  });
  it("uses explicit online runtime without dropping pending state", () => {
    const result = project({ ...fixture, runtimeStatus: "ONLINE", pendingDeactivate: true }, 1000, 20);
    expect(result.status).toBe("online");
    expect(result.pendingDeactivate).toBe(true);
    expect(result.activatedAt).toBe(123);
  });
  it("does not revive a deactivated asset from runtime status", () => {
    const result = project({ ...fixture, status: "DEACTIVATED", runtimeStatus: "ONLINE" }, 1000, 20);
    expect(result.activatedAt).toBeNull();
    expect(result.status).toBe("offline");
  });
  it("fails closed when an active lifecycle also carries a deactivation time", () => {
    const result = project({ ...fixture, kind: "stellarbox-s1", runtimeStatus: "ONLINE", deactivatedAt: 456 }, 1000, 20);
    expect(result.activatedAt).toBeNull();
    expect(result.activationUnconfirmed).toBe(true);
    expect(result.status).toBe("offline");
    expect(isActiveSlotDevice(result)).toBe(false);
    expect(requiresActivationConfirmation(result)).toBe(true);
  });
  it("keeps a legal deactivated record with activation history as ordinary inventory", () => {
    const result = project({ ...fixture, kind: "stellarbox-s1", status: "DEACTIVATED", runtimeStatus: "ONLINE", deactivatedAt: 456 }, 1000, 20);
    expect(result.activatedAt).toBeNull();
    expect(result.activationUnconfirmed).toBe(false);
    expect(result.status).toBe("offline");
    expect(isActiveSlotDevice(result)).toBe(false);
    expect(requiresActivationConfirmation(result)).toBe(false);
  });
});

const cardSource = cardContent.split('<script setup lang="ts">')[1].split("</script>")[0];
const cardAst = ts.createSourceFile("card.ts", cardSource, ts.ScriptTarget.Latest, true);
let labelBody = "";
function findLabel(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(cardAst) === "statusLabel"
      && node.initializer && ts.isCallExpression(node.initializer)) labelBody = node.initializer.arguments[0].getText(cardAst);
  ts.forEachChild(node, findLabel);
}
findLabel(cardAst);
const labelFactory = new Function("props", "reconnecting", "idleGated", "deviceOnline", "t", `return (${labelBody})();`);
const texts = { value: { earn: { runtimeUnknown: "unknown", offline: "offline", online: "online" }, myDevices: { inventoryPendingDeactivateChip: "pending" } } };
describe("actual device card runtime label", () => {
  it.each([undefined, "UNKNOWN"])("renders unknown rather than offline for %s", runtimeStatus => {
    expect(labelFactory({ device: { kind: "cloud-share", capacitySource: "server", runtimeStatus } }, {value:false}, {value:false}, {value:false}, texts)).toBe("unknown");
  });
  it("keeps pending deactivation above unknown runtime", () => {
    expect(labelFactory({ device: {kind:"cloud-share", capacitySource:"server", runtimeStatus:"UNKNOWN", pendingDeactivate:true} }, {value:false}, {value:false}, {value:false}, texts)).toBe("pending");
  });
  it("renders known offline accurately", () => {
    expect(labelFactory({ device: {kind:"cloud-share", capacitySource:"server", runtimeStatus:"OFFLINE"} }, {value:false}, {value:false}, {value:false}, texts)).toBe("offline");
  });
});

// Recalibration is a distinct server-authorized repair flow; ordinary inventory activation stays blocked.
import inventoryContent from "../pages/me/devices.vue?raw";
const inventorySource = inventoryContent.split('<script setup lang="ts">')[1].split("</script>")[0];
const inventoryAst = ts.createSourceFile("devices.ts", inventorySource, ts.ScriptTarget.Latest, true);
let phoneOfferBody = "";
let phoneNavigationBody = "";
function findPhoneRecovery(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(inventoryAst) === "phoneNeedsActivation"
      && node.initializer && ts.isCallExpression(node.initializer)) phoneOfferBody = node.initializer.arguments[0].getText(inventoryAst);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "goPhoneActivation") phoneNavigationBody = node.getText(inventoryAst);
  ts.forEachChild(node, findPhoneRecovery);
}
findPhoneRecovery(inventoryAst);
const offerPhoneRecovery = new Function("app", "session", "requiresActivationConfirmation", `return (${phoneOfferBody})();`);
describe("phone reconciliation remains reachable", () => {
  it.each([[], [{kind:"phone",activatedAt:null,activationUnconfirmed:true}],
    [{kind:"phone",activatedAt:123},{kind:"phone",activatedAt:null,activationUnconfirmed:true}]].map(visibleDevices => ({visibleDevices})))("offers recovery for missing or unconfirmed phone facts", ({visibleDevices}) => {
    expect(offerPhoneRecovery({visibleDevices,accountKey:"u"}, {isCurrentDeviceCalibrated:()=>true}, requiresActivationConfirmation)).toBe(true);
  });
  it("does not require recalibration for a confirmed calibrated phone", () => {
    expect(offerPhoneRecovery({visibleDevices:[{kind:"phone",activatedAt:123}],accountKey:"u"}, {isCurrentDeviceCalibrated:()=>true}, requiresActivationConfirmation)).toBe(false);
  });
  it("navigates to the authenticated recalibration flow without a stale fleet gate", () => {
    const routes:string[]=[];
    new Function("navTo", `${phoneNavigationBody}; goPhoneActivation();`)((route:string)=>routes.push(route));
    expect(routes).toEqual(["/pages/onboarding/connect?mode=recalibrate"]);
  });
});
