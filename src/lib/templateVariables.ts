// Per-lead template variable substitution.
//
// IMPORTANT: This is only safe to call where a single concrete lead is known
// (e.g. LeadSlideOver). Do NOT use it in the sequence step editor — a sequence
// step is reused for every future lead enrolled, so its placeholders must stay
// literal at edit time.

/**
 * Replace the lead-specific placeholders in a template body with real values.
 *
 * - `{lead_name}` -> lead.name (falls back to "there" when null/empty)
 * - `{lead_property_type}` -> the lead's property type (falls back to "property")
 *
 * Any other `{placeholder}` is left untouched.
 */
interface LeadLike {
  name?: string | null;
  property_type?: string | null;
  lead_property_type?: string | null;
  preferred_property_type?: string | null;
  [key: string]: unknown;
}

export function substituteTemplateVariables(
  body: string,
  lead: LeadLike | null | undefined
): string {
  if (!body) return body;

  const name =
    typeof lead?.name === "string" && lead.name.trim() !== ""
      ? lead.name.trim()
      : "there";

  // Property type may live on the lead row or on its qualification record.
  const rawPropertyType =
    lead?.property_type ?? lead?.lead_property_type ?? lead?.preferred_property_type;
  const propertyType =
    typeof rawPropertyType === "string" && rawPropertyType.trim() !== ""
      ? rawPropertyType.trim()
      : "property";

  return body
    .replace(/\{lead_name\}/g, name)
    .replace(/\{lead_property_type\}/g, propertyType);
}
