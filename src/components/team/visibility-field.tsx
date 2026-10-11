"use client";

import type { BoardVisibility } from "@/db/schema";

const OPTIONS: { value: BoardVisibility; label: string; hint: string }[] = [
  {
    value: "public",
    label: "Public",
    hint: "Anyone with the Board's address can read it and take part.",
  },
  {
    value: "private",
    label: "Private",
    hint: "Only your Team's Members and people with the share link can open it.",
  },
];

/** The Public / Private choice of a Board (US-4.1), shared by the create and edit dialogs. */
export function VisibilityField({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: BoardVisibility;
  onChange: (value: BoardVisibility) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Visibility</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="flex items-start gap-2 text-base text-body">
          <input
            type="radio"
            name="visibility"
            id={`${idPrefix}-${option.value}`}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1"
          />
          <span className="flex flex-col">
            <span className="font-medium text-ink">{option.label}</span>
            <span className="text-sm text-muted-foreground">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
