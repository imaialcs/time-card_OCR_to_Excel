
export interface TimeCardData {
  title: {
    yearMonth: string;
    name: string;
  };
  headers: string[];
  data: string[][];
  nameCorrected?: boolean; // Field to track if the name was corrected by the roster
}