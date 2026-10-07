import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../identity/guards';
import { actorOf, type ActorRequest } from '../identity/sessions';
import { ScheduleService } from './schedule.service';
import { CommunicationsService } from './communications.service';
import { DatabaseService } from '../core/database';
import type { DashboardStats, ClassSession } from '@fightclub/shared';
import { MediaService } from './media.service';
@Controller('admin')
@UseGuards(AdminGuard)
export class OperationsController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly messages: CommunicationsService,
    private readonly media: MediaService,
    private readonly db: DatabaseService,
  ) {}
  @Get('stats') async stats(): Promise<DashboardStats> {
    const result = await this.db.query<{ status: string; total: string }>(
      `SELECT status,count(*)::text total FROM (SELECT CASE WHEN ms.suspended THEN 'suspended' WHEN ms.start_date>(now() AT TIME ZONE 'Asia/Riyadh')::date THEN 'upcoming' WHEN ms.end_date<(now() AT TIME ZONE 'Asia/Riyadh')::date THEN 'expired' WHEN ms.end_date-(now() AT TIME ZONE 'Asia/Riyadh')::date+1<=coalesce((s.data->>'warningDays')::integer,3) THEN 'expiring' ELSE 'active' END status FROM members m LEFT JOIN memberships ms ON ms.member_id=m.id AND ms.current LEFT JOIN site_settings s ON s.id=1 WHERE m.archived_at IS NULL) statuses GROUP BY status`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) counts[row.status] = Number(row.total);
    const classes = (
      await this.db.query<{ data: ClassSession }>(
        "SELECT data FROM classes WHERE data->>'date'=to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AND data->>'status'='scheduled' ORDER BY data->>'startTime'",
      )
    ).rows.map((x) => x.data);
    const messages = await this.messages.list();
    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      active: counts.active || 0,
      expiring: counts.expiring || 0,
      expired: counts.expired || 0,
      upcoming: counts.upcoming || 0,
      suspended: counts.suspended || 0,
      todayClasses: classes,
      recentMessages: messages.messages.slice(0, 10),
    };
  }
  @Get('classes') classes(@Query('month') month: string) {
    return this.schedule.list(month);
  }
  @Post('classes') create(@Body() input: unknown, @Req() req: ActorRequest) {
    return this.schedule.save(input, actorOf(req).id);
  }
  @Put('classes/:id') update(
    @Param('id') id: string,
    @Body() input: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.schedule.save(input, actorOf(req).id, id);
  }
  @Delete('classes/:id') async cancel(@Param('id') id: string, @Req() req: ActorRequest) {
    await this.schedule.cancel(id, actorOf(req).id);
    return { cancelled: true };
  }
  @Post('classes/copy') copy(@Body() input: unknown, @Req() req: ActorRequest) {
    return this.schedule.copy(input, actorOf(req).id);
  }
  @Get('messages') deliveries() {
    return this.messages.list();
  }
  @Post('announcements') announce(@Body() input: unknown, @Req() req: ActorRequest) {
    return this.messages.announce(input, actorOf(req).id);
  }
  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.media.upload(file);
  }
}
