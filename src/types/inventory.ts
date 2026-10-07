export type InventoryClassification = 'Equipment' | 'Consumables';

export type InventoryCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';

export type InventoryStatus = 'available' | 'assigned' | 'in_use' | 'maintenance' | 'retired';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'issued' | 'returned' | 'overdue' | 'cancelled';

export const CONSUMABLE_CATEGORIES = [
  'Chemicals',
  'Reagents & Buffers',
  'Glassware & Plasticware',
  'Electronic Components',
  'PPE & Safety',
  'Stationery & Supplies',
  'Raw Materials',
  'Other Consumables',
] as const;

export const EQUIPMENT_CATEGORIES = [
  'Electronics',
  'Lab Equipment & Instruments',
  'Tools & Hardware',
  'Appliances',
  'Computing & IT',
  'Audio & Visual',
  'Other Equipment',
] as const;

export type ConsumableCategory = (typeof CONSUMABLE_CATEGORIES)[number];
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export function getCategoriesForClassification(classification: InventoryClassification): string[] {
  return classification === 'Consumables' ? [...CONSUMABLE_CATEGORIES] : [...EQUIPMENT_CATEGORIES];
}

export interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  classification: InventoryClassification;
  quantity: number;
  location: string;
  serial_number?: string | null;
  asset_tag?: string | null;
  condition: InventoryCondition;
  status: InventoryStatus;
  po_number?: string | null;
  vendor_name?: string | null;
  purchased_by?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  is_returnable?: boolean;
  expected_return_date?: string | null;
  assigned_user?: {
    full_name: string;
    email: string;
  } | null;
  expiry_date?: string | null;
  warranty_end_date?: string | null;
  last_maintenance_date?: string | null;
  facility_id?: string | null;
  facility_name?: string | null;
  facility_location?: string | null;
  purchase_request_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryRequest {
  id: string;
  inventory_item_id: string;
  requested_by: string;
  quantity: number;
  purpose?: string | null;
  request_date: string;
  status: RequestStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  issued_by?: string | null;
  issue_date?: string | null;
  is_returnable: boolean;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  returned_condition?: InventoryCondition | null;
  return_remarks?: string | null;
  received_by?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  // Joined item fields
  item_name?: string;
  category?: string;
  classification?: InventoryClassification;
  asset_tag?: string | null;
  serial_number?: string | null;
  location?: string;
  current_stock?: number;
  po_number?: string | null;
  vendor_name?: string | null;
  facility_id?: string | null;
  facility_name?: string | null;
  // Joined user fields
  requester_name?: string;
  requester_email?: string;
  approver_name?: string;
  issuer_name?: string;
  receiver_name?: string;
}
