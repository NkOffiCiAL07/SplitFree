import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrisma } from "./helpers";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers")).prismaMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { ensureUserProfile, resetKnownUsers } from "@/lib/api-helpers";

const p = prismaMock as any; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => { resetPrisma(); resetKnownUsers(); vi.useRealTimers(); });

describe("ensureUserProfile", () => {
  it("returns the existing profile without writing", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u1", name: "Asha" });
    expect(await ensureUserProfile("u1", "a@x.com")).toEqual({ id: "u1", name: "Asha" });
    expect(p.user.upsert).not.toHaveBeenCalled();
  });

  it("fills in a missing mobile number from the sign-up details instead of asking again (the row existed before the details were applied)", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u7", name: "Asha", phone: null });
    p.user.update.mockResolvedValue({ id: "u7", phone: "+919876543210" });
    await ensureUserProfile("u7", "a@x.com", "Asha", "+919876543210");
    expect(p.user.update).toHaveBeenCalledWith({ where: { id: "u7" }, data: { phone: "+919876543210" } });
  });

  it("never overwrites a number that is already saved, and does nothing when sign-up gave none", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u8", phone: "+14155552671" });
    await ensureUserProfile("u8", "a@x.com", "Asha", "+919876543210");
    expect(p.user.update).not.toHaveBeenCalled();
    resetKnownUsers();
    p.user.findUnique.mockResolvedValue({ id: "u9", phone: null });
    await ensureUserProfile("u9", "a@x.com", "Asha", undefined);
    expect(p.user.update).not.toHaveBeenCalled();
  });

  it("asks for the saved number explicitly (it is hidden from queries by default)", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u10", phone: "+919876543210" });
    await ensureUserProfile("u10", "a@x.com");
    expect(p.user.findUnique.mock.calls[0][0].omit).toEqual({ phone: false });
  });

  it("creates a first-time user with INR and a name derived from the email", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.user.upsert.mockResolvedValue({ id: "u2" });
    await ensureUserProfile("u2", "priya.k@x.com");
    expect(p.user.upsert.mock.calls[0][0].create).toEqual({ id: "u2", email: "priya.k@x.com", name: "priya.k", phone: null, currency: "INR" });
    expect(p.user.upsert.mock.calls[0][0].update).toEqual({}); // never overwrites an existing row
  });

  it("saves the name and mobile number the person gave at sign-up when their profile is first created", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.user.upsert.mockResolvedValue({});
    await ensureUserProfile("u9", "a@x.com", "Asha Rao", "+919876543210");
    expect(p.user.upsert.mock.calls[0][0].create).toMatchObject({ name: "Asha Rao", phone: "+919876543210" });
  });

  it("uses an explicit name when given", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.user.upsert.mockResolvedValue({});
    await ensureUserProfile("u3", "a@x.com", "Asha Rao");
    expect(p.user.upsert.mock.calls[0][0].create.name).toBe("Asha Rao");
  });

  it("remembers a user that exists, so later requests skip the database round trip", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u1" });
    await ensureUserProfile("u1", "a@x.com");
    await ensureUserProfile("u1", "a@x.com");
    await ensureUserProfile("u1", "a@x.com");
    expect(p.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("remembers a freshly created user too", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.user.upsert.mockResolvedValue({ id: "u2" });
    await ensureUserProfile("u2", "a@x.com");
    await ensureUserProfile("u2", "a@x.com");
    expect(p.user.upsert).toHaveBeenCalledTimes(1);
    expect(p.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("tracks each user separately", async () => {
    p.user.findUnique.mockResolvedValue({ id: "x" });
    await ensureUserProfile("a", "a@x.com");
    await ensureUserProfile("b", "b@x.com");
    expect(p.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("re-checks after ten minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    p.user.findUnique.mockResolvedValue({ id: "u1" });
    await ensureUserProfile("u1", "a@x.com");
    vi.setSystemTime(Date.now() + 9 * 60_000);
    await ensureUserProfile("u1", "a@x.com");
    expect(p.user.findUnique).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2 * 60_000);
    await ensureUserProfile("u1", "a@x.com");
    expect(p.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("doesn't cache when creating fails", async () => {
    p.user.findUnique.mockResolvedValue(null);
    p.user.upsert.mockRejectedValueOnce(new Error("db")).mockResolvedValueOnce({ id: "u4" });
    await expect(ensureUserProfile("u4", "a@x.com")).rejects.toThrow("db");
    await ensureUserProfile("u4", "a@x.com");
    expect(p.user.upsert).toHaveBeenCalledTimes(2);
  });
});
