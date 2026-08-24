import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Building2, MapPin, Phone, Mail, Folder } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  ico: string;
  dic: string;
  address_lat: number | null;
  address_lon: number | null;
  source?: 'client' | 'project';
}

interface Props {
  onSelect: (client: Client) => void;
  placeholder?: string;
  includeProjects?: boolean;
}

export default function ClientAutocomplete({ onSelect, placeholder, includeProjects = true }: Props) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const load = async () => {
      const [clientsRes, projectsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, email, phone, address, ico, dic')
          .eq('is_active', true)
          .order('name'),
        includeProjects ? supabase
          .from('projects')
          .select('id, project_name, client_email, client_phone, address, address_lat, address_lon, client_ico, client_dic')
          .order('project_name') : Promise.resolve({ data: [] }),
      ]);

      const clientList: Client[] = ((clientsRes.data || []) as any[]).map(c => ({
        id: c.id,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        ico: c.ico || '',
        dic: c.dic || '',
        address_lat: null,
        address_lon: null,
        source: 'client' as const,
      }));

      const projectList: Client[] = ((projectsRes.data || []) as any[]).map(p => ({
        id: `proj_${p.id}`,
        name: p.project_name || '',
        email: p.client_email || '',
        phone: p.client_phone || '',
        address: p.address || '',
        ico: p.client_ico || '',
        dic: p.client_dic || '',
        address_lat: p.address_lat ? Number(p.address_lat) : null,
        address_lon: p.address_lon ? Number(p.address_lon) : null,
        source: 'project' as const,
      }));

      setClients([...clientList, ...projectList]);
    };
    load();
  }, [includeProjects]);

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const lower = q.toLowerCase();
    const filtered = clients.filter(c =>
      c.name?.toLowerCase().includes(lower) ||
      c.email?.toLowerCase().includes(lower) ||
      c.phone?.includes(q) ||
      c.ico?.includes(q)
    );
    setSuggestions(filtered.slice(0, 10));
    setShowDropdown(filtered.length > 0);
    setHighlightIdx(-1);
  }, [clients]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 150);
  };

  const selectClient = (client: Client) => {
    onSelect(client);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        selectClient(suggestions[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        setShowDropdown(false);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => { if (query.trim()) search(query); }}
          placeholder={placeholder || 'Hledat klienta podle jmena, emailu, telefonu nebo ICO...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white/[0.06] transition"
        />
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800 rounded-xl border border-white/[0.08] shadow-xl max-h-[320px] overflow-y-auto">
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectClient(c)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition ${
                i === highlightIdx
                  ? 'bg-blue-500/10'
                  : 'hover:bg-white/[0.04]'
              } ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                c.source === 'project' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
              }`}>
                {c.source === 'project' ? (
                  <Folder className="w-5 h-5 text-emerald-400" />
                ) : c.ico ? (
                  <Building2 className="w-5 h-5 text-blue-400" />
                ) : (
                  <User className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {c.email && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Mail className="w-3 h-3" /> {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </span>
                  )}
                </div>
                {c.address && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {c.address}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.source === 'project' && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Projekt
                  </span>
                )}
                {c.ico && (
                  <span className="text-[10px] font-bold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded">
                    IČO: {c.ico}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800 rounded-xl border border-white/[0.08] shadow-xl">
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
            <Search className="w-4 h-4 text-slate-300" />
            Žádný klient nenalezen
          </div>
        </div>
      )}
    </div>
  );
}
