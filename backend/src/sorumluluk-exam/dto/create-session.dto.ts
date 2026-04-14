import { IsString, IsOptional, IsInt, IsIn, Min, MaxLength } from 'class-validator';

export class CreateSorumlulukSessionDto {
  @IsOptional() @IsIn(['yazili', 'uygulama', 'mixed'])
  sessionType?: 'yazili' | 'uygulama' | 'mixed';
  @IsString() @MaxLength(255)
  subjectName: string;

  @IsString()
  sessionDate: string; // YYYY-MM-DD

  @IsString()
  startTime: string; // HH:MM

  @IsString()
  endTime: string; // HH:MM

  @IsOptional() @IsString() @MaxLength(100)
  roomName?: string;

  @IsOptional() @IsInt() @Min(1)
  capacity?: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class SetSessionProctorsDto {
  proctors: Array<{ userId: string; role: 'komisyon_uye' | 'gozcu'; sortOrder?: number }>;
}

export class UpdateAttendanceDto {
  @IsIn(['present', 'absent', 'excused'])
  status: 'present' | 'absent' | 'excused';
}
