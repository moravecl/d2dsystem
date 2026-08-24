export interface FloorplanSymbol {
  type: 'pin' | 'rect' | 'svg';
  width_mm?: number;
  height_mm?: number;
  orientation?: 'free' | 'wall';
  anchor?: 'center' | 'bottom-center';
  snap_to_wall?: boolean;
  wall_offset_mm?: number;
  svg_content?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: 'admin' | 'manager' | 'employee' | 'user';
          is_employee: boolean;
          is_portal_client: boolean;
          client_id: string | null;
          pin_size: number;
          organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          display_name?: string;
          role?: 'admin' | 'manager' | 'employee' | 'user';
          is_employee?: boolean;
          is_portal_client?: boolean;
          client_id?: string | null;
          pin_size?: number;
          organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          display_name?: string;
          role?: 'admin' | 'manager' | 'employee' | 'user';
          is_employee?: boolean;
          is_portal_client?: boolean;
          client_id?: string | null;
          pin_size?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string;
          pill_color: string;
          soft_color: string;
          text_color: string;
          border_color: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string;
          pill_color?: string;
          soft_color?: string;
          text_color?: string;
          border_color?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          icon?: string;
          pill_color?: string;
          soft_color?: string;
          text_color?: string;
          border_color?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string;
          code: string;
          brand: string;
          power: string;
          kind: string;
          tag: string;
          price: number;
          purchase_price: number;
          margin_percent: number;
          image_url: string;
          exclusive_group: string;
          is_active: boolean;
          show_in_catalog: boolean;
          sort_order: number;
          default_icon: string;
          trade: string;
          lumens: number;
          subcategory_id: string | null;
          floorplan_symbol: FloorplanSymbol | null;
          frame_prices: Record<string, number> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string;
          code: string;
          brand?: string;
          power?: string;
          kind?: string;
          tag?: string;
          price?: number;
          purchase_price?: number;
          margin_percent?: number;
          image_url?: string;
          exclusive_group?: string;
          is_active?: boolean;
          show_in_catalog?: boolean;
          sort_order?: number;
          default_icon?: string;
          trade?: string;
          lumens?: number;
          subcategory_id?: string | null;
          floorplan_symbol?: FloorplanSymbol | null;
          frame_prices?: Record<string, number> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          name?: string;
          description?: string;
          code?: string;
          brand?: string;
          power?: string;
          kind?: string;
          tag?: string;
          price?: number;
          purchase_price?: number;
          margin_percent?: number;
          image_url?: string;
          exclusive_group?: string;
          is_active?: boolean;
          show_in_catalog?: boolean;
          sort_order?: number;
          default_icon?: string;
          trade?: string;
          lumens?: number;
          subcategory_id?: string | null;
          floorplan_symbol?: FloorplanSymbol | null;
          frame_prices?: Record<string, number> | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      floorplan_objects: {
        Row: {
          id: string;
          project_id: string;
          product_id: string;
          floor_id: string;
          x: number;
          y: number;
          rotation: number;
          flip_x: boolean;
          flip_y: boolean;
          snap_to_wall: boolean;
          wall_offset_mm: number;
          room_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_id: string;
          floor_id: string;
          x: number;
          y: number;
          rotation?: number;
          flip_x?: boolean;
          flip_y?: boolean;
          snap_to_wall?: boolean;
          wall_offset_mm?: number;
          room_id?: string;
          note?: string;
        };
        Update: {
          x?: number;
          y?: number;
          rotation?: number;
          flip_x?: boolean;
          flip_y?: boolean;
          snap_to_wall?: boolean;
          wall_offset_mm?: number;
          room_id?: string;
          note?: string;
        };
        Relationships: [];
      };
      design_modules: {
        Row: {
          id: string;
          name: string;
          price: number;
          icon_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price?: number;
          icon_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          price?: number;
          icon_url?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      design_presets: {
        Row: {
          id: string;
          name: string;
          frame_size: number;
          modules: string[];
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          frame_size: number;
          modules: string[];
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          frame_size?: number;
          modules?: string[];
          sort_order?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          project_name: string;
          client_name: string;
          version_label: string;
          floorplan_url: string;
          status: string;
          description: string;
          quote_data: Record<string, unknown> | null;
          selection_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          project_name?: string;
          client_name?: string;
          version_label?: string;
          floorplan_url?: string;
          status?: string;
          description?: string;
          quote_data?: Record<string, unknown> | null;
          selection_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          project_name?: string;
          client_name?: string;
          version_label?: string;
          floorplan_url?: string;
          status?: string;
          description?: string;
          quote_data?: Record<string, unknown> | null;
          selection_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_selections: {
        Row: {
          id: string;
          project_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          product_id?: string;
        };
        Relationships: [];
      };
      pin_placements: {
        Row: {
          id: string;
          project_id: string;
          product_id: string;
          x: number;
          y: number;
          note: string;
          design_config: Record<string, unknown> | null;
          placed_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_id: string;
          x: number;
          y: number;
          note?: string;
          design_config?: Record<string, unknown> | null;
          placed_at?: string;
        };
        Update: {
          x?: number;
          y?: number;
          note?: string;
          design_config?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      product_colors: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          hex_code: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          hex_code?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          hex_code?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          image_url: string;
          color_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_url: string;
          color_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          image_url?: string;
          color_id?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          name: string;
          trade: 'electric' | 'water' | 'heating' | 'recuperation';
          unit: string;
          price_per_unit: number;
          purchase_price: number;
          material_type: 'linear' | 'fitting' | 'other';
          fitting_calc_rule: 'per_bend' | 'per_tee' | 'per_endpoint' | 'per_10m' | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          trade?: 'electric' | 'water' | 'heating' | 'recuperation';
          unit?: string;
          price_per_unit?: number;
          purchase_price?: number;
          material_type?: 'linear' | 'fitting' | 'other';
          fitting_calc_rule?: 'per_bend' | 'per_tee' | 'per_endpoint' | 'per_10m' | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          trade?: 'electric' | 'water' | 'heating' | 'recuperation';
          unit?: string;
          price_per_unit?: number;
          purchase_price?: number;
          material_type?: 'linear' | 'fitting' | 'other';
          fitting_calc_rule?: 'per_bend' | 'per_tee' | 'per_endpoint' | 'per_10m' | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      heating_systems: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      heating_system_options: {
        Row: {
          id: string;
          heating_system_id: string;
          name: string;
          slug: string;
          field_type: string;
          options: { value: string; label: string }[];
          default_value: string;
          unit: string;
          description: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          heating_system_id: string;
          name: string;
          slug: string;
          field_type?: string;
          options?: { value: string; label: string }[];
          default_value?: string;
          unit?: string;
          description?: string;
          sort_order?: number;
        };
        Update: {
          name?: string;
          slug?: string;
          field_type?: string;
          options?: { value: string; label: string }[];
          default_value?: string;
          unit?: string;
          description?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      heating_system_materials: {
        Row: {
          id: string;
          heating_system_id: string;
          name: string;
          unit: string;
          price_per_unit: number;
          quantity_per_m2: number;
          quantity_per_m_perimeter: number;
          quantity_fixed: number;
          condition_option_slug: string;
          condition_option_value: string;
          waste_percent: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          heating_system_id: string;
          name: string;
          unit?: string;
          price_per_unit?: number;
          quantity_per_m2?: number;
          quantity_per_m_perimeter?: number;
          quantity_fixed?: number;
          condition_option_slug?: string;
          condition_option_value?: string;
          waste_percent?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          unit?: string;
          price_per_unit?: number;
          quantity_per_m2?: number;
          quantity_per_m_perimeter?: number;
          quantity_fixed?: number;
          condition_option_slug?: string;
          condition_option_value?: string;
          waste_percent?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      inspirations: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string;
          content: string;
          cover_image: string;
          is_published: boolean;
          author_id: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt?: string;
          content?: string;
          cover_image?: string;
          is_published?: boolean;
          author_id?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          excerpt?: string;
          content?: string;
          cover_image?: string;
          is_published?: boolean;
          author_id?: string | null;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subcategories: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      lighting_norms: {
        Row: {
          id: string;
          room_type: string;
          required_lux: number;
          description: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_type: string;
          required_lux?: number;
          description?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          room_type?: string;
          required_lux?: number;
          description?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Category = Database['public']['Tables']['categories']['Row'];
export type Subcategory = Database['public']['Tables']['subcategories']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type DesignModule = Database['public']['Tables']['design_modules']['Row'];
export type DesignPreset = Database['public']['Tables']['design_presets']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectSelection = Database['public']['Tables']['project_selections']['Row'];
export type PinPlacement = Database['public']['Tables']['pin_placements']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProductColor = Database['public']['Tables']['product_colors']['Row'];
export type ProductImage = Database['public']['Tables']['product_images']['Row'];
export type Inspiration = Database['public']['Tables']['inspirations']['Row'];
export type Material = Database['public']['Tables']['materials']['Row'];
export type HeatingSystem = Database['public']['Tables']['heating_systems']['Row'];
export type HeatingSystemOption = Database['public']['Tables']['heating_system_options']['Row'];
export type HeatingSystemMaterial = Database['public']['Tables']['heating_system_materials']['Row'];
export type LightingNorm = Database['public']['Tables']['lighting_norms']['Row'];
export type FloorplanObject = Database['public']['Tables']['floorplan_objects']['Row'];

export interface ProductDesignModule {
  id: string;
  product_id: string;
  design_module_id: string;
  price: number;
  icon_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  note: string;
  client_type: 'rd' | 'firma' | 'obec';
  city: string;
  ico: string;
  dic: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientAddress {
  id: string;
  client_id: string;
  address_type: 'billing' | 'delivery' | 'realization';
  street: string;
  city: string;
  zip: string;
  country: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  name: string;
  url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ProjectFull extends Project {
  client_id?: string | null;
  responsible_user_id?: string | null;
  deadline?: string | null;
  address?: string;
  phase?: string;
  client?: Client | null;
  responsible?: Profile | null;
}

export type DocumentTemplateType = 'zapis_stavba' | 'predavaci_protokol' | 'servisni_protokol' | 'checklist' | 'obecny' | 'smlouva' | 'objednavka';
export type DocumentStatus = 'DRAFT' | 'FINAL' | 'SIGNED';

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  template_type: DocumentTemplateType;
  content: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  template_id: string | null;
  template_version: number | null;
  name: string;
  status: DocumentStatus;
  rendered_html: string;
  render_context: Record<string, unknown>;
  document_type: string;
  file_url: string | null;
  file_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client_signature?: string | null;
  contractor_signature?: string | null;
  signed_at?: string | null;
}
