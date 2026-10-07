import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
@Controller('media')
export class MediaController {
  @Get('images/:file') async image(
    @Param('file') file: string,
    @Res() response: Response,
  ): Promise<void> {
    if (
      process.env.MEDIA_STORAGE !== 'local' ||
      process.env.NODE_ENV === 'production' ||
      !/^([a-f0-9-]{36})\.webp$/.test(file)
    )
      throw new NotFoundException();
    const path = resolve(process.env.MEDIA_DIRECTORY || '.runtime/media', file);
    try {
      await access(path);
    } catch {
      throw new NotFoundException();
    }
    response
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .type('webp')
      .sendFile(path, { dotfiles: 'allow' });
  }
}
