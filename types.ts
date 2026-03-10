// ... existing code ...

export interface UserPermissions {
  dashboard: {
    view: boolean;
  };
  inventory: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    manage_status: boolean;
  };
  assets: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
  };
  finance: {
    view: boolean;
    add_income: boolean;
    add_expense: boolean;
    export: boolean;
  };
  team: {
    view: boolean;
    manage: boolean;
  };
  reports: {
    view: boolean;
  };
  // صلاحيات إدارة الاشتراكات
  subscription: {
    view_requests: boolean;      // عرض طلبات الدفع
    approve_requests: boolean;   // الموافقة على الطلبات
    reject_requests: boolean;    // رفض الطلبات
    manage_plans: boolean;       // إدارة الباقات والأسعار
    manage_discounts: boolean;   // إدارة أكواد الخصم
    view_reports: boolean;       // عرض تقارير الإيرادات
    manage_notifications: boolean; // إدارة الرسائل التلقائية
  };
  [key: string]: { [key: string]: boolean } | undefined;
}

export interface Profile {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  org_id?: string;
  role?: string; // 'super_admin' | 'owner' | 'admin' | 'supervisor' | 'staff'
  status?: 'active' | 'disabled';
  whatsapp_number?: string;
  permissions: UserPermissions;
  settings?: {
    transaction_categories?: {
      income: { id: string, label: string }[];
      expense: { id: string, label: string }[];
    }
  };
}

export interface Transaction {
  id: string;
  user_id: string;
  car_id: string;
  type: 'income' | 'expense';
  amount: number;
  reason?: string;
  date: string;
  created_at?: string;
  car_name?: string;
  category?: string;
  notes?: string;
}

export interface CarStats {
  total_income: number;
  total_expense: number;
  balance: number;
}

export interface Car {
  id: string;
  user_id?: string;
  org_id?: string;
  name?: string;
  make?: string;
  model?: string;
  plate_number?: string;
  year?: string;

  // New Fields
  license_number?: string;
  license_expiry?: string;
  owner_percentage?: number;
  driver_percentage?: number;

  // Enterprise Features 🚀
  current_odometer?: number;
  status?: 'active' | 'maintenance' | 'rented' | 'out_of_service';
  next_periodic_maintenance_km?: number;
  documents_urls?: Record<string, string>;

  created_at?: string;
  // Optional for frontend logic
  history?: Transaction[];
  stats?: CarStats;
}

export interface AssetInstallment {
  id: string;
  asset_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export interface Asset {
  id: string;
  org_id: string;
  car_id?: string;
  asset_type: 'car' | 'equipment' | 'property' | 'other';
  name: string;
  purchase_price: number;
  purchase_date: string;
  current_value?: number;
  status: 'active' | 'inactive' | 'sold';
  assigned_driver_id?: string;
  assigned_user_id?: string; // New field for user assignment
  sale_price?: number;
  sale_date?: string;
  notes?: string;
  created_at?: string;

  // Computed / Frontend fields
  total_income?: number;
  total_expense?: number;
  roi?: number;
  remaining_value?: number;
  installments?: AssetInstallment[];
  driver_name?: string; // For display
  car_details?: Car; // For display
}

export interface PlanFeatures {
  reports: boolean;
  export?: boolean;
  priority_support?: boolean;
  max_users?: number;
  max_cars?: number;

  // New Modules
  inventory?: boolean;
  finance?: boolean;
  team?: boolean;
  maintenance?: boolean;
  assets?: boolean;
  advanced_reports?: boolean;
  alerts?: boolean;
  [key: string]: boolean | number | undefined;
}

export interface Plan {
  id: string;
  name: string;
  name_ar: string;
  description_ar?: string;
  price: number; // Deprecated: use price_monthly
  price_monthly: number;
  price_yearly: number;
  price_before_discount?: number;
  discount_text?: string;
  is_featured?: boolean;
  interval: 'monthly' | 'yearly';
  duration_days?: number;
  features: PlanFeatures;
  is_trial?: boolean;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

// ==================== نظام أكواد الخصم ====================
export interface DiscountCode {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  allowed_plans?: string[];
  max_uses: number;
  used_count: number;
  first_subscription_only?: boolean;
  expires_at?: string;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
}

// ==================== نظام الاشتراكات ====================
export interface Subscription {
  id: string;
  org_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  start_date?: string;
  end_date?: string;
  price_original: number;
  discount_code_id?: string;
  discount_amount: number;
  price_final: number;
  auto_renew?: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  plan?: Plan;
  organization?: Organization;
}

// ==================== طلبات الدفع ====================
export type PaymentMethod = 'instapay' | 'vodafone_cash';
export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentRequest {
  id: string;
  subscription_id?: string;
  org_id: string;
  user_id?: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  amount: number;
  discount_code?: string;
  discount_amount: number;
  final_amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  receipt_url?: string;
  status: PaymentRequestStatus;
  admin_notes?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
  // Joined fields
  plan?: Plan;
  organization?: Organization;
  user?: Profile;
  reviewer?: Profile;
}

export interface OrgSettings {
  logo_url?: string;
  address?: string;
  phone?: string;
  support_number?: string;
  footer_text?: string;
  transaction_categories?: {
    income: { id: string, label: string }[];
    expense: { id: string, label: string }[];
  };
  custom_features?: Partial<PlanFeatures>; // Override plan features per org
}

export interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
  subscription_start?: string;
  subscription_end?: string;
  status?: 'active' | 'disabled';
  is_active: boolean;
  max_users: number;
  max_cars: number;
  manual_extension_end?: string;
  has_used_trial?: boolean;
  current_subscription_id?: string;
  settings?: OrgSettings;
  created_at?: string;
}

export interface Driver {
  id: string;
  org_id: string;
  full_name: string;
  license_number: string;
  phone_number: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface SystemConfig {
  maintenance_mode: boolean;
  version: string;
  min_app_version: string;
  show_announcement?: boolean;
  announcement_data?: {
    title: string;
    body: string;
    date: string;
    target_plans?: string[]; // IDs of plans to target
    version?: string; // To track seen state
  };
  show_landing_page: boolean;
  show_pricing_page: boolean;
  allow_registration: boolean;
  allow_trial_accounts: boolean;
  default_entry_page: 'landing' | 'pricing' | 'login';
  whatsapp_number: string; // Already existed, confirming presence
  instapay_handle?: string;
  vodafone_cash_number?: string;
  show_subscription_banner: boolean;
  grace_period_days?: number; // Default: 7 days
  grace_period_allowed_modules?: (keyof UserPermissions)[]; // e.g. ['inventory']
  available_plans: Plan[];
  survey_link?: string;
  support_contact?: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  // Joined fields
  admin_name?: string;
  admin_email?: string;
}

export interface ExpenseTemplate {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  category: string;
  type: 'income' | 'expense'; // New field
  is_active: boolean;
  created_at?: string;
}

// ==================== WhatsApp Types ====================

export interface WhatsAppSession {
  id: string;
  org_id: string;
  name: string;
  phone_number?: string;
  status: 'initializing' | 'connected' | 'disconnected';
  connected_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  connected?: boolean;
  waName?: string;
}

export type MessageStatus = 'sent' | 'failed' | 'pending';
export type QueueStatus = MessageStatus | 'processing';
export type NotificationType = 'trial_welcome' | 'paid_welcome' | 'expiry_reminder' | 'expiry_urgent';

export interface WhatsAppMessage {
  id: string;
  session_id: string;
  recipient: string;
  content: string;
  type: 'text' | 'template';
  status: MessageStatus;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationQueue {
  id: string;
  org_id: string;
  recipient_phone: string;
  template_id?: string;
  variables?: Record<string, string>;
  status: MessageStatus;
  scheduled_at?: string;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface WhatsAppNotificationLog {
  id: number;
  notification_type: NotificationType;
  org_id: string;
  user_id: string;
  phone_number: string;
  status: MessageStatus;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface WhatsAppNotificationQueue {
  id: number;
  org_id: string;
  user_id?: string;
  phone_number: string;
  notification_type: NotificationType;
  variables?: Record<string, string | number>;
  status: QueueStatus;
  error_message?: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
}

export interface WhatsAppNotificationSettings {
  whatsapp_enabled: boolean;
  trial_welcome_enabled: boolean;
  paid_welcome_enabled: boolean;
  expiry_reminders_enabled: boolean;
  reminder_days: number[];
}

export interface WhatsAppAuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  admin_name?: string;
  admin_email?: string;
}