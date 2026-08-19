import { useState } from 'react';
import {
  Image, Maximize2, Edit3, Sun, Camera, Trash2,
  ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import type { QuoteAttachment, QuoteSystemSummary } from './quoteHelpers';

interface Props {
  attachments: QuoteAttachment[];
  summaries: QuoteSystemSummary[];
  onUpdateAttachment: (id: string, updates: Partial<QuoteAttachment>) => void;
  onRemoveAttachment: (id: string) => void;
  onUpdateSummary: (index: number, key: string, value: string | number) => void;
}

function SummaryCard({ summary, index, onUpdate }: {
  summary: QuoteSystemSummary;
  index: number;
  onUpdate: (index: number, key: string, value: string | number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const isFve = summary.type === 'fve';
  const Icon = isFve ? Sun : Camera;
  const label = isFve ? 'Fotovoltaika' : 'Kamerový systém';
  const accentColor = isFve ? 'orange' : 'sky';

  const startEdit = (key: string) => {
    setEditing(key);
    setEditValue(String(summary.data[key] ?? ''));
  };

  const commitEdit = () => {
    if (editing) {
      onUpdate(index, editing, editValue);
      setEditing(null);
    }
  };

  return (
    <div className={`rounded-xl border-2 border-${accentColor}-200 bg-gradient-to-r from-${accentColor}-50/50 to-white overflow-hidden`}
      style={{
        borderColor: isFve ? '#fed7aa' : '#bae6fd',
        background: isFve ? 'linear-gradient(to right, rgb(255 247 237 / 0.5), white)' : 'linear-gradient(to right, rgb(240 249 255 / 0.5), white)',
      }}>
      <div className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${isFve ? '#fed7aa' : '#bae6fd'}` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: isFve ? '#f97316' : '#0ea5e9' }}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-extrabold text-white">{label}</span>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(summary.data).map(([key, value]) => (
          <div key={key} className="group relative">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">{key}</div>
            {editing === key ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                className="text-sm font-extrabold text-white w-full px-1.5 py-0.5 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/[0.06]"
              />
            ) : (
              <div
                onClick={() => startEdit(key)}
                className="text-sm font-extrabold text-white cursor-pointer hover:bg-white/[0.06] rounded px-1.5 py-0.5 -mx-1.5 transition group-hover:ring-1 group-hover:ring-slate-200"
              >
                {value}
                <Edit3 className="w-2.5 h-2.5 text-slate-300 inline ml-1 opacity-0 group-hover:opacity-100 transition" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, onUpdate, onRemove }: {
  attachment: QuoteAttachment;
  onUpdate: (id: string, updates: Partial<QuoteAttachment>) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(false);
  const [annotationText, setAnnotationText] = useState(attachment.annotation || '');

  const commitAnnotation = () => {
    onUpdate(attachment.id, { annotation: annotationText });
    setEditingAnnotation(false);
  };

  const isUrl = attachment.imageData.startsWith('http') || attachment.imageData.startsWith('data:');

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.06] hover:shadow-md transition-shadow">
      <div className="relative cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {isUrl ? (
          <img
            src={attachment.imageData}
            alt={attachment.label}
            className={`w-full object-cover transition-all duration-300 ${expanded ? 'max-h-[400px]' : 'max-h-[120px]'}`}
          />
        ) : (
          <div className={`w-full flex items-center justify-center bg-white/[0.06] ${expanded ? 'h-48' : 'h-20'}`}>
            <Image className="w-8 h-8 text-slate-300" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-6 h-6 rounded-lg bg-white/[0.06] backdrop-blur-sm flex items-center justify-center  hover:bg-white/[0.06] transition"
          >
            <Maximize2 className="w-3 h-3 text-slate-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(attachment.id); }}
            className="w-6 h-6 rounded-lg bg-white/[0.06] backdrop-blur-sm flex items-center justify-center  hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
          </button>
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <span className="text-[10px] font-extrabold text-white">{attachment.label}</span>
        </div>
      </div>

      <div className="p-2">
        {editingAnnotation ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitAnnotation()}
              className="flex-1 text-[10px] px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Poznámka k náhledu..."
            />
            <button onClick={commitAnnotation}
              className="text-[10px] font-extrabold text-blue-400 hover:text-blue-800 px-2 py-1">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingAnnotation(true)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-400 transition"
          >
            <MessageSquare className="w-2.5 h-2.5" />
            {attachment.annotation || 'Přidat poznámku...'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function QuoteAttachmentsPanel({
  attachments, summaries, onUpdateAttachment, onRemoveAttachment, onUpdateSummary,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (attachments.length === 0 && summaries.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border-2 border-white/10 bg-gradient-to-r from-slate-50/50 to-white overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
            <Image className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-extrabold text-white">Náhledy a souhrn systémů</div>
            <div className="text-[10px] text-slate-500">
              {attachments.length > 0 && `${attachments.length} náhledů`}
              {attachments.length > 0 && summaries.length > 0 && ' | '}
              {summaries.length > 0 && `${summaries.length} systémů`}
            </div>
          </div>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {summaries.length > 0 && (
            <div className="space-y-2">
              {summaries.map((summary, idx) => (
                <SummaryCard key={idx} summary={summary} index={idx} onUpdate={onUpdateSummary} />
              ))}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {attachments.map((att) => (
                <AttachmentCard
                  key={att.id}
                  attachment={att}
                  onUpdate={onUpdateAttachment}
                  onRemove={onRemoveAttachment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
