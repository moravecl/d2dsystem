import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, Loader2, Download, Trash2, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { useToast } from '../ui/Toast';
import { logAudit } from '../../lib/auditLog';
import Modal from '../ui/Modal';

interface DocRow {
  id: string;
  name: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export default function PortalDocumentsTab({ projectId }: { projectId: string }) {
  const { user } = usePortalAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('portal_documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_client_visible', true)
      .order('created_at', { ascending: false });
    setDocs((data || []) as DocRow[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);

    const fileExt = uploadFile.name.split('.').pop() || '';
    const filePath = `portal/${projectId}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(filePath, uploadFile);

    if (uploadErr) {
      toast('Chyba při nahrávání souboru', 'error');
      setUploading(false);
      return;
    }

    // bucket documents je privatni - uklada se cesta, odkaz se podepisuje
    // az pri stazeni (getPublicUrl na privatnim bucketu vraci 400)
    const { error } = await supabase.from('portal_documents').insert({
      project_id: projectId,
      name: uploadName || uploadFile.name,
      description: uploadDesc,
      file_url: filePath,
      file_type: fileExt,
      file_size: uploadFile.size,
      uploaded_by: user.id,
      is_client_visible: true,
    });

    if (error) {
      toast('Chyba při ukládání', 'error');
    } else {
      await logAudit('portal_document', projectId, 'uploaded', { name: uploadName || uploadFile.name });
      toast('Dokument nahrán');
      setShowUpload(false);
      setUploadName('');
      setUploadDesc('');
      setUploadFile(null);
      loadDocs();
    }
    setUploading(false);
  };

  const handleDownload = async (doc: DocRow) => {
    // starsi radky maji ulozene verejne URL, nove jen cestu v bucketu
    const marker = '/documents/';
    const path = doc.file_url.startsWith('http')
      ? doc.file_url.slice(doc.file_url.indexOf(marker) + marker.length)
      : doc.file_url;
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast('Soubor se nepodařilo otevřít', 'error');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm(`Smazat dokument "${doc.name}"?`)) return;
    await supabase.from('portal_documents').delete().eq('id', doc.id);
    toast('Dokument smazán');
    loadDocs();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="h-32 bg-white/[0.06] rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Dokumenty</h3>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-blue-700 transition"
        >
          <Upload className="w-4 h-4" /> Nahrát dokument
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">{`Žádné dokumenty`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-white/10 bg-white/[0.06] p-4 flex items-center gap-4 hover: transition">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <File className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white truncate">{doc.name}</p>
                {doc.description && (
                  <p className="text-xs text-slate-500 truncate">{doc.description}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatSize(doc.file_size)} &middot; {new Date(doc.created_at).toLocaleDateString('cs-CZ')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownload(doc)}
                  title="Stáhnout"
                  className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition"
                >
                  <Download className="w-4 h-4" />
                </button>
                {doc.uploaded_by === user?.id && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="Nahrát dokument"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-lg transition">
              Zrušit
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile}
              className="px-5 py-2 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Nahrát
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Soubor *</label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setUploadFile(f);
                if (f && !uploadName) setUploadName(f.name);
              }}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Název</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Popis</label>
            <textarea
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
