import { describe, it, expect } from "vitest";
import { createGroupSchema, updateGroupSchema, addMemberSchema } from "@/lib/validations/group";

describe("createGroupSchema", () => {
  const valid = {
    name: "Beach Trip",
    category: "TRIP" as const,
    currency: "USD" as const,
  };

  it("accepts a valid group", () => {
    expect(() => createGroupSchema.parse(valid)).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() => createGroupSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects name over 100 chars", () => {
    expect(() => createGroupSchema.parse({ ...valid, name: "a".repeat(101) })).toThrow();
  });

  it("rejects invalid category", () => {
    expect(() => createGroupSchema.parse({ ...valid, category: "PARTY" })).toThrow();
  });

  it("rejects invalid currency", () => {
    expect(() => createGroupSchema.parse({ ...valid, currency: "BTC" })).toThrow();
  });

  it("accepts optional description", () => {
    const result = createGroupSchema.parse({ ...valid, description: "Fun trip" });
    expect(result.description).toBe("Fun trip");
  });

  it("rejects description over 500 chars", () => {
    expect(() => createGroupSchema.parse({ ...valid, description: "x".repeat(501) })).toThrow();
  });

  it("accepts memberEmails array", () => {
    const result = createGroupSchema.parse({ ...valid, memberEmails: ["a@b.com", "c@d.com"] });
    expect(result.memberEmails).toHaveLength(2);
  });

  it("rejects invalid email in memberEmails", () => {
    expect(() => createGroupSchema.parse({ ...valid, memberEmails: ["not-an-email"] })).toThrow();
  });

  it("accepts all category values", () => {
    const categories = ["HOME", "TRIP", "COUPLE", "FRIENDS", "WORK", "OTHER"] as const;
    categories.forEach((cat) => {
      expect(() => createGroupSchema.parse({ ...valid, category: cat })).not.toThrow();
    });
  });

  it("accepts all currency values", () => {
    const currencies = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"] as const;
    currencies.forEach((cur) => {
      expect(() => createGroupSchema.parse({ ...valid, currency: cur })).not.toThrow();
    });
  });
});

describe("updateGroupSchema", () => {
  it("requires a valid UUID id", () => {
    expect(() =>
      updateGroupSchema.parse({ id: "not-a-uuid", name: "Test", category: "HOME", currency: "USD" })
    ).toThrow();
  });

  it("accepts partial updates with valid id", () => {
    const result = updateGroupSchema.parse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "New Name",
    });
    expect(result.name).toBe("New Name");
  });
});

describe("addMemberSchema", () => {
  it("accepts valid email", () => {
    const result = addMemberSchema.parse({ email: "user@example.com" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(() => addMemberSchema.parse({ email: "not-an-email" })).toThrow();
  });

  it("rejects empty email", () => {
    expect(() => addMemberSchema.parse({ email: "" })).toThrow();
  });
});
