import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, User, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Suggestion {
  email: string;
  name: string;
  source: 'client' | 'contact';
  clientName?: string;
}

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}

export default function RecipientAutocomplete({ emails, onChange, placeholder }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const load = async () => {
      const [clientsRes, contactsRes] = await Promise.all([
        supabase.from('clients').select('name, email').neq('email', '').order('name'),
        supabase.from('client_contacts').select('name, email, client_id, clients!inner(name)').neq('email', '').order('name'),
      ]);

      const items: Suggestion[] = [];

      (clientsRes.data || []).forEach((c: { name: string; email: string }) => {
        if (c.email) {
          items.push({ email: c.email, name: c.name, source: 'client' });
        }
      });

      (contactsRes.data || []).forEach((c: { name: string; email: string; clients: { name: string } | { name: string }[] }) => {
        if (c.email) {
          const clientObj = Array.isArray(c.clients) ? c.clients[0] : c.clients;
          items.push({
            email: c.email,
            name: c.name,
            source: 'contact',
            clientName: clientObj?.name,
          });
        }
      });

      setAllSuggestions(items);
    };
    load();
  }, []);

  const search = useCallback((query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const q = query.toLowerCase();
    const filtered = allSuggestions.filter(
      s =>
        !emails.includes(s.email) &&
        (s.name.toLowerCase().includes(q) ||
         s.email.toLowerCase().includes(q) ||
         (s.clientName && s.clientName.toLowerCase().includes(q)))
    );
    setSuggestions(filtered.slice(0, 10));
    setShowDropdown(filtered.length > 0);
    setHighlightIdx(-1);
  }, [allSuggestions, emails]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 150);
  };

  const addEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || emails.includes(trimmed)) return;
    onChange([...emails, trimmed]);
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    addEmail(suggestion.email);
    setInput('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeEmail = (index: number) => {
    onChange(emails.filter((_, i) => i !== index));
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
        selectSuggestion(suggestions[highlightIdx]);
      } else if (input.includes('@')) {
        addEmail(input);
        setInput('');
        setShowDropdown(false);
      }
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (input.includes('@')) {
        addEmail(input);
        setInput('');
        setShowDropdown(false);
      }
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      removeEmail(emails.length - 1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!wrapperRef.current?.contains(document.activeElement)) {
        if (input.includes('@')) {
          addEmail(input);
          setInput('');
        }
        setShowDropdown(false);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 p-2 border border-white/10 rounded-xl min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition bg-white/[0.06] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            {email}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeEmail(i); }}
              className="text-blue-400 hover:text-blue-400 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[180px]">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => { if (input.trim()) search(input); }}
            placeholder={emails.length === 0 ? (placeholder || 'Zadejte jmeno nebo email...') : ''}
            className="w-full px-1 py-1 text-sm outline-none bg-transparent"
          />
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg max-h-[240px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.email}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition ${
                i === highlightIdx
                  ? 'bg-blue-500/10'
                  : 'hover:bg-white/[0.04]'
              } ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                s.source === 'client' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-50 text-sky-600'
              }`}>
                {s.source === 'client' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                <div className="text-xs text-slate-500 truncate">{s.email}</div>
              </div>
              {s.clientName && s.source === 'contact' && (
                <span className="text-[10px] font-medium text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full shrink-0 truncate max-w-[120px]">
                  {s.clientName}
                </span>
              )}
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                s.source === 'client'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-sky-50 text-sky-600'
              }`}>
                {s.source === 'client' ? 'Klient' : 'Kontakt'}
              </span>
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && input.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-navy-800/60 rounded-xl border border-white/[0.08] shadow-lg">
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
            <Search className="w-4 h-4 text-slate-300" />
            Zadna shoda - stisknete Enter pro pridani rucne
          </div>
        </div>
      )}
    </div>
  );
}
