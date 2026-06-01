/** API yanıtı — backend ders-dagit.class-profile-presets ile uyumlu */

export type ClassProfilePresetId =
  | 'genel'
  | 'ilk_1_3'
  | 'ilk_4'
  | 'orta_5_6'
  | 'orta_7_8'
  | 'lise_9_10'
  | 'lise_11_12'
  | 'lise_12_yks'
  | 'mtal_sabah'
  | 'mtal_ogle'
  | 'mtal_alan';

export type ClassProfilePresetDef = {
  id: ClassProfilePresetId;
  label: string;
  hint: string;
  max_lessons_per_day: number;
  max_weekly_lessons: number;
  min_weekly_lessons: number;
  education_shift?: 'morning' | 'afternoon' | null;
};

export type ClassProfilePresetsRes = {
  school_type: string;
  duty_max_lessons: number | null;
  default_max_lessons_per_day: number;
  presets: ClassProfilePresetDef[];
};
