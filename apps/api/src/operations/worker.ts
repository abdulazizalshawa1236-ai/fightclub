import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CommunicationsService } from './communications.service';
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(CommunicationsService);
  let running = true,
    lastExpiry = 0;
  process.once('SIGTERM', () => {
    running = false;
  });
  process.once('SIGINT', () => {
    running = false;
  });
  while (running) {
    try {
      await service.recover();
      if (Date.now() - lastExpiry > 60000) {
        await service.enqueueExpiry();
        lastExpiry = Date.now();
      }
      const sent = await service.dispatchOne();
      if (!sent) await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      process.stderr.write(
        JSON.stringify({
          event: 'worker.cycle.failed',
          message: error instanceof Error ? error.message : 'Unknown failure',
        }) + '\n',
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await app.close();
}
void main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
