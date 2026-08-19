/*
  # S4: Omezení anonymního čtení bucketu uploads

  ## Problém (vysoký)
  Politika "Public can read uploads bucket" dávala anonymním uživatelům
  čtení CELÉHO bucketu uploads (assets/, knowledge/, remarks/).
  Interní dokumenty a fotky tak byly dostupné přes veřejnou URL bez přihlášení.

  ## Oprava
  Anonymní čtení zúženo pouze na složku remarks/ (obrázky u připomínek,
  které se zobrazují klientům v portálu). Vše ostatní vyžaduje přihlášení.

  Pozn.: cesty v remarks/ obsahují neuhodnutelná UUID; výhledově doporučeno
  přejít i zde na signed URLs a bucket zcela uzavřít.
*/

DROP POLICY IF EXISTS "Public can read uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read uploads bucket" ON storage.objects;

CREATE POLICY "Public can read portal remark images"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'remarks'
  );
