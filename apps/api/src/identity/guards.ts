import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ActorRequest, SessionService } from './sessions';
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.sessions.resolve(context.switchToHttp().getRequest<ActorRequest>(), 'admin');
    return true;
  }
}
@Injectable()
export class MemberGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.sessions.resolve(context.switchToHttp().getRequest<ActorRequest>(), 'member');
    return true;
  }
}
