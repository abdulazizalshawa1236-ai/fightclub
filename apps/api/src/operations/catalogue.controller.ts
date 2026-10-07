import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../identity/guards';
import { actorOf, type ActorRequest } from '../identity/sessions';
import { CatalogueService } from './catalogue.service';

@Controller('public')
export class PublicController {
  constructor(private readonly catalogue: CatalogueService) {}
  @Get('site') site() {
    return this.catalogue.site();
  }
  @Get('schedule') schedule(@Query('month') month: unknown) {
    return this.catalogue.schedule(month);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}
  @Get('site') site() {
    return this.catalogue.site(true);
  }
  @Put('settings') settings(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.settings(body, actorOf(req).id);
  }
  @Post('plans') createPlan(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.save('plans', null, body, actorOf(req).id);
  }
  @Put('plans/:id') updatePlan(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.catalogue.save('plans', id, body, actorOf(req).id);
  }
  @Delete('plans/:id') archivePlan(@Param('id') id: string, @Req() req: ActorRequest) {
    return this.catalogue.archive('plans', id, actorOf(req).id);
  }
  @Post('offers') createOffer(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.save('offers', null, body, actorOf(req).id);
  }
  @Put('offers/:id') updateOffer(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.catalogue.save('offers', id, body, actorOf(req).id);
  }
  @Delete('offers/:id') archiveOffer(@Param('id') id: string, @Req() req: ActorRequest) {
    return this.catalogue.archive('offers', id, actorOf(req).id);
  }
  @Post('coaches') createCoach(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.save('coaches', null, body, actorOf(req).id);
  }
  @Put('coaches/:id') updateCoach(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.catalogue.save('coaches', id, body, actorOf(req).id);
  }
  @Delete('coaches/:id') archiveCoach(@Param('id') id: string, @Req() req: ActorRequest) {
    return this.catalogue.archive('coaches', id, actorOf(req).id);
  }
  @Put('content') draft(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.draft(body, actorOf(req).id);
  }
  @Post('content/publish') publish(@Body() body: unknown, @Req() req: ActorRequest) {
    return this.catalogue.publish(body, actorOf(req).id);
  }
  @Get('content/history') history() {
    return this.catalogue.history();
  }
  @Post('content/restore/:revision') restore(
    @Param('revision') revision: string,
    @Body() body: unknown,
    @Req() req: ActorRequest,
  ) {
    return this.catalogue.restore(revision, body, actorOf(req).id);
  }
}
