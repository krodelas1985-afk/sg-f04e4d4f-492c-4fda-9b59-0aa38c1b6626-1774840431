// Qualification field catalogs per campaign type.
// buyer_leadgen = client campaigns qualifying property buyers (the original list).
// bamo_b2b = BaMo's own campaigns qualifying RE professionals (agents/brokers/developers).
// The B2B list must stay in sync with W2's b2bDefaultQualFields fallback
// (n8n "AI Campaign Responder", Build Decision Payload node).

export interface QualificationFieldDef {
  field: string;
  label: string;
  placeholder: string;
}

export const BUYER_QUALIFICATION_FIELDS: QualificationFieldDef[] = [
  { field: 'current_location', label: "Lead's Current Location", placeholder: 'e.g. Saan po kayo nakatira ngayon?' },
  { field: 'property_type', label: 'Preferred Property Type', placeholder: 'e.g. Anong type ng property po ang hinahanap ninyo?' },
  { field: 'property_sub_type', label: 'Property Structure Type', placeholder: 'e.g. Bahay at lupa, condo, town house, o vacant lot lang?' },
  { field: 'payment_scheme', label: 'Payment Scheme', placeholder: 'e.g. Cash, installment, o bank financing ang plano?' },
  { field: 'budget', label: 'Budget', placeholder: 'e.g. May budget range po ba kayo?' },
  { field: 'timeframe', label: 'Buying Timeline', placeholder: 'e.g. Kailan kayo balak bumili?' },
  { field: 'phone', label: 'Contact Number', placeholder: 'e.g. May contact number po ba kayo?' },
  { field: 'purpose', label: 'Purpose of Purchase', placeholder: 'e.g. Para sa sariling tirahan o investment?' },
  { field: 'viewing_schedule', label: 'Viewing Availability', placeholder: 'e.g. Kelan po kayo available para sa viewing?' },
  { field: 'preferred_location', label: 'Preferred Location', placeholder: 'e.g. Saan po ang gusto ninyong lokasyon ng property?' },
  { field: 'bedroom', label: 'Bedroom Preference', placeholder: 'e.g. Ilang bedroom po ang hinahanap ninyo?' },
  { field: 'unit_preferred', label: 'Unit Preferred', placeholder: 'e.g. Anong type ng unit po ang gusto ninyo? (Studio, 1BR, 2BR?)' },
  { field: 'motivation', label: 'Motivation', placeholder: 'e.g. Ano po ang dahilan ng paghahanap ng property?' },
  { field: 'civil_status', label: 'Civil Status', placeholder: 'e.g. Ano po ang inyong civil status?' },
  { field: 'decision_maker', label: 'Decision Maker', placeholder: 'e.g. Kayo po ba ang mag-desisyon o may kasama kayong mag-aapprove?' },
  { field: 'email', label: 'Email Address', placeholder: 'e.g. May email address po ba kayo?' },
];

export const B2B_QUALIFICATION_FIELDS: QualificationFieldDef[] = [
  { field: 'role', label: 'Role in Real Estate', placeholder: 'e.g. Kayo po ba ay agent, broker, brokerage owner, o developer?' },
  { field: 'coverage_area', label: 'Coverage Area', placeholder: 'e.g. Saan po ang main coverage area ninyo?' },
  { field: 'team_size', label: 'Team Size', placeholder: 'e.g. Solo agent po ba kayo o may team kayo?' },
  { field: 'active_listings', label: 'Active Listings', placeholder: 'e.g. Ilang active listings po ang hawak ninyo ngayon?' },
  { field: 'lead_gen_method', label: 'Current Lead Source', placeholder: 'e.g. Paano po kayo kumukuha ng buyer leads ngayon?' },
  { field: 'phone', label: 'Contact Number', placeholder: 'e.g. Ano po ang mobile number ninyo?' },
];

export function qualificationFieldsFor(campaignType?: string | null): QualificationFieldDef[] {
  return campaignType === 'bamo_b2b' ? B2B_QUALIFICATION_FIELDS : BUYER_QUALIFICATION_FIELDS;
}
