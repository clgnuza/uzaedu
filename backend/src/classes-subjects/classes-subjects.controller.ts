import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ClassesSubjectsService, type ClassesSubjectsViewer } from './classes-subjects.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UserRole } from '../types/enums';

@Controller('classes-subjects')
@UseGuards(JwtAuthGuard)
@SkipThrottle({ default: true, auth: true, public: true })
export class ClassesSubjectsController {
  constructor(private readonly service: ClassesSubjectsService) {}

  private csViewer(payload: CurrentUserPayload): ClassesSubjectsViewer {
    return { userId: payload.userId, role: payload.role as UserRole, schoolId: payload.schoolId };
  }

  @Get('classes')
  async listClasses(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') querySchoolId?: string,
  ) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher && payload.role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.school_admin && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.superadmin) {
      if (!querySchoolId?.trim()) {
        throw new BadRequestException({ code: 'SCHOOL_ID_REQUIRED', message: 'superadmin için school_id gereklidir.' });
      }
      return this.service.listClasses({
        userId: payload.userId,
        role: UserRole.superadmin,
        schoolId: querySchoolId.trim(),
      });
    }
    return this.service.listClasses(this.csViewer(payload));
  }

  @Post('classes')
  async createClass(@CurrentUser() payload: CurrentUserPayload, @Body() dto: CreateClassDto) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.school_admin && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.createClass(this.csViewer(payload), dto);
  }

  @Patch('classes/:id')
  async updateClass(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.updateClass(this.csViewer(payload), id, dto);
  }

  @Delete('classes/:id')
  async deleteClass(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.deleteClass(this.csViewer(payload), id);
  }

  @Get('subjects')
  async listSubjects(@CurrentUser() payload: CurrentUserPayload) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.school_admin && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.listSubjects(this.csViewer(payload));
  }

  @Post('subjects')
  async createSubject(@CurrentUser() payload: CurrentUserPayload, @Body() dto: CreateSubjectDto) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.school_admin && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.createSubject(this.csViewer(payload), dto);
  }

  @Patch('subjects/:id')
  async updateSubject(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.updateSubject(this.csViewer(payload), id, dto);
  }

  @Delete('subjects/:id')
  async deleteSubject(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.deleteSubject(this.csViewer(payload), id);
  }

  @Post('seed-defaults')
  async seedDefaults(@CurrentUser() payload: CurrentUserPayload) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.seedDefaults(payload.schoolId);
  }

  @Post('classes/import/eokul-pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async importClassesFromEokulPdf(
    @CurrentUser() payload: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('city') city?: string,
    @Body('district') district?: string,
  ) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Dosya gerekli.' });
    }
    const lowerName = (file.originalname ?? '').toLowerCase();
    const lowerMime = (file.mimetype ?? '').toLowerCase();
    const isPdf = lowerMime.includes('pdf') || lowerName.endsWith('.pdf');
    const isExcel =
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      lowerMime.includes('excel') ||
      lowerMime.includes('spreadsheetml');
    if (!isPdf && !isExcel) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'PDF veya Excel (.xls/.xlsx) yükleyin.' });
    }
    return this.service.importClassesFromEokulPdf(payload.schoolId, file.buffer, { city, district, originalName: file.originalname });
  }

  @Post('subjects/import/eokul-program-xls')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  async importSubjectsFromEokulProgramXls(
    @CurrentUser() payload: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Dosya gerekli.' });
    }
    const lowerName = (file.originalname ?? '').toLowerCase();
    const lowerMime = (file.mimetype ?? '').toLowerCase();
    const isExcel =
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      lowerMime.includes('excel') ||
      lowerMime.includes('spreadsheetml');
    if (!isExcel) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Sadece Excel (.xls/.xlsx) yükleyin.' });
    }
    return this.service.importSubjectsFromEokulProgramXls(payload.schoolId, file.buffer);
  }

  @Get('classes/:classId/students')
  async listStudentsByClass(@CurrentUser() payload: CurrentUserPayload, @Param('classId') classId: string) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.listStudentsByClass(this.csViewer(payload), classId);
  }

  @Post('classes/:classId/students')
  async createStudentForClass(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('classId') classId: string,
    @Body() body: { name?: string; studentNumber?: string; firstName?: string; lastName?: string; gender?: string; birthDate?: string | null },
  ) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.teacher && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul bağlantısı gerekir.' });
    }
    return this.service.createStudentForClass(this.csViewer(payload), classId, body);
  }

  @Patch('students/:studentId')
  async updateStudentForClass(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('studentId') studentId: string,
    @Body() body: { name?: string; studentNumber?: string | null; classId?: string | null; firstName?: string; lastName?: string; gender?: string | null; birthDate?: string | null },
  ) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.teacher && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul bağlantısı gerekir.' });
    }
    return this.service.updateStudentForClass(this.csViewer(payload), studentId, body);
  }

  @Delete('students/:studentId')
  async deleteStudentForClass(@CurrentUser() payload: CurrentUserPayload, @Param('studentId') studentId: string) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.teacher && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul bağlantısı gerekir.' });
    }
    return this.service.deleteStudentForClass(this.csViewer(payload), studentId);
  }

  @Delete('classes/:classId/students')
  async deleteAllStudentsForClass(@CurrentUser() payload: CurrentUserPayload, @Param('classId') classId: string) {
    if (payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (payload.role === UserRole.teacher && !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul bağlantısı gerekir.' });
    }
    return this.service.deleteAllStudentsForClass(this.csViewer(payload), classId);
  }

  @Post('students/import/eokul-class-list-xls')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  async importStudentsFromClassListXls(
    @CurrentUser() payload: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Dosya gerekli.' });
    }
    const lowerName = (file.originalname ?? '').toLowerCase();
    const lowerMime = (file.mimetype ?? '').toLowerCase();
    const isExcel =
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      lowerMime.includes('excel') ||
      lowerMime.includes('spreadsheetml');
    if (!isExcel) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Sadece Excel (.xls/.xlsx) yükleyin.' });
    }
    return this.service.importStudentsFromClassListExcel(payload.schoolId, file.buffer);
  }
}
