import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  CashflowItem,
  MonthRow,
  SalesInvoice,
  CashflowManualEntry,
  VatRefund,
  CashflowSettings,
} from '../types/cashflow';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function firstOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

export function useCashflowData() {
  const [items, setItems] = useState<CashflowItem[]>([]);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [settings, setSettings] = useState<CashflowSettings | null>(null);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [manualEntries, setManualEntries] = useState<CashflowManualEntry[]>([]);
  const [vatRefunds, setVatRefunds] = useState<VatRefund[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [
      projRes,
      budgetsRes,
      approvedQuotesRes,
      allocRes,
      salesRes,
      purchaseRes,
      fixedRes,
      manualRes,
      vatRes,
      settingsRes,
      cashTxRes,
      bankTxRes,
    ] = await Promise.all([
      supabase.from('projects').select('id, project_name, deadline'),
      supabase.from('project_budgets').select('*').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('project_quotes').select('id, project_id, total_selling, status').eq('status', 'approved'),
      supabase.from('invoice_project_allocations').select('*'),
      supabase.from('sales_invoices').select('*').neq('status', 'canceled').order('due_date', { ascending: true }),
      supabase.from('received_invoices').select('id, supplier_name, due_date, paid_date, total_amount, status').neq('status', 'draft'),
      supabase.from('fixed_costs').select('*').eq('is_active', true),
      supabase.from('cashflow_manual_entries').select('*').order('date', { ascending: true }),
      supabase.from('vat_refunds').select('*').order('date', { ascending: true }),
      supabase.from('cashflow_settings').select('*').maybeSingle(),
      supabase.from('cash_transactions').select('transaction_type, amount'),
      supabase.from('bank_transactions').select('type, amount').eq('status', 'matched'),
    ]);

    const projects: { id: string; project_name: string; deadline?: string }[] = projRes.data || [];
    const budgets: { id: string; project_id: string; total_gross: number; status: string; created_at: string }[] = budgetsRes.data || [];
    const approvedQuotes: { id: string; project_id: string; total_selling: number }[] = (approvedQuotesRes.data || []) as { id: string; project_id: string; total_selling: number }[];
    const allocations: { sales_invoice_id: string; project_id: string; allocated_amount_gross: number }[] = allocRes.data || [];
    const sInvoices: SalesInvoice[] = (salesRes.data || []) as SalesInvoice[];
    const pInvoices: { id: string; supplier_name: string; due_date: string; paid_date?: string; total_amount: number; status: string }[] = purchaseRes.data || [];
    const fixedCosts: { id: string; name: string; amount: number; interval_type: string; interval_day?: number; start_date: string; end_date?: string }[] = fixedRes.data || [];
    const manual: CashflowManualEntry[] = (manualRes.data || []) as CashflowManualEntry[];
    const vat: VatRefund[] = (vatRes.data || []) as VatRefund[];
    const cashTxs: { transaction_type: string; amount: number }[] = cashTxRes.data || [];
    const bankTxs: { type: string; amount: number }[] = bankTxRes.data || [];

    const computedCashBalance = cashTxs.reduce((sum, tx) => {
      return sum + (tx.transaction_type === 'income' ? Number(tx.amount) : -Number(tx.amount));
    }, 0);
    setCashBalance(computedCashBalance);

    const computedBankBalance = bankTxs.reduce((sum, tx) => {
      return sum + (tx.type === 'credit' ? Number(tx.amount) : -Number(tx.amount));
    }, 0);
    setBankBalance(computedBankBalance);

    setSalesInvoices(sInvoices.map(inv => {
      const allocated = allocations
        .filter(a => a.sales_invoice_id === inv.id)
        .reduce((s, a) => s + Number(a.allocated_amount_gross), 0);
      return { ...inv, allocated_amount: allocated };
    }));
    setManualEntries(manual);
    setVatRefunds(vat);
    setSettings(settingsRes.data ? (settingsRes.data as CashflowSettings) : null);

    const allItems: CashflowItem[] = [];

    const latestApprovedBudget = new Map<string, number>();
    budgets.forEach(b => {
      if (!latestApprovedBudget.has(b.project_id)) {
        latestApprovedBudget.set(b.project_id, Number(b.total_gross));
      }
    });

    approvedQuotes.forEach(q => {
      if (!latestApprovedBudget.has(q.project_id) && Number(q.total_selling) > 0) {
        latestApprovedBudget.set(q.project_id, Number(q.total_selling));
      }
    });

    const projectAllocated = new Map<string, number>();
    allocations.forEach(a => {
      const inv = sInvoices.find(i => i.id === a.sales_invoice_id);
      if (!inv || inv.status === 'canceled') return;
      const cur = projectAllocated.get(a.project_id) || 0;
      projectAllocated.set(a.project_id, cur + Number(a.allocated_amount_gross));
    });

    projects.forEach(p => {
      const budgetGross = latestApprovedBudget.get(p.id);
      if (!budgetGross) return;
      const invoiced = projectAllocated.get(p.id) || 0;
      const remaining = Math.max(budgetGross - invoiced, 0);
      if (remaining <= 0) return;
      const endDate = p.deadline;
      if (!endDate) return;
      allItems.push({
        id: `forecast_${p.id}`,
        date: endDate,
        type: 'inflow',
        source: 'project_forecast',
        project_id: p.id,
        project_name: p.project_name,
        title: p.project_name,
        amount_gross: remaining,
        status: 'forecast',
        source_ref_id: p.id,
        budget_approved: budgetGross,
        invoiced_allocated: invoiced,
        remaining_forecast: remaining,
      });
    });

    sInvoices.forEach(inv => {
      const dateStr = inv.status === 'paid' && inv.paid_date ? inv.paid_date : inv.due_date;
      allItems.push({
        id: `sales_${inv.id}`,
        date: dateStr,
        type: 'inflow',
        source: 'sales_invoice',
        project_id: inv.project_id,
        title: `${inv.invoice_number || 'Faktura'} – ${inv.customer_name}`,
        amount_gross: Number(inv.amount_gross),
        status: inv.status,
        source_ref_id: inv.id,
      });
    });

    pInvoices.forEach(inv => {
      const dateStr = inv.status === 'paid' && inv.paid_date ? inv.paid_date : inv.due_date;
      if (!dateStr) return;
      allItems.push({
        id: `purchase_${inv.id}`,
        date: dateStr,
        type: 'outflow',
        source: 'purchase_invoice',
        title: inv.supplier_name,
        amount_gross: Number(inv.total_amount),
        status: inv.status,
        source_ref_id: inv.id,
      });
    });

    const now = new Date();
    const futureMonths = 13;
    fixedCosts.forEach(fc => {
      const startDate = new Date(fc.start_date);
      const endDate = fc.end_date ? new Date(fc.end_date) : null;
      const intervalDay = fc.interval_day || 1;
      const generateUpTo = new Date(now.getFullYear(), now.getMonth() + futureMonths, 0);

      const generateOccurrences = (start: Date, end: Date | null, upto: Date): Date[] => {
        const result: Date[] = [];
        if (fc.interval_type === 'one_time') {
          if (start <= upto && (!end || start <= end)) result.push(start);
          return result;
        }
        let cur = new Date(start.getFullYear(), start.getMonth(), Math.min(intervalDay, 28));
        if (cur < start) cur = new Date(cur.getFullYear(), cur.getMonth() + 1, Math.min(intervalDay, 28));
        while (cur <= upto) {
          if (!end || cur <= end) result.push(new Date(cur));
          if (fc.interval_type === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, Math.min(intervalDay, 28));
          else if (fc.interval_type === 'quarterly') cur = new Date(cur.getFullYear(), cur.getMonth() + 3, Math.min(intervalDay, 28));
          else if (fc.interval_type === 'yearly') cur = new Date(cur.getFullYear() + 1, cur.getMonth(), Math.min(intervalDay, 28));
          else if (fc.interval_type === 'weekly') cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
          else break;
        }
        return result;
      };

      const occurrences = generateOccurrences(startDate, endDate, generateUpTo);
      occurrences.forEach((date, idx) => {
        allItems.push({
          id: `recurring_${fc.id}_${idx}`,
          date: date.toISOString().slice(0, 10),
          type: 'outflow',
          source: 'recurring',
          title: fc.name,
          amount_gross: Number(fc.amount),
          status: 'scheduled',
          source_ref_id: fc.id,
        });
      });
    });

    manual.forEach(m => {
      allItems.push({
        id: `manual_${m.id}`,
        date: m.date,
        type: (m.type === 'in' || m.type === 'inflow') ? 'inflow' : 'outflow',
        source: 'manual',
        project_id: m.project_id,
        title: m.title,
        amount_gross: Number(m.amount_gross),
        status: 'manual',
        source_ref_id: m.id,
      });
    });

    vat.forEach(v => {
      allItems.push({
        id: `vat_${v.id}`,
        date: v.date,
        type: 'inflow',
        source: 'vat_refund',
        title: v.note ? `Vratka DPH – ${v.note}` : 'Vratka DPH',
        amount_gross: Number(v.amount_gross),
        status: 'manual',
        source_ref_id: v.id,
      });
    });

    allItems.sort((a, b) => a.date.localeCompare(b.date));
    setItems(allItems);

    const earliest = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const latest = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    const monthMap = new Map<string, CashflowItem[]>();

    let cur = new Date(earliest);
    while (cur <= latest) {
      monthMap.set(monthKey(cur), []);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    allItems.forEach(item => {
      const d = new Date(item.date);
      const key = monthKey(d);
      if (monthMap.has(key)) {
        monthMap.get(key)!.push(item);
      }
    });

    const monthRows: MonthRow[] = [];
    const bankCorrection = settingsRes.data ? Number((settingsRes.data as CashflowSettings).bank_balance_correction) || 0 : 0;
    let cumulative = bankCorrection + computedCashBalance;
    const keys = Array.from(monthMap.keys()).sort();
    keys.forEach(key => {
      const [yr, mo] = key.split('-').map(Number);
      const d = firstOfMonth(yr, mo - 1);
      const its = monthMap.get(key)!;
      const inflow = its.filter(i => i.type === 'inflow').reduce((s, i) => s + i.amount_gross, 0);
      const outflow = its.filter(i => i.type === 'outflow').reduce((s, i) => s + i.amount_gross, 0);
      const net = inflow - outflow;
      cumulative += net;
      monthRows.push({
        key,
        label: d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' }),
        year: yr,
        month: mo - 1,
        inflow,
        outflow,
        net,
        cumulative,
        items: its,
      });
    });

    setMonths(monthRows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, months, settings, salesInvoices, manualEntries, vatRefunds, cashBalance, bankBalance, loading, reload: load };
}
