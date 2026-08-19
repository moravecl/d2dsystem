import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Search, X, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    street?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    postcode?: string;
    country?: string;
  };
}

interface ClientResult {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
}

interface Props {
  value: string;
  lat?: number | null;
  lon?: number | null;
  onChange: (address: string, lat: number | null, lon: number | null, clientId?: string) => void;
  placeholder?: string;
  className?: string;
  includeClients?: boolean;
  onClientSelect?: (client: ClientResult) => void;
}

export default function AddressAutocomplete({
  value,
  lat,
  lon,
  onChange,
  placeholder,
  includeClients = false,
  onClientSelect
}: Props) {
  const [query, setQuery] = useState(value || '');
  const [addressResults, setAddressResults] = useState<NominatimResult[]>([]);
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasCoords, setHasCoords] = useState(!!(lat && lon));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value || '');
    setHasCoords(!!(lat && lon));
  }, [value, lat, lon]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchClients = useCallback(async (q: string): Promise<ClientResult[]> => {
    if (!includeClients || q.length < 2) return [];

    try {
      const escaped = q.replace(/[%_]/g, '\\$&');
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address, lat, lon')
        .or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%`)
        .limit(5);

      if (error) {
        console.error('Client search error:', error);
        return [];
      }

      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        lat: c.lat,
        lon: c.lon,
      }));
    } catch (err) {
      console.error('Client search error:', err);
      return [];
    }
  }, [includeClients]);

  const searchAddresses = async (q: string): Promise<NominatimResult[]> => {
    if (q.length < 3) return [];

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '8',
        countrycodes: 'cz,sk',
        'accept-language': 'cs',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          signal: abortRef.current.signal,
          headers: {
            'User-Agent': 'HouseSmart/1.0',
          },
        }
      );

      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        return data;
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Address search error:', err);
      }
    }
    return [];
  };

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAddressResults([]);
      setClientResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const [addresses, clients] = await Promise.all([
        searchAddresses(q),
        searchClients(q),
      ]);

      setAddressResults(addresses);
      setClientResults(clients);
      setOpen(addresses.length > 0 || clients.length > 0);
    } finally {
      setLoading(false);
    }
  }, [searchClients]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setHasCoords(false);
    onChange(val, null, null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const buildAddress = (r: NominatimResult): string => {
    const a = r.address;
    if (!a) return r.display_name;

    const parts: string[] = [];
    const street = a.road || a.street;
    const city = a.city || a.town || a.village || a.municipality;

    if (street) {
      parts.push(a.house_number ? `${street} ${a.house_number}` : street);
    } else if (a.house_number) {
      parts.push(a.house_number);
    }

    if (city) parts.push(city);
    if (a.postcode) parts.push(a.postcode);

    return parts.length > 0 ? parts.join(', ') : r.display_name;
  };

  const handleSelectAddress = (r: NominatimResult) => {
    const fullAddress = buildAddress(r);
    const latitude = parseFloat(r.lat);
    const longitude = parseFloat(r.lon);
    setQuery(fullAddress);
    setHasCoords(true);
    setOpen(false);
    setAddressResults([]);
    setClientResults([]);
    onChange(fullAddress, latitude, longitude);
  };

  const handleSelectClient = (client: ClientResult) => {
    if (onClientSelect) {
      onClientSelect(client);
    }
    const addr = client.address || client.name;
    setQuery(addr);
    setHasCoords(!!(client.lat && client.lon));
    setOpen(false);
    setAddressResults([]);
    setClientResults([]);
    onChange(addr, client.lat, client.lon, client.id);
  };

  const handleClear = () => {
    setQuery('');
    setHasCoords(false);
    setAddressResults([]);
    setClientResults([]);
    setOpen(false);
    onChange('', null, null);
  };

  const formatAddressLine = (r: NominatimResult) => {
    const a = r.address;
    let primary = '';
    let secondary = '';

    if (a) {
      const street = a.road || a.street;
      const city = a.city || a.town || a.village || a.municipality;

      if (street) {
        primary = a.house_number ? `${street} ${a.house_number}` : street;
      } else if (a.house_number) {
        primary = a.house_number;
      }

      const secondaryParts: string[] = [];
      if (a.suburb) secondaryParts.push(a.suburb);
      if (city && city !== primary) secondaryParts.push(city);
      if (a.postcode) secondaryParts.push(a.postcode);
      secondary = secondaryParts.join(', ');

      if (!primary && city) {
        primary = city;
        secondary = a.postcode || '';
      }
    }

    if (!primary) {
      const parts = r.display_name.split(',');
      primary = parts[0]?.trim() || r.display_name;
      secondary = parts.slice(1, 3).join(',').trim();
    }

    return { primary, secondary };
  };

  const hasResults = addressResults.length > 0 || clientResults.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (hasResults) setOpen(true); }}
          placeholder={placeholder || 'Zadejte adresu...'}
          className="w-full pl-9 pr-20 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          {hasCoords && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400">GPS</span>
            </span>
          )}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-slate-300 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {open && hasResults && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {clientResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-white/[0.02]">
                Klienti
              </div>
              {clientResults.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-blue-500/10 transition text-left border-b border-white/[0.04]"
                >
                  <User className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{client.name}</div>
                    {client.address && (
                      <div className="text-[11px] text-slate-400 truncate">{client.address}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {addressResults.length > 0 && (
            <>
              {clientResults.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-white/[0.02]">
                  Adresy
                </div>
              )}
              {addressResults.map((result) => {
                const { primary, secondary } = formatAddressLine(result);
                return (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => handleSelectAddress(result)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-blue-500/10 transition text-left border-b border-white/[0.04] last:border-0"
                  >
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{primary}</div>
                      {secondary && (
                        <div className="text-[11px] text-slate-400 truncate">{secondary}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          <div className="px-3 py-1.5 text-[9px] text-slate-500 bg-white/[0.02] border-t border-white/[0.06]">
            Data: OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}
