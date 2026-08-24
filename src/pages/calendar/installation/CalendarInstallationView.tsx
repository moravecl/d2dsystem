import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useInstallationData } from '../../../hooks/useInstallationData';
import { getWeekStart, dateToStr } from '../calendarTypes';
import type { InstallationJob } from '../calendarTypes';
import { useToast } from '../../../components/ui/Toast';
import InstallationSidebar from './InstallationSidebar';
import InstallationGrid from './InstallationGrid';
import InstallationInspector from './InstallationInspector';
import JobSelectorModal from './JobSelectorModal';

interface Props {
  currentDate: Date;
}

export default function CalendarInstallationView({ currentDate }: Props) {
  const weekStart = getWeekStart(currentDate);
  const { groups, jobs, unplannedJobs, loading, refresh } = useInstallationData(currentDate);
  const { toast } = useToast();

  const [selectedJob, setSelectedJob] = useState<InstallationJob | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ groupId: string; date: string } | null>(null);
  const [jobSelector, setJobSelector] = useState<{ groupId: string; date: string } | null>(null);

  const dragJobRef = useRef<InstallationJob | null>(null);
  const dragTypeRef = useRef<'existing' | 'unplanned'>('existing');

  const handleJobDragStart = useCallback((e: React.DragEvent, job: InstallationJob) => {
    dragJobRef.current = job;
    dragTypeRef.current = 'existing';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  }, []);

  const handleUnplannedDragStart = useCallback((e: React.DragEvent, job: InstallationJob) => {
    dragJobRef.current = job;
    dragTypeRef.current = 'unplanned';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  }, []);

  const handleDropOnCell = useCallback(async (e: React.DragEvent, groupId: string, dateStr: string) => {
    e.preventDefault();
    setDragOverCell(null);
    const job = dragJobRef.current;
    if (!job) return;

    const updates: Record<string, string | null> = {
      montaz_start_date: dateStr,
      resource_group_id: groupId,
      updated_at: new Date().toISOString(),
    };

    if (dragTypeRef.current === 'unplanned' || !job.end_date) {
      updates.montaz_end_date = dateStr;
    }

    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', job.project_id);

    if (error) {
      toast('Chyba při přesunu zakázky', 'error');
    } else {
      toast('Zakázka přesunuta');
      refresh();
      dragJobRef.current = null;
    }
  }, [toast, refresh]);

  const handleCellClick = useCallback((groupId: string, dateStr: string) => {
    setJobSelector({ groupId, date: dateStr });
  }, []);

  const handleJobSelectorConfirm = useCallback(async (jobId: string, groupId: string, dateStr: string) => {
    const { error } = await supabase
      .from('projects')
      .update({
        montaz_start_date: dateStr,
        montaz_end_date: dateStr,
        resource_group_id: groupId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      toast('Chyba při plánování zakázky', 'error');
    } else {
      toast('Zakázka naplánována');
      refresh();
    }
    setJobSelector(null);
  }, [toast, refresh]);

  const weekStartStr = dateToStr(weekStart);

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Načítání montážního plánu...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full overflow-hidden" style={{ minHeight: 480 }}>
        <InstallationSidebar
          groups={groups}
          jobs={jobs}
          unplannedJobs={unplannedJobs}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onUnplannedDragStart={handleUnplannedDragStart}
        />

        <InstallationGrid
          weekStart={new Date(weekStartStr + 'T00:00:00')}
          groups={groups}
          jobs={jobs}
          selectedGroupId={selectedGroupId}
          onCellClick={handleCellClick}
          onJobClick={setSelectedJob}
          onJobDragStart={handleJobDragStart}
          onDropOnCell={handleDropOnCell}
          dragOverCell={dragOverCell}
          onDragOverCell={(gId, d) => setDragOverCell({ groupId: gId, date: d })}
          onDragLeaveCell={() => setDragOverCell(null)}
        />
      </div>

      {selectedJob && (
        <InstallationInspector
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onMoveJob={() => {
            setSelectedJob(null);
            toast('Přetáhněte zakázku na nové místo v mřížce');
          }}
          onChangeTechnicians={() => {
            toast('Funkcionalita bude brzy dostupná');
          }}
        />
      )}

      {jobSelector && (
        <JobSelectorModal
          unplannedJobs={unplannedJobs}
          groupId={jobSelector.groupId}
          dateStr={jobSelector.date}
          groups={groups}
          onConfirm={handleJobSelectorConfirm}
          onClose={() => setJobSelector(null)}
        />
      )}
    </>
  );
}
