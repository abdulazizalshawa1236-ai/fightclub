import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AdminGuard } from './guards';
import { IdentityService } from './identity.service';
import { actorOf, ActorRequest, SessionService } from './sessions';
@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
  ) {}
  @Post('admin/login') login(
    @Body() body: unknown,
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.identity.adminLogin(body, req.ip || 'unknown', res);
  }
  @Get('admin/me') @UseGuards(AdminGuard) me(@Req() req: ActorRequest) {
    return { username: actorOf(req).username };
  }
  @Post('admin/credentials') @UseGuards(AdminGuard) change(
    @Body() body: unknown,
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.identity.credentials(actorOf(req).id, body, res);
  }
  @Post('admin/logout') async logout(
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.revoke(req, res, 'admin');
    return { ok: true };
  }
  @Post('member/login') memberLogin(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.identity.memberLogin(body, req.ip || 'unknown');
  }
  @Post('member/verify') async verify(
    @Body() body: unknown,
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.identity.memberVerify(body, req.ip || 'unknown', res);
    return { ok: true };
  }
  @Post('member/logout') async memberLogout(
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessions.revoke(req, res, 'member');
    return { ok: true };
  }
}
