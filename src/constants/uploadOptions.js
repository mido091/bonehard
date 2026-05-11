export const MAX_CASE_FILE_SIZE_MB = 1024;
export const MAX_CASE_FILE_SIZE = MAX_CASE_FILE_SIZE_MB * 1024 * 1024;

export const CASE_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.html,.zip,.rar,.jpg,.jpeg,.png,.gif,.stl,.dcm,.ply,.obj,.mp4";

export const CASE_ALLOWED_UPLOAD_EXTENSIONS = new Set(
  CASE_UPLOAD_ACCEPT.split(",").map((item) => item.trim().toLowerCase()),
);

export const UPLOAD_CATEGORIES = [
  {
    key: "dicom",
    title: "Upload the patient's DICOM Files",
    hint: "DICOM studies, .dcm files, or compressed DICOM folders.",
  },
  {
    key: "stl",
    title: "Upload the patient's STL Files",
    hint: "STL, PLY, OBJ, ZIP, or RAR model files.",
  },
  {
    key: "photos_documents",
    title: "Upload the patient's Photos - and any additional documents",
    hint: "Photos, PDFs, Office docs, CSV/TXT/RTF/HTML, MP4, ZIP, or RAR.",
  },
];

export const UPLOAD_CATEGORY_LABELS = UPLOAD_CATEGORIES.reduce((labels, item) => {
  labels[item.key] = item.title;
  return labels;
}, {});

export function uploadCategoryLabel(value) {
  return UPLOAD_CATEGORY_LABELS[value] || UPLOAD_CATEGORY_LABELS.photos_documents;
}
