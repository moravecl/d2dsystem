/*
  # Add weather data to construction diary entries

  1. Modified Tables
    - `job_diary_entries`
      - `weather_data` (jsonb, nullable) - Stores weather information for the entry date
        - temperature_min, temperature_max (°C)
        - precipitation_sum (mm)
        - wind_speed_max (km/h)
        - weather_code (WMO code)
        - weather_description (human-readable Czech text)

  2. Notes
    - Weather is fetched from Open-Meteo API based on project address
    - Historical weather available for past dates
    - Column is nullable since weather may not always be available
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_diary_entries' AND column_name = 'weather_data'
  ) THEN
    ALTER TABLE job_diary_entries ADD COLUMN weather_data jsonb;
  END IF;
END $$;
