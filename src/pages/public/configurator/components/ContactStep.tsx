import { useState } from 'react';
import { AlertCircle, MapPin } from 'lucide-react';
import type { StepProps } from '../types';
import { CZECH_REGIONS } from '../types';

export default function ContactStep({ data, setData }: StepProps) {
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true;
    const re = /^[\d\s+()-]{9,}$/;
    return re.test(phone);
  };

  const handleEmailChange = (email: string) => {
    setData({ ...data, clientEmail: email });
    if (email && !validateEmail(email)) {
      setErrors((prev) => ({ ...prev, email: 'Neplatný formát emailu' }));
    } else {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handlePhoneChange = (phone: string) => {
    setData({ ...data, clientPhone: phone });
    if (phone && !validatePhone(phone)) {
      setErrors((prev) => ({ ...prev, phone: 'Neplatný formát telefonu' }));
    } else {
      setErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in">
      <h2 className="text-2xl font-bold text-center mb-2">Kontaktní údaje</h2>
      <p className="text-center text-slate-500 mb-6">
        Po odeslání Vám zobrazíme výsledek.
      </p>

      <div className="space-y-4 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Jméno a Příjmení <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.clientName}
            onChange={(e) => setData({ ...data, clientName: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Jan Novák"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={data.clientEmail}
            onChange={(e) => handleEmailChange(e.target.value)}
            className={`w-full p-3 border rounded-lg focus:ring-2 outline-none ${
              errors.email
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:ring-blue-500'
            }`}
            placeholder="jan@novak.cz"
            required
          />
          {errors.email && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
              <AlertCircle size={12} />
              <span>{errors.email}</span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Telefon <span className="text-slate-400 text-xs">(volitelné)</span>
          </label>
          <input
            type="tel"
            value={data.clientPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={`w-full p-3 border rounded-lg focus:ring-2 outline-none ${
              errors.phone
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:ring-blue-500'
            }`}
            placeholder="+420 123 456 789"
          />
          {errors.phone && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
              <AlertCircle size={12} />
              <span>{errors.phone}</span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <MapPin size={14} />
            Kraj <span className="text-slate-400 text-xs font-normal">(kde stavíte)</span>
          </label>
          <select
            value={data.clientRegion || ''}
            onChange={(e) => setData({ ...data, clientRegion: e.target.value })}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">Vyberte kraj...</option>
            {CZECH_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-100">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 accent-blue-600"
            checked={data.gdprConsent || false}
            onChange={(e) => setData({ ...data, gdprConsent: e.target.checked })}
          />
          <p className="text-xs text-slate-500">
            Souhlasím se zpracováním osobních údajů pro účely vytvoření nabídky a kontaktování ze strany
            HouseSmart.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-800">
        <strong>Co se stane po odeslání?</strong>
        <ul className="mt-2 space-y-1 text-xs">
          <li>✓ Zobrazíme Vám detailní cenový odhad</li>
          <li>✓ Pošleme poptávku na obchod@housesmart.cz s PDF nabídkou</li>
          <li>✓ Náš obchodní zástupce Vás bude kontaktovat do 5 pracovních dnů</li>
        </ul>
      </div>
    </div>
  );
}
