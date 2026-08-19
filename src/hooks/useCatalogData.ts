import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category, Subcategory, Product, DesignModule, DesignPreset, ProductColor } from '../types/database';

interface CatalogData {
  categories: Category[];
  subcategories: Subcategory[];
  products: Product[];
  designModules: DesignModule[];
  designPresets: DesignPreset[];
  productColors: ProductColor[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCatalogData(): CatalogData {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [designModules, setDesignModules] = useState<DesignModule[]>([]);
  const [designPresets, setDesignPresets] = useState<DesignPreset[]>([]);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, scRes, pRes, dmRes, dpRes, pcRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('subcategories').select('*').order('sort_order'),
        supabase.from('products').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('design_modules').select('*').order('sort_order'),
        supabase.from('design_presets').select('*').order('sort_order'),
        supabase.from('product_colors').select('*').order('sort_order'),
      ]);

      const firstError = cRes.error || scRes.error || pRes.error || dmRes.error || dpRes.error || pcRes.error;
      if (firstError) {
        setError(firstError.message);
      }

      setCategories(cRes.data ?? []);
      setSubcategories(scRes.data ?? []);
      setProducts(pRes.data ?? []);
      setDesignModules(dmRes.data ?? []);
      setDesignPresets(dpRes.data ?? []);
      setProductColors(pcRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return { categories, subcategories, products, designModules, designPresets, productColors, loading, error, reload };
}
