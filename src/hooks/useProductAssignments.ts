import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductAssignment, AssignmentRule } from '../types/designElements';
import {
  resolveAssignmentForElement,
  resolveAllAssignments,
  computeAssignmentStats,
  type ResolvedAssignment,
  type ProjectDesignElementMin,
  type ProjectAssignmentStats,
} from '../lib/assignmentResolver';

export function useProductAssignments(projectId: string | undefined) {
  const [assignments, setAssignments] = useState<ProductAssignment[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productKindMap, setProductKindMap] = useState<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setAssignments([]);
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [assignmentsRes, rulesRes] = await Promise.all([
      supabase
        .from('product_assignments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at'),
      supabase
        .from('assignment_rules')
        .select('*')
        .eq('project_id', projectId)
        .order('priority', { ascending: false }),
    ]);

    if (assignmentsRes.error) {
      setError(assignmentsRes.error.message);
    } else {
      const assignmentData = (assignmentsRes.data as ProductAssignment[]) || [];
      setAssignments(assignmentData);

      const productIds = [...new Set(assignmentData.map(a => a.product_id).filter(Boolean))] as string[];
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, kind')
          .in('id', productIds);

        const kindMap = new Map<string, string>();
        for (const p of (products || [])) {
          if (p.kind) kindMap.set(p.id, p.kind);
        }
        setProductKindMap(kindMap);
      }
    }

    if (rulesRes.error) {
      setError((prev) => (prev ? `${prev}; ${rulesRes.error.message}` : rulesRes.error.message));
    } else {
      setRules((rulesRes.data as AssignmentRule[]) || []);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assignProduct = useCallback(
    async (params: {
      scope: 'project' | 'room' | 'element';
      scopeRefId: string | null;
      elementTypeId: string | null;
      productId: string;
      assignmentType?: 'manual' | 'auto' | 'inherited';
      quantityOverride?: number | null;
      notes?: string | null;
    }) => {
      if (!projectId) return { error: 'No project ID' };

      const existing = assignments.find(
        (a) =>
          a.scope === params.scope &&
          a.scope_ref_id === params.scopeRefId &&
          a.element_type_id === params.elementTypeId
      );

      if (existing) {
        const { data, error: err } = await supabase
          .from('product_assignments')
          .update({
            product_id: params.productId,
            assignment_type: params.assignmentType ?? 'manual',
            quantity_override: params.quantityOverride ?? null,
            notes: params.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (err) return { error: err.message };
        setAssignments((prev) =>
          prev.map((a) => (a.id === existing.id ? (data as ProductAssignment) : a))
        );

        const { data: productData } = await supabase
          .from('products')
          .select('id, kind')
          .eq('id', params.productId)
          .maybeSingle();
        if (productData?.kind) {
          setProductKindMap((prev) => {
            const next = new Map(prev);
            next.set(params.productId, productData.kind);
            return next;
          });
        }

        return { data: data as ProductAssignment, error: null };
      }

      const { data, error: err } = await supabase
        .from('product_assignments')
        .insert({
          project_id: projectId,
          scope: params.scope,
          scope_ref_id: params.scopeRefId,
          element_type_id: params.elementTypeId,
          product_id: params.productId,
          assignment_type: params.assignmentType ?? 'manual',
          quantity_override: params.quantityOverride ?? null,
          notes: params.notes ?? null,
        })
        .select()
        .single();

      if (err) return { error: err.message };
      setAssignments((prev) => [...prev, data as ProductAssignment]);

      const { data: productData } = await supabase
        .from('products')
        .select('id, kind')
        .eq('id', params.productId)
        .maybeSingle();
      if (productData?.kind) {
        setProductKindMap((prev) => {
          const next = new Map(prev);
          next.set(params.productId, productData.kind);
          return next;
        });
      }

      return { data: data as ProductAssignment, error: null };
    },
    [projectId, assignments]
  );

  const removeAssignment = useCallback(async (assignmentId: string) => {
    const { error: err } = await supabase
      .from('product_assignments')
      .delete()
      .eq('id', assignmentId);

    if (err) return { error: err.message };
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    return { error: null };
  }, []);

  const addRule = useCallback(
    async (params: {
      scope: 'project' | 'room';
      scopeRefId: string | null;
      elementTypeId: string | null;
      productId: string;
      priority?: number;
    }) => {
      if (!projectId) return { error: 'No project ID' };

      const { data, error: err } = await supabase
        .from('assignment_rules')
        .insert({
          project_id: projectId,
          scope: params.scope,
          scope_ref_id: params.scopeRefId,
          element_type_id: params.elementTypeId,
          product_id: params.productId,
          priority: params.priority ?? 0,
        })
        .select()
        .single();

      if (err) return { error: err.message };
      setRules((prev) => [...prev, data as AssignmentRule]);
      return { data: data as AssignmentRule, error: null };
    },
    [projectId]
  );

  const removeRule = useCallback(async (ruleId: string) => {
    const { error: err } = await supabase
      .from('assignment_rules')
      .delete()
      .eq('id', ruleId);

    if (err) return { error: err.message };
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    return { error: null };
  }, []);

  const resolveForElement = useCallback(
    (elementId: string, elementTypeId: string, roomId: string | null): ResolvedAssignment => {
      return resolveAssignmentForElement({
        elementId,
        elementTypeId,
        roomId,
        assignments,
        productKindMap,
      });
    },
    [assignments, productKindMap]
  );

  const getProductIdForElement = useCallback(
    (elementId: string, elementTypeId: string, roomId: string | null): string | null => {
      const resolved = resolveForElement(elementId, elementTypeId, roomId);
      return resolved.effectiveProductId;
    },
    [resolveForElement]
  );

  const resolveAll = useCallback(
    (elements: ProjectDesignElementMin[]): Map<string, ResolvedAssignment> => {
      return resolveAllAssignments(elements, assignments, productKindMap);
    },
    [assignments, productKindMap]
  );

  const computeStats = useCallback(
    (elements: ProjectDesignElementMin[]): ProjectAssignmentStats => {
      const resolutions = resolveAll(elements);
      return computeAssignmentStats(resolutions);
    },
    [resolveAll]
  );

  const getAssignmentForElement = useCallback(
    (elementId: string, elementTypeId: string, roomId: string | null) => {
      const resolved = resolveForElement(elementId, elementTypeId, roomId);
      return resolved.matchedAssignment;
    },
    [resolveForElement]
  );

  return {
    assignments,
    rules,
    loading,
    error,
    productKindMap,
    refetch: fetchData,
    assignProduct,
    removeAssignment,
    addRule,
    removeRule,
    resolveForElement,
    getProductIdForElement,
    getAssignmentForElement,
    resolveAll,
    computeStats,
  };
}
