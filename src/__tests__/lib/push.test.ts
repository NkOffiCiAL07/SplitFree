import { describe, it, expect } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push-endpoints";
import { urlBase64ToUint8Array, isPushSupported } from "@/lib/push-client";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real browser push services", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
  });

  it("rejects anything that could turn the server into a request proxy (SSRF)", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false); // not https
    expect(isAllowedPushEndpoint("https://evil.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false); // suffix trick
    expect(isAllowedPushEndpoint("https://notfcm.googleapis.com.attacker.io/")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("not a url")).toBe(false);
    expect(isAllowedPushEndpoint("")).toBe(false);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url (with - and _ and missing padding) to bytes", () => {
    // bytes [251, 255, 190] encode to "-_-" in base64url (and "+/+" in standard base64)
    expect([...urlBase64ToUint8Array("-_-_")]).toEqual([251, 255, 191]);
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array("AQI")]).toEqual([1, 2]); // padding restored
  });
});

describe("isPushSupported", () => {
  it("is false in jsdom (no service worker / PushManager)", () => {
    expect(isPushSupported()).toBe(false);
  });
});
