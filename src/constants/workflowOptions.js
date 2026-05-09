export const IMPLANT_SYSTEM_OPTIONS = [
  'AB Dent',
  'Adin',
  'Alpha Dent',
  'Bicon',
  'Biohorizons',
  'Blue Sky Bio',
  'Bredent',
  'Camlog',
  'Dentis',
  'Dentsply',
  'Glidewell (Hahn)',
  'Hahn',
  'Hiossen',
  'Hi-Tech',
  'Implant Direct',
  'Izen',
  'Jdental',
  'Megagen',
  'MIS',
  'Neo-Biotech',
  'Neodent',
  'Nobel BioCare',
  'Noris',
  'NucleOSS',
  'Osstem',
  'Ritter',
  'Straumann',
  'Surgikor',
  'ZimVie',
  'Other',
];

export const SERVICES_NEEDED_OPTIONS = [
  'Tooth supported Surgical Guide',
  'Bone supported Surgical Guide',
  'Tissue supported Surgical Guide',
  'Stackable Guide only',
  'Stackable Guide with immediate PMMA',
  'PMMA Temps',
  'Prosthetic Finals',
  'Crowns over implants',
  'Gingivectomy guide',
  'Other',
];

export const CASE_STATUS_PROGRESS_MAP = {
  'Order Received': 5,
  Planning: 10,
  'Wax-up Design': 15,
  'Waiting on Model or STL': 20,
  'New CBCT Needed': 20,
  'Case on Hold': 20,
  'Planning Completed (Needs Scheduling)': 35,
  "Pending Dr's Approval (Video Sent)": 40,
  'Review Scheduled': 45,
  'Case Approved QC and Paperwork': 55,
  'Surgical Guide Design': 60,
  'Guide Printing': 70,
  'Finishing and Preparing for shipping': 80,
  'STL Shared with Dr': 85,
  'Case Shipped': 90,
  'Invoice Sent': 95,
  Billed: 98,
  Completed: 100,
  'Order Canceled': 0,
};

export const CASE_STATUS_NAMES = Object.keys(CASE_STATUS_PROGRESS_MAP);

export function statusProgressPercent(statusName, fallback = 0) {
  return Object.prototype.hasOwnProperty.call(CASE_STATUS_PROGRESS_MAP, statusName)
    ? CASE_STATUS_PROGRESS_MAP[statusName]
    : Number(fallback || 0);
}
