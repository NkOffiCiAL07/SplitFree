"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COUNTRIES, countryByCode, dialFor, flagOf, parseE164 } from "@/lib/countries";
import { normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  /** A saved number in international format to start from (e.g. +919876543210). Changing it resets the field. */
  initial?: string;
  /** Country to preselect when there is no saved number (ISO code, e.g. "IN") */
  defaultCountry?: string;
  /** Called with the number in international format when it is valid, otherwise with whatever was typed */
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/** A saved Indian number reads better as 98765 43210 */
const groupNational = (country: string, national: string) => (country === "IN" && /^\d{10}$/.test(national) ? `${national.slice(0, 5)} ${national.slice(5)}` : national);

const emit = (country: string, text: string) => normalizePhone(text, dialFor(country)) ?? text;

/**
 * Mobile number with a country-code picker: tap the flag and code to choose the country (the phone's own picker on
 * mobile), then type the number the way people write it locally. Anything typed with a + overrides the picker.
 */
export function PhoneField({ id, initial = "", defaultCountry, onChange, invalid, describedBy, disabled, autoFocus, className }: Props) {
  const start = (value: string) => {
    const parsed = parseE164(value);
    return parsed ? { country: parsed.country, text: groupNational(parsed.country, parsed.national) } : { country: countryByCode(defaultCountry)?.code ?? "", text: "" };
  };
  const [state, setState] = useState(() => start(initial));
  const [syncedFrom, setSyncedFrom] = useState(initial);

  // A different saved number arrived (e.g. the profile finished loading): show it (state adjusted during render, not in an effect)
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setState(start(initial));
  }

  const country = countryByCode(state.country);
  const update = (next: { country: string; text: string }) => {
    setState(next);
    onChange(emit(next.country, next.text));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative shrink-0">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-9 items-center gap-1 rounded-lg border border-input bg-background px-2.5 text-sm shadow-sm max-lg:h-[52px] max-lg:rounded-2xl max-lg:px-3 max-lg:text-base",
            disabled && "opacity-50",
          )}
        >
          <span className="text-base leading-none">{country ? flagOf(country.code) : "🌐"}</span>
          <span className="tabular-nums">{country ? `+${country.dial}` : "Code"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </span>
        <select
          aria-label="Country code"
          value={state.country}
          disabled={disabled}
          onChange={(e) => update({ country: e.target.value, text: state.text })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        >
          {!country && <option value="">Choose country code</option>}
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{`${flagOf(c.code)} ${c.name} (+${c.dial})`}</option>
          ))}
        </select>
      </div>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={country?.example ?? "Mobile number"}
        value={state.text}
        onChange={(e) => update({ country: state.country, text: e.target.value })}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="max-lg:h-[52px] max-lg:rounded-2xl"
      />
    </div>
  );
}
