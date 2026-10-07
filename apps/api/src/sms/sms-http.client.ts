import { Injectable } from '@nestjs/common';
export interface SmsRequest {
  recipients: string[];
  body: string;
  sender: string;
}
@Injectable()
export class SmsHttpClient {
  post(payload: SmsRequest, bearer: string): Promise<Response> {
    return fetch('https://api.taqnyat.sa/v1/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
  }
}
