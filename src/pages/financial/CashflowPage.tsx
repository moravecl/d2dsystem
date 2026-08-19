import { useEffect } from 'react';
import { useHeader } from '../../contexts/HeaderContext';
import CashflowTab from '../../components/cashflow/CashflowTab';

export default function CashflowPage() {
  const { setConfig } = useHeader();

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Cashflow' },
      ],
    });
    return () => setConfig({ breadcrumbs: [] });
  }, [setConfig]);

  return <CashflowTab />;
}
