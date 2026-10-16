/**
 * Single source of field order/labels for SDLG Dynamics Dealer Portal helper.
 * Source: docs/SDLG_DEALER_PORTAL_MAPPING.md (2026-10).
 * If portal form changes, edit this file only.
 */

export type SdlgFieldKey =
  | 'service_type'
  | 'service_method'
  | 'serial_no'
  | 'hm_failure'
  | 'failure_date'
  | 'dealer_repair_date'
  | 'technical_personnel'
  | 'fault_description'
  | 'fault_details'
  | 'machine_location'
  | 'labour_hrs'
  | 'mileage_km'
  | 'logistics_backfill'
  | 'old_part_material_number'
  | 'old_part_qty'
  | 'old_part_name'
  | 'is_primary_cause'
  | 'is_claim'
  | 'is_claimed_compensation'
  | 'fault_cause'
  | 'fault_handling'
  | 'system_suggest'
  | 'assembly_suggest'
  | 'component_suggest'
  | 'mode_suggest'
  | 'repair_action_suggest'
  | 'new_part_material_number'
  | 'new_part_name'
  | 'new_part_qty'
  | 'unit_price_hint'
  | 'currency_hint';

export type SdlgFieldDef = {
  key: SdlgFieldKey;
  /** Portal UI label */
  portalLabel: string;
  section: 'home' | 'replacement_part' | 'fault_info' | 'new_part' | 'price';
  required?: boolean;
  /** Hint for operator */
  note?: string;
};

export const SDLG_FORM_FIELDS: SdlgFieldDef[] = [
  // —— Warranty Claim Form (Home) ——
  { key: 'service_type', portalLabel: 'Service Type', section: 'home', required: true, note: 'Fixed: Repair' },
  { key: 'service_method', portalLabel: 'Service Method', section: 'home', required: true, note: 'Onsite Repair · Workshop Repair · Remote Guidance' },
  { key: 'serial_no', portalLabel: 'Serial number', section: 'home', required: true },
  { key: 'hm_failure', portalLabel: 'Hour meter', section: 'home', required: true },
  { key: 'failure_date', portalLabel: 'Failure Date', section: 'home', required: true },
  { key: 'dealer_repair_date', portalLabel: 'Date of repair report', section: 'home', required: true },
  { key: 'technical_personnel', portalLabel: 'Feedback Person', section: 'home', required: true },
  { key: 'fault_description', portalLabel: 'Complaint', section: 'home', required: true },
  { key: 'fault_details', portalLabel: 'Fault Details', section: 'home' },
  { key: 'machine_location', portalLabel: 'Machine Location', section: 'home', required: true },
  { key: 'labour_hrs', portalLabel: 'Repair Labor', section: 'home' },
  { key: 'mileage_km', portalLabel: 'Service Mileage', section: 'home' },
  { key: 'logistics_backfill', portalLabel: 'Logistics Backfill Document', section: 'home', note: 'Default: No' },

  // —— Replacement Record — part identity ——
  { key: 'old_part_material_number', portalLabel: 'Old Part Material Number', section: 'replacement_part', required: true, note: 'Tanpa prefix SLG-' },
  { key: 'old_part_qty', portalLabel: 'Old Part Quantity', section: 'replacement_part' },
  { key: 'old_part_name', portalLabel: 'Old Part Material Name', section: 'replacement_part' },
  { key: 'is_primary_cause', portalLabel: 'Is it the Primary Cause Part', section: 'replacement_part', required: true },
  { key: 'is_claim', portalLabel: 'Is it a claim', section: 'replacement_part', required: true },
  { key: 'is_claimed_compensation', portalLabel: 'Is Claimed for Compensation', section: 'replacement_part', required: true },

  // —— Fault Information ——
  { key: 'fault_cause', portalLabel: 'Fault Cause', section: 'fault_info', required: true },
  { key: 'fault_handling', portalLabel: 'Fault Handling', section: 'fault_info', required: true },
  { key: 'system_suggest', portalLabel: 'System (saran)', section: 'fault_info', required: true, note: 'Dropdown portal — konfirmasi operator' },
  { key: 'assembly_suggest', portalLabel: 'Assembly (saran)', section: 'fault_info', required: true, note: 'Saran saja' },
  { key: 'component_suggest', portalLabel: 'Component (saran)', section: 'fault_info', required: true, note: 'Saran saja' },
  { key: 'mode_suggest', portalLabel: 'Mode (saran)', section: 'fault_info', required: true, note: 'Saran saja' },
  { key: 'repair_action_suggest', portalLabel: 'Repair Action (saran)', section: 'fault_info', required: true, note: 'Saran saja' },

  // —— New part ——
  { key: 'new_part_material_number', portalLabel: 'New Part Material Number', section: 'new_part', required: true },
  { key: 'new_part_name', portalLabel: 'New Part Material Name', section: 'new_part' },
  { key: 'new_part_qty', portalLabel: 'Quantity', section: 'new_part', required: true },

  // —— Price hints ——
  { key: 'unit_price_hint', portalLabel: 'New Part Unit Price (hint)', section: 'price', note: 'Portal sering hitung sendiri' },
  { key: 'currency_hint', portalLabel: 'Currency (hint)', section: 'price' },
];

export const SDLG_SECTION_TITLES: Record<SdlgFieldDef['section'], string> = {
  home: 'Warranty Claim Form (Home)',
  replacement_part: 'Replacement — Part identity',
  fault_info: 'Fault Information',
  new_part: 'New part line',
  price: 'Price (hint only)',
};
