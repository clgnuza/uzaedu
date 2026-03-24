import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ClassesSubjectsService } from './classes-subjects.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UserRole } from '../types/enums';

@Controller('classes-subjects')
@UseGuards(JwtAuthGuard)
export class ClassesSubjectsController {
  constructor(private readonly service: ClassesSubjectsService) {}

  @Get('classes')
  async listClasses(@CurrentUser() payload: CurrentUserPayload) {
    if ((payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.listClasses(payload.schoolId);
  }

  @Post('classes')
  async createClass(@CurrentUser() payload: CurrentUserPayload, @Body() dto: CreateClassDto) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.createClass(payload.schoolId, dto);
  }

  @Patch('classes/:id')
  async updateClass(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.updateClass(payload.schoolId, id, dto);
  }

  @Delete('classes/:id')
  async deleteClass(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.deleteClass(payload.schoolId, id);
  }

  @Get('subjects')
  async listSubjects(@CurrentUser() payload: CurrentUserPayload) {
    if ((payload.role !== UserRole.school_admin && payload.role !== UserRole.teacher) || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.listSubjects(payload.schoolId);
  }

  @Post('subjects')
  async createSubject(@CurrentUser() payload: CurrentUserPayload, @Body() dto: CreateSubjectDto) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.createSubject(payload.schoolId, dto);
  }

  @Patch('subjects/:id')
  async updateSubject(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.updateSubject(payload.schoolId, id, dto);
  }

  @Delete('subjects/:id')
  async deleteSubject(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.deleteSubject(payload.schoolId, id);
  }

  @Post('seed-defaults')
  async seedDefaults(@CurrentUser() payload: CurrentUserPayload) {
    if (payload.role !== UserRole.school_admin || !payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.seedDefaults(payload.schoolId);
  }
}
