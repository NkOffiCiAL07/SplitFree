import { describe, it, expect } from "vitest";
import { currencyForCountry } from "@/lib/currencies";
import { countryFromPhone } from "@/lib/countries";

describe("currency follows where you live", () => {
  it("maps countries to the currency people pay in", () => {
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("gb")).toBe("GBP");
    expect(currencyForCountry("DE")).toBe("EUR");
    expect(currencyForCountry("JP")).toBe("JPY");
    expect(currencyForCountry("AU")).toBe("AUD");
    expect(currencyForCountry("BR")).toBe("USD");
    expect(currencyForCountry(null)).toBe("INR");
  });
  it("reads the country from a phone number (longest dial code wins)", () => {
    expect(countryFromPhone("+919876543210")).toBe("IN");
    expect(countryFromPhone("+447911123456")).toBe("GB");
    expect(countryFromPhone("+353851234567")).toBe("IE"); // not "+3…"
    expect(countryFromPhone("+14165550123")).toBe("US");
    expect(countryFromPhone("")).toBeNull();
  });
});
