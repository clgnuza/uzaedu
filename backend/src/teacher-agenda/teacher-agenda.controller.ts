import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { TeacherAgendaService } from './teacher-agenda.service';
import { CreateAgendaNoteDto } from './dto/create-note.dto';
import { UpdateAgendaNoteDto } from './dto/update-note.dto';
import { CreateAgendaTaskDto } from './dto/create-task.dto';
import { UpdateAgendaTaskDto } from './dto/update-task.dto';
import { CreateAgendaReminderDto } from './dto/create-reminder.dto';
import { CreateAgendaSchoolEventDto } from './dto/create-school-event.dto';
import { UpdateAgendaSchoolEventDto } from './dto/update-school-event.dto';
import { CreateAgendaPlatformEventDto } from './dto/create-platform-event.dto';
import { CreateAgendaStudentNoteDto } from './dto/create-student-note.dto';
import { CreateAgendaParentMeetingDto } from './dto/create-parent-meeting.dto';
import {
  ListAgendaNotesDto,
  ListAgendaTasksDto,
  ListCalendarDto,
} from './dto/list-agenda.dto';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { CreateStudentListDto } from './dto/create-student-list.dto';
import { CreateEvaluationScoreDto } from './dto/create-evaluation-score.dto';
import { AgendaTask } from './entities/agenda-task.entity';

@Controller('teacher-agenda')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('teacher_agenda')
export class TeacherAgendaController {
  constructor(private readonly service: TeacherAgendaService) {}

  @Post('notes')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createNote(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateAgendaNoteDto) {
    return this.service.createNote(p.userId, p.schoolId ?? null, dto);
  }

  @Patch('notes/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  updateNote(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: UpdateAgendaNoteDto,
  ) {
    return this.service.updateNote(id, p.userId, dto);
  }

  @Get('notes')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listNotes(@CurrentUser() p: CurrentUserPayload, @Query() dto: ListAgendaNotesDto) {
    return this.service.listNotes(p.userId, dto);
  }

  @Get('notes/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  getNote(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.getNoteById(id, p.userId);
  }

  @Post('notes/:id/archive')
  @Roles(UserRole.teacher, UserRole.school_admin)
  archiveNote(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.archiveNote(id, p.userId);
  }

  @Post('notes/bulk-archive')
  @Roles(UserRole.teacher, UserRole.school_admin)
  bulkArchiveNotes(@CurrentUser() p: CurrentUserPayload, @Body() dto: { ids: string[] }) {
    return this.service.bulkArchiveNotes(p.userId, dto.ids ?? []);
  }

  @Post('notes/bulk-delete')
  @Roles(UserRole.teacher, UserRole.school_admin)
  bulkDeleteNotes(@CurrentUser() p: CurrentUserPayload, @Body() dto: { ids: string[] }) {
    return this.service.bulkDeleteNotes(p.userId, dto.ids ?? []);
  }

  @Delete('notes/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  deleteNote(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.deleteNote(id, p.userId);
  }

  @Post('tasks')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createTask(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateAgendaTaskDto) {
    return this.service.createTask(p.userId, p.schoolId ?? null, dto);
  }


  @Patch('tasks/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  updateTask(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: UpdateAgendaTaskDto,
  ) {
    return this.service.updateTask(id, p.userId, dto);
  }

  @Patch('tasks/:id/status')
  @Roles(UserRole.teacher, UserRole.school_admin)
  setTaskStatus(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body('status') status: AgendaTask['status'],
  ) {
    return this.service.setTaskStatus(id, p.userId, status);
  }

  @Get('tasks')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listTasks(@CurrentUser() p: CurrentUserPayload, @Query() dto: ListAgendaTasksDto) {
    return this.service.listTasks(p.userId, dto);
  }

  @Delete('tasks/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  deleteTask(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.deleteTask(id, p.userId);
  }

  @Post('tasks/bulk-delete')
  @Roles(UserRole.teacher, UserRole.school_admin)
  bulkDeleteTasks(@CurrentUser() p: CurrentUserPayload, @Body() dto: { ids: string[] }) {
    return this.service.bulkDeleteTasks(p.userId, dto.ids ?? []);
  }

  @Post('tasks/bulk-status')
  @Roles(UserRole.teacher, UserRole.school_admin)
  bulkUpdateTaskStatus(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: { ids: string[]; status: string },
  ) {
    return this.service.bulkUpdateTaskStatus(p.userId, dto.ids ?? [], dto.status ?? 'pending');
  }

  @Post('reminders')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createReminder(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateAgendaReminderDto) {
    return this.service.createReminder(p.userId, dto);
  }

  @Get('calendar')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getCalendar(@CurrentUser() p: CurrentUserPayload, @Query() dto: ListCalendarDto) {
    return this.service.getCalendarFeed(
      p.userId,
      p.schoolId ?? null,
      p.role as UserRole,
      dto,
      p.user?.display_name ?? p.user?.email ?? 'Siz',
    );
  }

  @Get('templates')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listTemplates(@CurrentUser() p: CurrentUserPayload) {
    return this.service.listTemplates(p.userId, p.schoolId ?? null);
  }

  @Post('templates')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createTemplate(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: { title: string; bodyTemplate?: string | null },
  ) {
    return this.service.createTemplate(p.userId, p.schoolId ?? null, dto);
  }

  @Post('notes/:id/attachments')
  @Roles(UserRole.teacher, UserRole.school_admin)
  addNoteAttachment(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: { fileUrl: string; fileType?: string; fileName?: string },
  ) {
    return this.service.addNoteAttachment(id, p.userId, dto);
  }

  @Delete('notes/:noteId/attachments/:attachmentId')
  @Roles(UserRole.teacher, UserRole.school_admin)
  deleteNoteAttachment(
    @Param('noteId') _noteId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() p: CurrentUserPayload,
  ) {
    return this.service.deleteNoteAttachment(attachmentId, p.userId);
  }

  @Post('school-events')
  @Roles(UserRole.school_admin)
  createSchoolEvent(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateAgendaSchoolEventDto,
  ) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.createSchoolEvent(p.schoolId, p.userId, dto);
  }

  @Get('school-events')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listSchoolEvents(
    @CurrentUser() p: CurrentUserPayload,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!p.schoolId) return [];
    return this.service.listSchoolEvents(p.schoolId, start, end);
  }

  @Get('school-events/:id')
  @Roles(UserRole.school_admin)
  getSchoolEvent(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.getSchoolEventById(id, p.schoolId);
  }

  @Patch('school-events/:id')
  @Roles(UserRole.school_admin)
  updateSchoolEvent(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: UpdateAgendaSchoolEventDto,
  ) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.updateSchoolEvent(id, p.schoolId, dto);
  }

  @Delete('school-events/:id')
  @Roles(UserRole.school_admin)
  deleteSchoolEvent(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.deleteSchoolEvent(id, p.schoolId);
  }

  @Get('export/notes')
  @Roles(UserRole.teacher, UserRole.school_admin)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportNotesCsv(@CurrentUser() p: CurrentUserPayload, @Res({ passthrough: false }) res: Response) {
    const csv = await this.service.exportNotesCsv(p.userId);
    res.send(csv);
  }

  @Get('export/tasks')
  @Roles(UserRole.teacher, UserRole.school_admin)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportTasksCsv(@CurrentUser() p: CurrentUserPayload, @Res({ passthrough: false }) res: Response) {
    const csv = await this.service.exportTasksCsv(p.userId);
    res.send(csv);
  }

  @Get('summary')
  @Roles(UserRole.teacher, UserRole.school_admin)
  getSummary(@CurrentUser() p: CurrentUserPayload) {
    return this.service.getAgendaSummary(p.userId, p.schoolId ?? null);
  }

  @Get('calendar/ical')
  @Roles(UserRole.teacher, UserRole.school_admin)
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async getCalendarIcal(
    @CurrentUser() p: CurrentUserPayload,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const s = start || new Date().toISOString().slice(0, 10);
    const e = end || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const ical = await this.service.exportCalendarIcal(
      p.userId,
      p.schoolId ?? null,
      p.role as UserRole,
      s,
      e,
      p.user?.display_name ?? p.user?.email ?? 'Siz',
    );
    res.send(ical);
  }

  @Get('stats/weekly')
  @Roles(UserRole.teacher, UserRole.school_admin)
  getWeeklyStats(@CurrentUser() p: CurrentUserPayload) {
    return this.service.getWeeklyStats(p.userId);
  }

  @Get('search')
  @Roles(UserRole.teacher, UserRole.school_admin)
  search(
    @CurrentUser() p: CurrentUserPayload,
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.searchAll(p.userId, p.schoolId ?? null, q || '', limit ? Number(limit) : 10);
  }

  @Get('students')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listStudents(@CurrentUser() p: CurrentUserPayload) {
    if (!p.schoolId) return [];
    return this.service.listStudents(p.schoolId);
  }

  @Get('student-notes/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  getStudentNote(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.getStudentNoteById(id, p.userId);
  }

  @Post('student-notes')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createStudentNote(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateAgendaStudentNoteDto,
  ) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.createStudentNote(p.userId, p.schoolId, {
      ...dto,
      description: dto.description ?? undefined,
      subjectId: dto.subjectId ?? undefined,
      tags: dto.tags ?? undefined,
      privacyLevel: dto.privacyLevel ?? undefined,
    });
  }

  @Get('student-notes')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listStudentNotes(
    @CurrentUser() p: CurrentUserPayload,
    @Query('studentId') studentId?: string,
    @Query('noteType') noteType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listStudentNotes(p.userId, p.schoolId ?? null, {
      studentId,
      noteType,
      page,
      limit,
    });
  }

  @Post('parent-meetings')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createParentMeeting(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateAgendaParentMeetingDto,
  ) {
    if (!p.schoolId) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Okul gerekli.' });
    return this.service.createParentMeeting(p.userId, {
      ...dto,
      meetingType: dto.meetingType ?? undefined,
      subject: dto.subject ?? undefined,
      description: dto.description ?? undefined,
      followUpDate: dto.followUpDate ?? undefined,
    });
  }

  @Get('parent-meetings')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listParentMeetings(
    @CurrentUser() p: CurrentUserPayload,
    @Query('studentId') studentId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listParentMeetings(p.userId, p.schoolId ?? null, {
      studentId,
      start,
      end,
      page,
      limit,
    });
  }

  @Get('reminders')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listReminders(
    @CurrentUser() _p: CurrentUserPayload,
    @Query('noteId') noteId?: string,
    @Query('taskId') taskId?: string,
  ) {
    return this.service.listReminders({ noteId, taskId });
  }

  @Get('evaluation')
  @Roles(UserRole.teacher, UserRole.school_admin)
  getEvaluationData(
    @CurrentUser() p: CurrentUserPayload,
    @Query('listId') listId?: string,
    @Query('studentIds') studentIds?: string,
  ) {
    return this.service.getEvaluationData(
      p.userId,
      p.schoolId ?? null,
      listId,
      studentIds ? studentIds.split(',') : undefined,
    );
  }

  @Get('evaluation/criteria')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listCriteria(@CurrentUser() p: CurrentUserPayload) {
    return this.service.listCriteria(p.userId, p.schoolId ?? null);
  }

  @Post('evaluation/criteria')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createCriterion(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateCriterionDto) {
    return this.service.createCriterion(p.userId, p.schoolId ?? null, {
      name: dto.name,
      description: dto.description ?? undefined,
      maxScore: dto.maxScore ?? 5,
      scoreType: dto.scoreType ?? 'numeric',
      subjectId: dto.subjectId ?? undefined,
    });
  }

  @Patch('evaluation/criteria/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  updateCriterion(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: Partial<CreateCriterionDto> & { sortOrder?: number },
  ) {
    return this.service.updateCriterion(id, p.userId, {
      ...dto,
      description: dto.description ?? undefined,
      scoreType: dto.scoreType ?? undefined,
      subjectId: dto.subjectId ?? undefined,
    });
  }

  @Delete('evaluation/criteria/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  deleteCriterion(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.deleteCriterion(id, p.userId);
  }

  @Get('evaluation/lists')
  @Roles(UserRole.teacher, UserRole.school_admin)
  listStudentLists(@CurrentUser() p: CurrentUserPayload) {
    return this.service.listStudentLists(p.userId, p.schoolId ?? null);
  }

  @Post('evaluation/lists')
  @Roles(UserRole.teacher, UserRole.school_admin)
  createStudentList(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateStudentListDto) {
    return this.service.createStudentList(p.userId, p.schoolId ?? null, dto);
  }

  @Patch('evaluation/lists/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  updateStudentList(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: Partial<CreateStudentListDto>,
  ) {
    return this.service.updateStudentList(id, p.userId, dto);
  }

  @Delete('evaluation/lists/:id')
  @Roles(UserRole.teacher, UserRole.school_admin)
  deleteStudentList(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.service.deleteStudentList(id, p.userId);
  }

  @Post('evaluation/scores')
  @Roles(UserRole.teacher, UserRole.school_admin)
  addEvaluationScore(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateEvaluationScoreDto) {
    return this.service.addEvaluationScore(p.userId, p.schoolId ?? null, {
      ...dto,
      note: dto.note ?? undefined,
    });
  }

  @Post('platform-events')
  @Roles(UserRole.superadmin)
  createPlatformEvent(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateAgendaPlatformEventDto,
  ) {
    return this.service.createPlatformEvent(p.userId, dto);
  }
}
