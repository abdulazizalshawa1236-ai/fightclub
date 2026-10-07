import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseService } from '../core/database';
@Injectable()
export class MediaService {
  constructor(private readonly db: DatabaseService) {}
  async upload(file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file || file.size > 8 * 1024 * 1024)
      throw new BadRequestException('Upload an image smaller than 8 MB');
    const bucket = process.env.S3_BUCKET,
      base = process.env.MEDIA_PUBLIC_URL;
    if (
      !base ||
      (process.env.MEDIA_STORAGE !== 'local' &&
        (!bucket || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY))
    )
      throw new ServiceUnavailableException('Media storage is not configured');
    let image: Buffer, width: number | undefined, height: number | undefined;
    try {
      const pipeline = sharp(file.buffer, { limitInputPixels: 40000000, animated: false });
      const meta = await pipeline.metadata();
      if (!meta.format || !['jpeg', 'png', 'webp', 'avif'].includes(meta.format))
        throw new Error('Unsupported format');
      const result = await pipeline
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
      image = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new BadRequestException('Upload a valid JPEG, PNG, WebP or AVIF image');
    }
    const id = randomUUID(),
      key = `images/${id}.webp`,
      url = `${base.replace(/\/$/, '')}/${key}`;
    if (process.env.MEDIA_STORAGE === 'local') {
      if (process.env.NODE_ENV === 'production')
        throw new ServiceUnavailableException('Production media requires S3 object storage');
      const dir = resolve(process.env.MEDIA_DIRECTORY || '.runtime/media');
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(resolve(dir, `${id}.webp`), image, { flag: 'wx', mode: 0o600 });
      await this.db.query(
        'INSERT INTO media(id,object_key,url,mime,width,height) VALUES($1,$2,$3,$4,$5,$6)',
        [id, key, url, 'image/webp', width, height],
      );
      return { url };
    }
    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: image,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await this.db.query(
        'INSERT INTO media(id,object_key,url,mime,width,height) VALUES($1,$2,$3,$4,$5,$6)',
        [id, key, url, 'image/webp', width, height],
      );
      return { url };
    } finally {
      client.destroy();
    }
  }
}
