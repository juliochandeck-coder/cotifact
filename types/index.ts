export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type QuoteStatus = "pendiente" | "aprobada" | "rechazada" | "recotizar";
export type InvoiceStatus = "pendiente" | "enviada" | "pagada";

type DocumentBase = {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Quote = DocumentBase & {
  quote_number: string;
  valid_until: string | null;
  status: QuoteStatus;
  client_id: string | null;
  sent_at: string | null;
  approved_at: string | null;
  project_name: string | null;
  project_description: string | null;
  is_retainer: boolean;
  retainer_group_id: string | null;
};

export type Invoice = DocumentBase & {
  quote_id: string | null;
  client_id: string | null;
  invoice_number: string;
  due_date: string | null;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  project_name: string | null;
  project_description: string | null;
  payment_method: string | null;
  requires_dgi: boolean;
  dgi_invoice_number: string | null;
  dgi_issued_at: string | null;
  is_retainer_invoice: boolean;
};

export type Client = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  requires_dgi_default: boolean;
  created_at: string;
};

export type Service = {
  id: string;
  user_id: string;
  name: string;
  unit_price: number;
  created_at: string;
};

export type CompanySettings = {
  user_id: string;
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  tax_id: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  username: string | null;
  font_pair: string;
  currency: string;
  locale: string;
  default_tax_rate: number;
  default_notes: string | null;
  /** Forma de pago que sale en todas las facturas (migration_v9). */
  default_payment_method?: string | null;
  payment_terms_days: number;
  followup_days: number;
  onboarded_at: string | null;
};

export const DEFAULT_BRAND_PRIMARY = "#000000";
export const DEFAULT_BRAND_SECONDARY = "#666666";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "No aprobada",
  recotizar: "Re-cotizar",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pendiente: "No pagada",
  enviada: "Enviada",
  pagada: "Pagada",
};

export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[];
export const INVOICE_STATUSES = Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[];

export const CURRENCIES = [
  { code: "USD", locale: "es-PA", label: "Dólar / Balboa (USD) — Panamá" },
  { code: "MXN", locale: "es-MX", label: "Peso mexicano (MXN)" },
  { code: "COP", locale: "es-CO", label: "Peso colombiano (COP)" },
  { code: "CLP", locale: "es-CL", label: "Peso chileno (CLP)" },
  { code: "ARS", locale: "es-AR", label: "Peso argentino (ARS)" },
  { code: "PEN", locale: "es-PE", label: "Sol peruano (PEN)" },
  { code: "GTQ", locale: "es-GT", label: "Quetzal (GTQ)" },
  { code: "DOP", locale: "es-DO", label: "Peso dominicano (DOP)" },
  { code: "EUR", locale: "es-ES", label: "Euro (EUR)" },
  { code: "BRL", locale: "pt-BR", label: "Real brasileño (BRL)" },
] as const;

export const DEFAULT_SETTINGS: Omit<CompanySettings, "user_id"> = {
  company_name: null,
  company_email: null,
  company_phone: null,
  company_address: null,
  tax_id: null,
  logo_url: null,
  brand_primary: null,
  brand_secondary: null,
  username: null,
  font_pair: "roboto",
  currency: "USD",
  locale: "es-PA",
  default_tax_rate: 7,
  default_notes: null,
  payment_terms_days: 15,
  followup_days: 7,
  onboarded_at: null,
};

// --- Panel Resumen ---
export type SummaryKpis = {
  quoted_total: number;
  quoted_count: number;
  invoiced_total: number;
  invoiced_count: number;
  collected_total: number;
  outstanding_total: number;
  approved_count: number;
  rejected_count: number;
};

export type SummaryFunnel = {
  sent: number;
  approved: number;
  invoiced: number;
  collected: number;
};

export type SummaryTopService = {
  description: string;
  times_used: number;
  total_revenue: number;
};

export type SummaryTopClient = {
  client_name: string;
  total_amount: number;
  document_count: number;
};

export type SummaryAverages = {
  avg_ticket: number | null;
  avg_days_to_approval: number | null;
  avg_days_to_payment: number | null;
};

export type SummaryRangePreset = "month" | "quarter" | "year" | "custom";

export type FontPairKey = "roboto" | "grotesk-serif" | "classic";

export const FONT_PAIRS: Record<FontPairKey, { label: string; title: string; body: string }> = {
  roboto: { label: "Arimo + Inter (por defecto)", title: "'Arimo', sans-serif", body: "'Arimo', sans-serif" },
  "grotesk-serif": {
    label: "Grotesk + Serif (editorial)",
    title: "'Playfair Display', serif",
    body: "'Work Sans', sans-serif",
  },
  classic: {
    label: "Clásico (documento formal)",
    title: "'Merriweather', serif",
    body: "'Source Sans 3', sans-serif",
  },
};
