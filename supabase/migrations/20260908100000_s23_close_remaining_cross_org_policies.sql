/*
  # S23: Dotěsnění zbylých cross-org policies (podle diagnostiky z S22)

  ## Úniky ČTENÍ
  - project_documents: SELECT/INSERT "každý přihlášený" → dokumenty projektů
    čitelné a zakládatelné napříč organizacemi; UPDATE/DELETE pro globální
    admin roli.
  - service_work_items: všechny 4 policies "auth.uid() IS NOT NULL".
  - viceprace_items: SELECT/UPDATE jen ověřoval existenci rodiče (JOIN bez
    podmínky) → čitelné/upravitelné napříč organizacemi.
  - email_log: SELECT/UPDATE pro globální admin roli → admin kterékoli
    organizace četl cizí odeslanou poštu.
  - attendance (legacy tabulka): "admin/manager vidí vše" globálně.

  ## Úniky ZÁPISU (globální role bez org kontextu)
  - heating_system_options/materials, product_design_modules: globální
    admin mohl upravovat katalog cizí organizace.
  - jobs, job_worklogs, job_material_entries, job_diary_entries,
    job_diary_photos: is_admin_or_manager() je globální role → zápis do
    cizích zakázek.
  - installed_devices, project_photos, project_defects: INSERT bez kontroly
    organizace projektu.

  Vzor: každé právo se váže na current_org_id() (přímo, nebo přes rodiče),
  role se ověřuje až UVNITŘ organizace (is_full_admin, is_admin_or_manager).
*/

-- ============================================================ project_documents
DROP POLICY IF EXISTS "Authenticated users can view project documents" ON project_documents;
DROP POLICY IF EXISTS "Authenticated users can insert project documents" ON project_documents;
DROP POLICY IF EXISTS "Admins can update any project document" ON project_documents;
DROP POLICY IF EXISTS "Admins can delete any draft document" ON project_documents;

CREATE POLICY "Org members can view project documents"
  ON project_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p
                 WHERE p.id = project_documents.project_id
                   AND p.organization_id = current_org_id()));

CREATE POLICY "Org members can insert project documents"
  ON project_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects p
                      WHERE p.id = project_documents.project_id
                        AND p.organization_id = current_org_id()));

CREATE POLICY "Org admins can update any project document"
  ON project_documents FOR UPDATE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM projects p
         WHERE p.id = project_documents.project_id
           AND p.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p
              WHERE p.id = project_documents.project_id
                AND p.organization_id = current_org_id()));

CREATE POLICY "Org admins can delete any draft document"
  ON project_documents FOR DELETE TO authenticated
  USING (status = 'DRAFT' AND is_full_admin()
         AND EXISTS (SELECT 1 FROM projects p
             WHERE p.id = project_documents.project_id
               AND p.organization_id = current_org_id()));

-- ============================================================ service_work_items
DROP POLICY IF EXISTS "Authenticated users can read service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can insert service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can update service work items" ON service_work_items;
DROP POLICY IF EXISTS "Authenticated users can delete service work items" ON service_work_items;

CREATE POLICY "Org members can read service work items"
  ON service_work_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM service_protocols sp JOIN projects p ON p.id = sp.project_id
                 WHERE sp.id = service_work_items.protocol_id
                   AND p.organization_id = current_org_id()));
CREATE POLICY "Org members can insert service work items"
  ON service_work_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM service_protocols sp JOIN projects p ON p.id = sp.project_id
                      WHERE sp.id = service_work_items.protocol_id
                        AND p.organization_id = current_org_id()));
CREATE POLICY "Org members can update service work items"
  ON service_work_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM service_protocols sp JOIN projects p ON p.id = sp.project_id
                 WHERE sp.id = service_work_items.protocol_id
                   AND p.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM service_protocols sp JOIN projects p ON p.id = sp.project_id
                      WHERE sp.id = service_work_items.protocol_id
                        AND p.organization_id = current_org_id()));
CREATE POLICY "Org members can delete service work items"
  ON service_work_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM service_protocols sp JOIN projects p ON p.id = sp.project_id
                 WHERE sp.id = service_work_items.protocol_id
                   AND p.organization_id = current_org_id()));

-- ============================================================ viceprace_items
DROP POLICY IF EXISTS "Authenticated users can view viceprace items" ON viceprace_items;
DROP POLICY IF EXISTS "Authenticated users can update viceprace items" ON viceprace_items;

CREATE POLICY "Org members can view viceprace items"
  ON viceprace_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM viceprace v
                 WHERE v.id = viceprace_items.viceprace_id
                   AND v.organization_id = current_org_id()));
CREATE POLICY "Org members can update viceprace items"
  ON viceprace_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM viceprace v
                 WHERE v.id = viceprace_items.viceprace_id
                   AND v.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM viceprace v
                      WHERE v.id = viceprace_items.viceprace_id
                        AND v.organization_id = current_org_id()));

-- ============================================================ email_log
DROP POLICY IF EXISTS "Users can view own sent emails" ON email_log;
DROP POLICY IF EXISTS "Admins can update email log" ON email_log;

CREATE POLICY "Users can view own sent emails"
  ON email_log FOR SELECT TO authenticated
  USING (sender_user_id = auth.uid()
         OR (organization_id = current_org_id() AND is_full_admin()));
CREATE POLICY "Org admins can update email log"
  ON email_log FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND is_full_admin())
  WITH CHECK (organization_id = current_org_id() AND is_full_admin());

-- ============================================================ attendance (legacy)
DROP POLICY IF EXISTS "Admins and managers can view all attendance" ON attendance;
CREATE POLICY "Org admins can view org attendance"
  ON attendance FOR SELECT TO authenticated
  USING (is_full_admin() AND user_id IN (
    SELECT om.user_id FROM organization_members om
    WHERE om.organization_id = current_org_id()));

-- ============================================================ katalogové dětské tabulky
DROP POLICY IF EXISTS "Admins can insert heating system options" ON heating_system_options;
DROP POLICY IF EXISTS "Admins can update heating system options" ON heating_system_options;
DROP POLICY IF EXISTS "Admins can delete heating system options" ON heating_system_options;
CREATE POLICY "Org admins can insert heating system options"
  ON heating_system_options FOR INSERT TO authenticated
  WITH CHECK (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
              WHERE h.id = heating_system_options.heating_system_id
                AND h.organization_id = current_org_id()));
CREATE POLICY "Org admins can update heating system options"
  ON heating_system_options FOR UPDATE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
         WHERE h.id = heating_system_options.heating_system_id
           AND h.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM heating_systems h
              WHERE h.id = heating_system_options.heating_system_id
                AND h.organization_id = current_org_id()));
CREATE POLICY "Org admins can delete heating system options"
  ON heating_system_options FOR DELETE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
         WHERE h.id = heating_system_options.heating_system_id
           AND h.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Admins can insert heating system materials" ON heating_system_materials;
DROP POLICY IF EXISTS "Admins can update heating system materials" ON heating_system_materials;
DROP POLICY IF EXISTS "Admins can delete heating system materials" ON heating_system_materials;
CREATE POLICY "Org admins can insert heating system materials"
  ON heating_system_materials FOR INSERT TO authenticated
  WITH CHECK (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
              WHERE h.id = heating_system_materials.heating_system_id
                AND h.organization_id = current_org_id()));
CREATE POLICY "Org admins can update heating system materials"
  ON heating_system_materials FOR UPDATE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
         WHERE h.id = heating_system_materials.heating_system_id
           AND h.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM heating_systems h
              WHERE h.id = heating_system_materials.heating_system_id
                AND h.organization_id = current_org_id()));
CREATE POLICY "Org admins can delete heating system materials"
  ON heating_system_materials FOR DELETE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM heating_systems h
         WHERE h.id = heating_system_materials.heating_system_id
           AND h.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Admins can insert product design modules" ON product_design_modules;
DROP POLICY IF EXISTS "Admins can update product design modules" ON product_design_modules;
DROP POLICY IF EXISTS "Admins can delete product design modules" ON product_design_modules;
CREATE POLICY "Org admins can insert product design modules"
  ON product_design_modules FOR INSERT TO authenticated
  WITH CHECK (is_full_admin() AND EXISTS (SELECT 1 FROM products p
              WHERE p.id = product_design_modules.product_id
                AND p.organization_id = current_org_id()));
CREATE POLICY "Org admins can update product design modules"
  ON product_design_modules FOR UPDATE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM products p
         WHERE p.id = product_design_modules.product_id
           AND p.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM products p
              WHERE p.id = product_design_modules.product_id
                AND p.organization_id = current_org_id()));
CREATE POLICY "Org admins can delete product design modules"
  ON product_design_modules FOR DELETE TO authenticated
  USING (is_full_admin() AND EXISTS (SELECT 1 FROM products p
         WHERE p.id = product_design_modules.product_id
           AND p.organization_id = current_org_id()));

-- ============================================================ zakázky (jobs)
DROP POLICY IF EXISTS "Project owners can update jobs" ON jobs;
CREATE POLICY "Org members can update jobs"
  ON jobs FOR UPDATE TO authenticated
  USING (organization_id = current_org_id()
         AND (EXISTS (SELECT 1 FROM projects p
                      WHERE p.id = jobs.project_id AND p.user_id = auth.uid())
              OR is_admin_or_manager(auth.uid())))
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Auth users can insert job worklogs" ON job_worklogs;
DROP POLICY IF EXISTS "Users can update own worklogs" ON job_worklogs;
DROP POLICY IF EXISTS "Users can delete own worklogs" ON job_worklogs;
CREATE POLICY "Org members can insert job worklogs"
  ON job_worklogs FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
              AND EXISTS (SELECT 1 FROM jobs j
                  WHERE j.id = job_worklogs.job_id
                    AND j.organization_id = current_org_id()));
CREATE POLICY "Org members can update own worklogs"
  ON job_worklogs FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_worklogs.job_id
               AND j.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs j
              WHERE j.id = job_worklogs.job_id
                AND j.organization_id = current_org_id()));
CREATE POLICY "Org members can delete own worklogs"
  ON job_worklogs FOR DELETE TO authenticated
  USING ((user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_worklogs.job_id
               AND j.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Auth users can insert job materials" ON job_material_entries;
DROP POLICY IF EXISTS "Creators can update job materials" ON job_material_entries;
DROP POLICY IF EXISTS "Creators can delete job materials" ON job_material_entries;
CREATE POLICY "Org members can insert job materials"
  ON job_material_entries FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
              AND EXISTS (SELECT 1 FROM jobs j
                  WHERE j.id = job_material_entries.job_id
                    AND j.organization_id = current_org_id()));
CREATE POLICY "Org creators can update job materials"
  ON job_material_entries FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_material_entries.job_id
               AND j.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs j
              WHERE j.id = job_material_entries.job_id
                AND j.organization_id = current_org_id()));
CREATE POLICY "Org creators can delete job materials"
  ON job_material_entries FOR DELETE TO authenticated
  USING ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_material_entries.job_id
               AND j.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Auth users can insert diary entries" ON job_diary_entries;
DROP POLICY IF EXISTS "Creators can update diary entries" ON job_diary_entries;
DROP POLICY IF EXISTS "Creators can delete diary entries" ON job_diary_entries;
CREATE POLICY "Org members can insert diary entries"
  ON job_diary_entries FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
              AND EXISTS (SELECT 1 FROM jobs j
                  WHERE j.id = job_diary_entries.job_id
                    AND j.organization_id = current_org_id()));
CREATE POLICY "Org creators can update diary entries"
  ON job_diary_entries FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_diary_entries.job_id
               AND j.organization_id = current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs j
              WHERE j.id = job_diary_entries.job_id
                AND j.organization_id = current_org_id()));
CREATE POLICY "Org creators can delete diary entries"
  ON job_diary_entries FOR DELETE TO authenticated
  USING ((created_by = auth.uid() OR is_admin_or_manager(auth.uid()))
         AND EXISTS (SELECT 1 FROM jobs j
             WHERE j.id = job_diary_entries.job_id
               AND j.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Auth users can insert diary photos" ON job_diary_photos;
DROP POLICY IF EXISTS "Creators can delete diary photos" ON job_diary_photos;
CREATE POLICY "Org members can insert diary photos"
  ON job_diary_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM job_diary_entries de JOIN jobs j ON j.id = de.job_id
              WHERE de.id = job_diary_photos.diary_entry_id
                AND j.organization_id = current_org_id()
                AND (de.created_by = auth.uid() OR is_admin_or_manager(auth.uid()))));
CREATE POLICY "Org creators can delete diary photos"
  ON job_diary_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM job_diary_entries de JOIN jobs j ON j.id = de.job_id
         WHERE de.id = job_diary_photos.diary_entry_id
           AND j.organization_id = current_org_id()
           AND (de.created_by = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- ============================================================ zápisy vázané na projekt
DROP POLICY IF EXISTS "Authenticated users can insert installed devices" ON installed_devices;
CREATE POLICY "Org members can insert installed devices"
  ON installed_devices FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND EXISTS (SELECT 1 FROM projects p
                  WHERE p.id = installed_devices.project_id
                    AND p.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Authenticated users can insert project photos" ON project_photos;
CREATE POLICY "Org members can insert project photos"
  ON project_photos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid()
              AND EXISTS (SELECT 1 FROM projects p
                  WHERE p.id = project_photos.project_id
                    AND p.organization_id = current_org_id()));

DROP POLICY IF EXISTS "Authenticated users can insert defects" ON project_defects;
CREATE POLICY "Org members can insert defects"
  ON project_defects FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid()
              AND EXISTS (SELECT 1 FROM projects p
                  WHERE p.id = project_defects.project_id
                    AND p.organization_id = current_org_id()));
