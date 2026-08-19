import { useEffect, useState, useRef, useCallback } from 'react';
import { StickyNote, Plus, Trash2, Loader2, Palette, GripVertical } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Note {
  id: string;
  content: string;
  color: string;
  position: number;
}

const NOTE_COLORS: { key: string; bg: string; border: string; text: string; label: string }[] = [
  { key: 'yellow', bg: 'bg-amber-400/15', border: 'border-amber-400/30', text: 'text-amber-100', label: 'Žlutá' },
  { key: 'blue', bg: 'bg-sky-400/15', border: 'border-sky-400/30', text: 'text-sky-100', label: 'Modrá' },
  { key: 'green', bg: 'bg-emerald-400/15', border: 'border-emerald-400/30', text: 'text-emerald-100', label: 'Zelená' },
  { key: 'pink', bg: 'bg-rose-400/15', border: 'border-rose-400/30', text: 'text-rose-100', label: 'Růžová' },
  { key: 'orange', bg: 'bg-orange-400/15', border: 'border-orange-400/30', text: 'text-orange-100', label: 'Oranžová' },
  { key: 'teal', bg: 'bg-teal-400/15', border: 'border-teal-400/30', text: 'text-teal-100', label: 'Tyrkysová' },
];

const getColorConfig = (key: string) => NOTE_COLORS.find(c => c.key === key) || NOTE_COLORS[0];

const HEADER_COLORS: Record<string, string> = {
  yellow: 'bg-amber-500/30',
  blue: 'bg-sky-500/30',
  green: 'bg-emerald-500/30',
  pink: 'bg-rose-500/30',
  orange: 'bg-orange-500/30',
  teal: 'bg-teal-500/30',
};

interface Props {
  editMode: boolean;
}

export default function StickyNotesWidget({ editMode }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sticky_notes')
      .select('id, content, color, position')
      .eq('user_id', user.id)
      .order('position')
      .order('created_at');
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerNoteId(null);
      }
    };
    if (colorPickerNoteId) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colorPickerNoteId]);

  const handleAdd = async () => {
    if (!user || adding) return;
    setAdding(true);
    const maxPos = notes.length > 0 ? Math.max(...notes.map(n => n.position)) + 1 : 0;
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({ user_id: user.id, content: '', color: 'yellow', position: maxPos })
      .select('id, content, color, position')
      .maybeSingle();
    if (!error && data) {
      setNotes(prev => [...prev, data as Note]);
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from('sticky_notes').delete().eq('id', id);
  };

  const handleContentChange = (id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(id, setTimeout(async () => {
      await supabase.from('sticky_notes').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
      saveTimers.current.delete(id);
    }, 500));
  };

  const handleColorChange = async (id: string, color: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
    setColorPickerNoteId(null);
    await supabase.from('sticky_notes').update({ color, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDragEnd = async () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const arr = [...notes];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(overIdx, 0, moved);
      const reordered = arr.map((n, i) => ({ ...n, position: i }));
      setNotes(reordered);
      for (const n of reordered) {
        await supabase.from('sticky_notes').update({ position: n.position }).eq('id', n.id);
      }
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className={`glass-card overflow-hidden ${editMode ? 'ring-2 ring-blue-400/30 ring-offset-2 ring-offset-navy-950' : ''}`}>
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-400" />
          Lístečky
        </h2>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/25 rounded-lg hover:bg-amber-500/25 transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Nový lístek
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="px-5 py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <StickyNote className="w-6 h-6 text-amber-400/60" />
          </div>
          <p className="text-sm text-slate-500">Žádné lístečky</p>
          <p className="text-xs text-slate-600">Přidejte si poznámku, kterou chcete mít na očích</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {notes.map((note, idx) => {
            const cc = getColorConfig(note.color);
            const isDragging = dragIdx === idx;
            const isOver = overIdx === idx && dragIdx !== idx;

            return (
              <div
                key={note.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`
                  group relative rounded-xl border transition-all duration-200
                  ${cc.bg} ${cc.border}
                  ${isDragging ? 'opacity-40 scale-95' : ''}
                  ${isOver ? 'ring-2 ring-white/30' : ''}
                `}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${HEADER_COLORS[note.color] || 'bg-white/[0.06]'}`}>
                  <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                      {cc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setColorPickerNoteId(colorPickerNoteId === note.id ? null : note.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                      {colorPickerNoteId === note.id && (
                        <div
                          ref={colorPickerRef}
                          className="absolute right-0 top-full mt-1 z-50 flex gap-1.5 p-2 bg-navy-800/95 backdrop-blur-xl rounded-lg border border-white/10 shadow-xl"
                        >
                          {NOTE_COLORS.map(c => (
                            <button
                              key={c.key}
                              onClick={() => handleColorChange(note.id, c.key)}
                              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${c.bg} ${
                                note.color === c.key ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              title={c.label}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={note.content}
                  onChange={e => handleContentChange(note.id, e.target.value)}
                  placeholder="Napište poznámku..."
                  rows={4}
                  className={`
                    w-full bg-transparent resize-none px-3 py-2.5 text-sm leading-relaxed
                    placeholder:text-white/25 focus:outline-none
                    ${cc.text}
                  `}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
