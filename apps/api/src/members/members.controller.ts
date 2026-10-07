import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminGuard, MemberGuard } from '../identity/guards';
import { actorOf, ActorRequest } from '../identity/sessions';
import { parse, uuidSchema } from '../core/validation';
import { MembersService } from './members.service';
@Controller('admin')
@UseGuards(AdminGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}
  @Get('members') list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.members.list(q, status, page ? Number(page) : 1);
  }
  @Get('members/export') async export(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fightclub-members.csv"');
    res.send(await this.members.export());
  }
  @Post('members') create(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.members.create(body, actorOf(req).id);
  }
  @Patch('members/:id') edit(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.members.edit(parse(uuidSchema, id), body, actorOf(req).id);
  }
  @Post('members/:id/renew') renew(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.members.renew(parse(uuidSchema, id), body, actorOf(req).id);
  }
  @Post('members/:id/status') status(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.members.status(parse(uuidSchema, id), body, actorOf(req).id);
  }
  @Delete('members/:id') async archive(@Param('id') id: string, @Req() req: ActorRequest) {
    await this.members.archive(parse(uuidSchema, id), actorOf(req).id);
    return { ok: true };
  }
  @Get('audit') audit(@Query('memberId') memberId?: string) {
    return this.members.audit(memberId ? parse(uuidSchema, memberId) : undefined);
  }
}
@Controller('member')
@UseGuards(MemberGuard)
export class MemberPortalController {
  constructor(private readonly members: MembersService) {}
  @Get('me') me(@Req() req: ActorRequest) {
    return this.members.dashboard(actorOf(req).id);
  }
  @Put('preferences') async preferences(@Body() body: unknown, @Req() req: ActorRequest) {
    await this.members.preferences(actorOf(req).id, body);
    return { ok: true };
  }
  @Post('announcements/read') async read(@Body() body: unknown, @Req() req: ActorRequest) {
    await this.members.readAnnouncements(actorOf(req).id, body);
    return { ok: true };
  }
}
