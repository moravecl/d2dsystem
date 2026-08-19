import { useEffect } from 'react';
import { useHeader } from '../../contexts/HeaderContext';
import FixedCostsTab from '../../components/financial/FixedCostsTab';

export default function FixedCostsPage() {
  const { setConfig } = useHeader();

  useEffect(() => {
    setConfig({
      breadcrumbs: [
        { label: 'Finance', href: '/finance' },
        { label: 'Stálé náklady' },
      ],
    });
    return () => setConfig({ breadcrumbs: [] });
  }, [setConfig]);

  return <FixedCostsTab />;
}
