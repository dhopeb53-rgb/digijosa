/**
 * Shared application state and static configuration.
 */

// Global State
let db = {
  survey: {
    date: '',
    surveyor: '',
    witness: '',
    owner: '',
    location: '',
    company: '',
    bizType: '',
    bizStatus: '',
    repName: '',
    repJumin: '',
    repAddr: '',
    repContact: '',
    bizRegNo: '',
    corpRegNo: '',
    notes: '',
    photo: '', // Base64 of Site Panorama / Floor Plan
    district: '', // Project District Name (Bottom Left Overlay)
    bizLocation: '', // Address on Business Registration
    locationRoad: '',
    locationJibun: '',
    locationZip: '',
    locationDetail: '',
    repRoad: '',
    repJibun: '',
    repZip: '',
    repDetail: '',
    bizLocationRoad: '',
    bizLocationJibun: '',
    bizLocationZip: '',
    bizLocationDetail: '',
    outOfDistrict: false, // Out of District Status
    repOutOfDistrict: false,
    bizOutOfDistrict: false,
    hasLedger: false,
    isBusiness: false,
    isResidence: false,
    hasElectricity: false,
    hasWater: false,
    hasSeptic: false,
    rentType: '자가',
    permitNotes: '',
    surveyorSignature: '',
    witnessSignature: '',
    ownershipMode: 'single'
  },
  coOwners: [],
  items: [], // List of items/objects (Tab 2)
  documents: [] // Additional submitted photos
};

// Default template row config in Excel Template (Sheet 2: 물건내역(영업))
const EXCEL_ITEM_START_ROW = 3;
const EXCEL_DEFAULT_ITEMS_COUNT = 4; // B3:B6 exist by default

// Dropdown lists extracted from the Excel template validations (Data Validations)
const SURVEY_ITEM_TYPES = [
  "가옥", "공장", "상가", "기타건물", "주거용비닐하우스", "농업용비닐하우스",
  "기타비닐하우스", "한전주", "통신주", "기타전주", "기타지장물", "농기구",
  "수목", "가추", "차양"
];

const SURVEY_ITEM_UNITS = [
  "㎡", "주", "식", "대", "개", "m", "기타", "기", "두", "동", "t",
  "조", "Kg", "세트", "톤", "상자", "차", "마리", "㎥", "군", "본", "정",
  "장", "수", "개소", "점", "매", "포", "평", "바렛", "파레트", "마대",
  "소", "각", "cm", "단", "폭", "근", "판", "척", "간", "가마", "해당없음"
];
