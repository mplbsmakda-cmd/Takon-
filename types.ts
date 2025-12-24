
export interface Question {
  id: string;
  text: string;
  type: 'text' | 'rating'; // Tambahan tipe pertanyaan
  active: boolean;
  createdAt: number;
}

export interface Class {
  id: string;
  name: string;
}

export interface Submission {
  id: string;
  userName: string;
  className: string;
  answers: Record<string, string | number>;
  timestamp: number;
}

export interface AppConfig {
  eventTitle: string;
  eventDescription: string;
  themeColor: string;
}
