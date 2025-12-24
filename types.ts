
export interface Question {
  id: string;
  text: string;
  type: 'text' | 'rating';
  active: boolean;
  createdAt: number;
  targetType: 'global' | 'specific';
  targetClasses?: string[]; 
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
  title: string;
  desc: string;
  isOpen: boolean;
  brandColor: string;
  logoUrl?: string;
}
