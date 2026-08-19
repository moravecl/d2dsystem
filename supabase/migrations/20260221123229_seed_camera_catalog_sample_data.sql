/*
  # Seed Camera Catalog Sample Data

  Inserts sample records into the camera system catalog tables for every
  existing organization so users can immediately test the camera designer.

  1. Sample Data
    - 6 camera models (dome, bullet, PTZ, fisheye variants from Hikvision and Dahua)
    - 2 NVR recorders (8ch and 16ch)
    - 3 cable types (UTP Cat5e, UTP Cat6, coax)
    - 2 PoE switches (8-port and 16-port)
    - 4 accessories (junction box, wall bracket, 4TB HDD, 8TB HDD)

  2. Notes
    - Data is inserted for EVERY organization currently in the organizations table
    - Uses realistic pricing in CZK and real-world camera specifications
    - All items are set to is_active = true
*/

INSERT INTO camera_models (org_id, name, manufacturer, camera_type, resolution_w, resolution_h, resolution_label, h_fov_deg, v_fov_deg, lens_mm, ir_range_m, poe, power_w, ip_rating, price, is_active)
SELECT
  o.id,
  v.name, v.manufacturer, v.camera_type::text,
  v.resolution_w, v.resolution_h, v.resolution_label,
  v.h_fov_deg, v.v_fov_deg, v.lens_mm, v.ir_range_m,
  v.poe, v.power_w, v.ip_rating, v.price, true
FROM organizations o
CROSS JOIN (VALUES
  ('DS-2CD2143G2-I', 'Hikvision', 'dome', 2688, 1520, '2K', 106, 57, 2.8, 30, true, 12, 'IP67', 3200),
  ('DS-2CD2T47G2-L', 'Hikvision', 'bullet', 2688, 1520, '2K', 84, 44, 4.0, 60, true, 12, 'IP67', 4100),
  ('DS-2DE4A425IWG-E', 'Hikvision', 'ptz', 2560, 1440, '1440p', 58, 35, 4.8, 100, true, 30, 'IP66', 12500),
  ('IPC-EBW81242', 'Dahua', 'fisheye', 4000, 3000, '4K', 180, 180, 1.29, 10, true, 18, 'IP67', 8900),
  ('IPC-HDW2441T-S', 'Dahua', 'dome', 2688, 1520, '2K', 102, 55, 2.8, 30, true, 9, 'IP67', 2400),
  ('IPC-HFW2849T-AS-IL', 'Dahua', 'bullet', 3840, 2160, '4K', 106, 57, 2.8, 50, true, 14, 'IP67', 5600)
) AS v(name, manufacturer, camera_type, resolution_w, resolution_h, resolution_label, h_fov_deg, v_fov_deg, lens_mm, ir_range_m, poe, power_w, ip_rating, price);

INSERT INTO camera_nvrs (org_id, name, manufacturer, channels, max_resolution_label, hdd_bays, max_hdd_tb, poe_ports, poe_budget_w, throughput_mbps, price, is_active)
SELECT
  o.id,
  v.name, v.manufacturer, v.channels, v.max_resolution_label,
  v.hdd_bays, v.max_hdd_tb, v.poe_ports, v.poe_budget_w,
  v.throughput_mbps, v.price, true
FROM organizations o
CROSS JOIN (VALUES
  ('DS-7608NXI-K2/8P', 'Hikvision', 8, '4K', 2, 20, 8, 120, 160, 8900),
  ('DS-7616NXI-K2/16P', 'Hikvision', 16, '4K', 2, 20, 16, 200, 256, 14500),
  ('NVR4208-8P-EI', 'Dahua', 8, '4K', 2, 20, 8, 130, 200, 9200)
) AS v(name, manufacturer, channels, max_resolution_label, hdd_bays, max_hdd_tb, poe_ports, poe_budget_w, throughput_mbps, price);

INSERT INTO camera_cables (org_id, name, cable_type, max_length_m, price_per_m, is_active)
SELECT
  o.id,
  v.name, v.cable_type::text, v.max_length_m, v.price_per_m, true
FROM organizations o
CROSS JOIN (VALUES
  ('UTP Cat5e Solarix', 'utp_cat5e', 100, 8.5),
  ('UTP Cat6 Solarix', 'utp_cat6', 100, 14.0),
  ('Koaxial RG59 + napajeni', 'coax', 300, 18.0)
) AS v(name, cable_type, max_length_m, price_per_m);

INSERT INTO camera_poe_switches (org_id, name, manufacturer, poe_ports, uplink_ports, poe_budget_w, managed, price, is_active)
SELECT
  o.id,
  v.name, v.manufacturer, v.poe_ports, v.uplink_ports,
  v.poe_budget_w, v.managed, v.price, true
FROM organizations o
CROSS JOIN (VALUES
  ('TL-SG1008MP', 'TP-Link', 8, 0, 126, false, 2800),
  ('GS1900-24HP', 'Zyxel', 24, 2, 170, true, 6400)
) AS v(name, manufacturer, poe_ports, uplink_ports, poe_budget_w, managed, price);

INSERT INTO camera_accessories (org_id, name, accessory_type, capacity_tb, price, is_active)
SELECT
  o.id,
  v.name, v.accessory_type::text, v.capacity_tb, v.price, true
FROM organizations o
CROSS JOIN (VALUES
  ('Montazni box (junction box)', 'junction_box', NULL, 350),
  ('Nastenny drzak', 'bracket', NULL, 280),
  ('WD Purple 4TB (WD43PURZ)', 'hdd', 4, 2900),
  ('WD Purple 8TB (WD84PURZ)', 'hdd', 8, 5200)
) AS v(name, accessory_type, capacity_tb, price);
