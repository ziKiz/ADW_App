export type UserRole = 'admin' | 'traktorista' | 'schvalovatel' | 'ekonomka';

export interface AuditMeta {
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

export interface Tractor {
  id: number;
  tractor_code: string;
  tractor_name: string;
  service_centers?: string[];
  vehicle_type?: string;
  status?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

export interface AttachmentDevice {
  id: number;
  attachment_code?: string;
  attachment_name: string;
  license_plate?: string;
  status?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

export interface FieldRecord {
  id: number;
  field_code: string;
  field_name: string;
  quadrant?: string;
  area?: number;
  culture?: string;
  crop?: string;
  erosion?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

export interface WorkType {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}
