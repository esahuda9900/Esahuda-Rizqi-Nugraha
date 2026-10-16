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
  mileageKm: number | null;
  mileageToSite: number | null;
  partsTotal: number | null;
  totalAmount: number | null;
  distributorNo: string;
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
    mileageKm: null,
    mileageToSite: null,
    partsTotal: null,
    totalAmount: null,
    distributorNo: '',
    sourceRawText: source,
  };
}
