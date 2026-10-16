export type ParsedPartRow = {
  failurePartNo: string;
  replacementPartNo: string;
  description: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
};

export type ParsedClaim = {
  dealerWoSo: string;
  model: string;
  serialNo: string;
  indentNo: string;
  customer: string;
  distributor: string;
  dealerName: string;
  dealerCode: string;
  branch: string;
  salesDate: string;
  failureDate: string;
  dealerRepairDate: string;
  completionDate: string;
  dealerClaimDate: string;
  dealerClaimNo: string;
  appCode: string;
  hmFailure: number | null;
  hmCompletion: number | null;
  faultDescription: string;
  causeAnalyze: string;
  comment: string;
  causingPartNo: string;
  causingPartDesc: string;
  repairMethod: string;
  technicalPersonnel: string;
  engineSerialNo: string;
  failurePartLocation: string;
  labourHrs: number | null;
  labourAmount: number | null;
  mileageKm: number | null;
  mileageAmount: number | null;
  mileageToSite: number | null;
  otherAmount: number | null;
  partsTotal: number | null;
  totalAmount: number | null;
  distributorNo: string;
  partsRows: ParsedPartRow[];
  sourceRawText: string;
};

export function emptyParsed(source = ''): ParsedClaim {
  return {
    dealerWoSo: '',
    model: '',
    serialNo: '',
    indentNo: '',
    customer: '',
    distributor: '',
    dealerName: '',
    dealerCode: '',
    branch: '',
    salesDate: '',
    failureDate: '',
    dealerRepairDate: '',
    completionDate: '',
    dealerClaimDate: '',
    dealerClaimNo: '',
    appCode: '',
    hmFailure: null,
    hmCompletion: null,
    faultDescription: '',
    causeAnalyze: '',
    comment: '',
    causingPartNo: '',
    causingPartDesc: '',
    repairMethod: '',
    technicalPersonnel: '',
    engineSerialNo: '',
    failurePartLocation: '',
    labourHrs: null,
    labourAmount: null,
    mileageKm: null,
    mileageAmount: null,
    mileageToSite: null,
    otherAmount: null,
    partsTotal: null,
    totalAmount: null,
    distributorNo: '',
    partsRows: [],
    sourceRawText: source,
  };
}
