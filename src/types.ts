export interface Student {
  [key: string]: string;
  학년: string;
  반: string;
  번호: string;
  이름: string;
  원점수: string; // Column E, representing student score
}

export interface College {
  [key: string]: string;
  지역: string;
  대학: string;
  모집단위: string;
  원점수: string; // Column J, representing college admission score
}

export interface LoadDataResponse {
  students: Student[];
  colleges: College[];
}

export interface AnalysisResponse {
  analysis?: string;
  error?: string;
}
