import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, ChevronDown, ChevronUp,
  FileText,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const initializedEditors = new WeakSet<HTMLDivElement>();

export default function QuoteNotesEditor({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [expanded, setExpanded] = useState(!!value);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!initializedEditors.has(el)) {
      el.innerHTML = value;
      initializedEditors.add(el);
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    setTimeout(() => {
      if (editorRef.current) onChangeRef.current(editorRef.current.innerHTML);
    }, 0);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) onChangeRef.current(editorRef.current.innerHTML);
  }, []);

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-extrabold text-white">Poznámky k nabídce</div>
            <div className="text-[10px] text-slate-500">Podmínky, poznámky a další informace (propíše se do PDF)</div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
            <button type="button" onClick={() => exec('bold')} title="Tučně"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => exec('italic')} title="Kurzíva"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => exec('underline')} title="Podtržené"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-white/[0.08] mx-1" />
            <button type="button" onClick={() => exec('insertUnorderedList')} title="Odrážky"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition">
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => exec('insertOrderedList')} title="Číslovaný seznam"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            style={{ minHeight: '120px' }}
            className="p-4 focus:outline-none text-sm text-slate-300 leading-relaxed
              [&_b]:text-white [&_strong]:text-white
              [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:pl-5 [&_ol]:mb-2
              [&_li]:mb-0.5
              [&_p]:mb-2"
            data-placeholder="Napište poznámky k nabídce..."
          />
        </div>
      )}
    </div>
  );
}
