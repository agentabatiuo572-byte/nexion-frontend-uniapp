import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const [stage, unpacked, appKeyFile] = process.argv.slice(2);
const appKey = fs.readFileSync(appKeyFile, "utf8").trim();
assert.match(appKey, /^[a-f0-9]{24}$/i);
const version = "6.3.0";
const module = "UvelJPushSDK";
const input = path.join(unpacked, "Lib", "JPushSDKLib-noidfa", `jpush-ios-${version}.xcframework`);
const plugin = path.join(stage, "src", "uni_modules", "uvel-native-push", "utssdk", "app-ios");
const output = path.join(plugin, "Frameworks", `${module}.xcframework`);
const header = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
for (const slice of ["ios-arm64", "ios-arm64_x86_64-simulator"]) {
  const source = path.join(input, slice);
  const framework = path.join(output, slice, `${module}.framework`);
  fs.mkdirSync(path.join(framework, "Headers"), { recursive: true });
  fs.mkdirSync(path.join(framework, "Modules"), { recursive: true });
  fs.copyFileSync(path.join(source, "libJPush.a"), path.join(framework, module));
  fs.copyFileSync(path.join(source, "Headers", "JPUSHService.h"), path.join(framework, "Headers", "JPUSHService.h"));
  fs.writeFileSync(path.join(framework, "Modules", "module.modulemap"), `framework module ${module} { umbrella header "JPUSHService.h" export * }\n`);
  fs.writeFileSync(path.join(framework, "Info.plist"), header + `<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>ai.uvel.jpushsdk</string>
<key>CFBundleExecutable</key><string>${module}</string>
<key>CFBundlePackageType</key><string>FMWK</string>
<key>CFBundleVersion</key><string>${version}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
</dict></plist>\n`);
}
const plist = fs.readFileSync(path.join(input, "Info.plist"), "utf8");
assert.ok(plist.includes("libJPush.a") && plist.includes("HeadersPath"));
fs.writeFileSync(path.join(output, "Info.plist"), plist
  .replaceAll("libJPush.a", `${module}.framework`)
  .replace(/\s*<key>HeadersPath<\/key>\s*<string>Headers<\/string>/g, ""));
fs.copyFileSync(path.join(input, "ios-arm64", "PrivacyInfo.xcprivacy"), path.join(plugin, "PrivacyInfo.xcprivacy"));
fs.writeFileSync(path.join(plugin, "Info.plist"), header + `<plist version="1.0"><dict>
<key>UvelJPushAppKey</key><string>${appKey}</string>
</dict></plist>\n`);

console.log(`Prepared JPush iOS SDK ${version} with Objective-C headers and vendor privacy manifest`);
