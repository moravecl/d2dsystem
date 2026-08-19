import { useRef, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Heading2, Heading3,
  List, ListOrdered, Image as ImageIcon, Link as LinkIcon,
  Quote, Minus, Type,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  minHeight?: string;
}

const initializedEditors = new WeakSet<HTMLDivElement>();
const lastExternalValue = new WeakMap<HTMLDivElement, string>();

function ToolbarBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export default function RichTextEditor({ value, onChange, minHeight = '400px' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!initializedEditors.has(el)) {
      el.innerHTML = value;
      lastExternalValue.set(el, value);
      initializedEditors.add(el);
    } else if (value !== lastExternalValue.get(el) && value !== el.innerHTML) {
      el.innerHTML = value;
      lastExternalValue.set(el, value);
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
    const el = editorRef.current;
    if (el) {
      lastExternalValue.set(el, el.innerHTML);
      onChangeRef.current(el.innerHTML);
    }
  }, []);

  const insertImage = useCallback(() => {
    const url = prompt('URL obrázku:');
    if (url) {
      exec('insertHTML', `<img src="${url}" alt="" style="max-width:100%;border-radius:12px;margin:12px 0" />`);
    }
  }, [exec]);

  const insertLink = useCallback(() => {
    const url = prompt('URL odkazu:');
    if (url) exec('createLink', url);
  }, [exec]);

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.06]">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-white/[0.06] bg-white/[0.04]">
        <ToolbarBtn icon={Bold} title="Tucne" onClick={() => exec('bold')} />
        <ToolbarBtn icon={Italic} title="Kurziva" onClick={() => exec('italic')} />
        <ToolbarBtn icon={Underline} title="Podtrzene" onClick={() => exec('underline')} />
        <div className="w-px h-6 bg-white/[0.08] mx-1" />
        <ToolbarBtn icon={Type} title="Odstavec" onClick={() => exec('formatBlock', 'p')} />
        <ToolbarBtn icon={Heading2} title="Nadpis 2" onClick={() => exec('formatBlock', 'h2')} />
        <ToolbarBtn icon={Heading3} title="Nadpis 3" onClick={() => exec('formatBlock', 'h3')} />
        <div className="w-px h-6 bg-white/[0.08] mx-1" />
        <ToolbarBtn icon={List} title="Odrazy" onClick={() => exec('insertUnorderedList')} />
        <ToolbarBtn icon={ListOrdered} title="Číslovaný seznam" onClick={() => exec('insertOrderedList')} />
        <ToolbarBtn icon={Quote} title="Citace" onClick={() => exec('formatBlock', 'blockquote')} />
        <div className="w-px h-6 bg-white/[0.08] mx-1" />
        <ToolbarBtn icon={ImageIcon} title="Vložit obrázek" onClick={insertImage} />
        <ToolbarBtn icon={LinkIcon} title="Vložit odkaz" onClick={insertLink} />
        <ToolbarBtn icon={Minus} title="Oddělovač" onClick={() => exec('insertHTML', '<hr/>')} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{ minHeight }}
        className="p-5 focus:outline-none prose prose-slate max-w-none
          [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-3
          [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:text-white [&_h3]:mt-5 [&_h3]:mb-2
          [&_p]:text-slate-400 [&_p]:leading-relaxed [&_p]:mb-3
          [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:pl-6 [&_ol]:mb-3
          [&_li]:text-slate-400 [&_li]:mb-1
          [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500 [&_blockquote]:my-4
          [&_a]:text-blue-400 [&_a]:underline
          [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-4
          [&_hr]:border-white/10 [&_hr]:my-6"
      />
    </div>
  );
}
