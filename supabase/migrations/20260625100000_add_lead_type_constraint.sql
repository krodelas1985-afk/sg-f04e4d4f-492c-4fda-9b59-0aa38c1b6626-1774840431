-- Canonical lead_type classification: Buyer, Seller, Agent, Developer, Affiliate, Others.
-- Salvage the one clean value from the now-retired buyer_type column.
UPDATE leads SET lead_type = 'Buyer'
WHERE buyer_type = 'Buyer' AND lead_type IS NULL;

-- Constrain lead_type to the canonical set (NULL still allowed for unclassified leads).
ALTER TABLE leads
  ADD CONSTRAINT leads_lead_type_chk
  CHECK (lead_type IS NULL OR lead_type = ANY (ARRAY['Buyer','Seller','Agent','Developer','Affiliate','Others']));
