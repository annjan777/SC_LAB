export interface Facility {
  id: string;
  name: string;
  location: string;
  project_code?: string | null;
  funded_by?: string | null;
  capacity?: number | null;
  features?: string[] | null;
  description?: string | null;
  make_model?: string | null;
  specifications?: any;
  serial_number?: string | null;
  asset_tag?: string | null;
  status: string | null;
  assigned_to_user_id?: string | null;
  warranty_end_date?: string | null;
  last_maintenance_date?: string | null;
  user_manual_url?: string | null;
  vendor_name?: string | null;
  vendor_contact?: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  linked_equipment_count?: number;
  upcoming_bookings_count?: number;
  linked_equipment?: FacilityLinkedEquipment[];
  assigned_user?: {
    full_name: string;
    email: string;
  };
}

export interface FacilityLinkedEquipment {
  id: string;
  item_name: string;
  category: string;
  serial_number?: string | null;
  asset_tag?: string | null;
  location?: string | null;
  condition: string;
  quantity: number;
  facility_id?: string | null;
}

export interface FacilityBooking {
  id: string;
  facility_id: string;
  facility_name?: string;
  facility_location?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string | null;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface EquipmentBooking {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  item_category?: string;
  item_location?: string;
  facility_name?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  start_time: string;
  end_time: string;
  quantity: number;
  purpose: string;
  notes?: string | null;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}
