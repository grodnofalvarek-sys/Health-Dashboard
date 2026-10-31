export type SpecialtyId = 'cardio' | 'uro' | 'gastro' | 'ortho' | 'lab' | 'prev';
export type LabStatus = 'normal' | 'above_target' | 'high' | 'low';

export interface Diagnosis {
  id: string;
  code: string;
  specialty: SpecialtyId;
  domain: string;
  titleRu: string;
  titleLt: string;
  status: string;
  statusLevel: 'controlled' | 'remission' | 'attention';
  therapy: string;
  therapyLt: string;
}

export interface AttentionItem {
  id: string;
  kind: 'lab_target' | 'lab_high' | 'followup';
  specialty: SpecialtyId;
  severity: 'warn' | 'info';
  titleRu: string;
  detailRu: string;
  date: string;
}

export interface TrendInfo {
  direction: 'up' | 'down' | 'stable' | 'none';
  delta: number | null;
  percent: number | null;
}

export interface LabResult {
  id: string;
  analyte: string;
  group: string;
  nameRu: string;
  shortName: string;
  value: number;
  unit: string;
  date: string;
  lab: string;
  refLow: number | null;
  refHigh: number | null;
  targetHigh: number | null;
  status: LabStatus;
  note: string | null;
  documentId: string | null;
  documentPath: string | null;
  verificationStatus: 'confirmed' | 'pending_review' | 'manual';
}

export interface LatestAnalyteSummary extends LabResult {
  trendFromPrev: TrendInfo;
  trendFromBaseline: TrendInfo;
  baselineValue: number | null;
  baselineDate: string | null;
  history: Array<{ date: string; value: number; lab: string; status: LabStatus }>;
}

export interface ClinicalEvent {
  id: string;
  date: string;
  specialty: SpecialtyId;
  episodeId: string | null;
  kind: string;
  titleRu: string;
  clinic: string;
  findingsRu: string;
  findingsLt: string | null;
  documentIds: string[];
  documentPaths: string[];
}

export interface ClinicalEpisode {
  id: string;
  titleRu: string;
  specialty: SpecialtyId;
  period: string;
  summary: string;
}

export interface MedicationCourse {
  id: string;
  drugRu: string;
  drugLt: string;
  dose: string;
  specialty: SpecialtyId;
  start: string;
  end: string | null;
  active: boolean;
  reason: string;
}

export interface FollowUpItem {
  id: string;
  titleRu: string;
  titleLt: string;
  specialty: SpecialtyId;
  dueDate: string;
  dueLabel: string;
  status: 'pending' | 'scheduled' | 'done';
  priority: 'high' | 'medium';
  source: string;
}

export interface VisitTemplate {
  id: string;
  specialistRu: string;
  specialistLt: string;
  specialty: SpecialtyId;
  reasonRu: string;
  reasonLt: string;
  keyFactsRu: string[];
  keyFactsLt: string[];
  questionsRu: string[];
  questionsLt: string[];
}

export interface MedicalDocument {
  id: string;
  path: string;
  folder: string;
  fileName: string;
  date: string;
  specialty: SpecialtyId;
  docType: string;
  clinic: string;
  titleRu: string;
  markers: string[];
  fileType: string;
  sizeBytes: number;
  isStandardName: boolean;
}

export interface PendingRenameItem {
  id: string;
  currentFolder: string;
  currentName: string;
  proposedFolder: string;
  proposedName: string;
  detectedDate: string | null;
  specialty: SpecialtyId;
  confidence: 'high' | 'medium' | 'low';
}

export interface DateDiscrepancyItem {
  kind: string;
  analyte: string;
  recordDate: string;
  documentDate: string;
  documentPath: string;
  diffDays: number;
}

export interface HealthDatabase {
  schemaVersion: string;
  generatedAt: string;
  patient: {
    birthDate: string;
    gender: 'male' | 'female';
    anthropometry: {
      heightCm: number;
      weightKg: number;
      bmi: number;
      score2Percent: number;
      cacAgatston: number;
      cadRads: string;
      lvefPercent: number;
      ascendingAortaMm: number;
      piRads: number;
      prostateVolumeMl: number;
    };
  };
  diagnoses: Diagnosis[];
  attentionItems: AttentionItem[];
  latestByAnalyte: Record<string, LatestAnalyteSummary>;
  labResults: LabResult[];
  clinicalEvents: ClinicalEvent[];
  episodes: ClinicalEpisode[];
  medications: MedicationCourse[];
  followUps: FollowUpItem[];
  visitTemplates: VisitTemplate[];
  documents: MedicalDocument[];
  pipelineReport: {
    totalDocuments: number;
    standardNamedCount: number;
    pendingRenames: PendingRenameItem[];
    dateDiscrepancies: DateDiscrepancyItem[];
  };
}
