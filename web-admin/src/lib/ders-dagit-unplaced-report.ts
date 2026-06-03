export type UnplacedPlacementRow = {
  assignment_id: string;
  subject: string;
  class_section: string;
  teacher_id: string | null;
  teacher_name: string;
  missing_hours: number;
  pattern: string | null;
  pattern_remain: string | null;
  free_single_slots: number;
  class_block2_slots: number;
  shiftable_block2_slots: number;
  free_block2_slots: number;
  href: string;
};

export type UnplacedTeacherSummary = {
  teacher_id: string | null;
  teacher_name: string;
  missing_hours: number;
  card_count: number;
};

export type UnplacedPlacementReport = {
  total_missing_hours: number;
  card_count: number;
  rows: UnplacedPlacementRow[];
  by_teacher: UnplacedTeacherSummary[];
  recommendations: string[];
};
