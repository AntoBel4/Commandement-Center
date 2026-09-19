import {readFileSync} from 'node:fs';
export class TelegramError extends Error {
  constructor(code,retryAfter=0) {super(code);this.code=code;this.retryAfter=retryAfter;}
}
export class TelegramClient {
  constructor(token,fetcher=fetch) {
    if(!/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token))throw new Error('Invalid Telegram configuration');
    this.token=token;this.fetcher=fetcher;
  }
  async call(method,body) {
    let response,data;
    try {
      response=await this.fetcher('https://api.telegram.org/bot'+this.token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35000),redirect:'error'});
      data=await response.json();
    } catch {throw new TelegramError('TELEGRAM_UNKNOWN');}
    if(data.ok===true && response.ok)return data.result;
    if(data.error_code===429)throw new TelegramError('TELEGRAM_RETRY',Math.min(3600,Math.max(1,Number(data.parameters?.retry_after)||60)));
    if([400,401,403].includes(data.error_code))throw new TelegramError('TELEGRAM_REJECTED');
    throw new TelegramError('TELEGRAM_UNKNOWN');
  }
  async send(chatId,text) {
    const message=await this.call('sendMessage',{chat_id:chatId,text,link_preview_options:{is_disabled:true}});
    if(!Number.isSafeInteger(message?.message_id))throw new TelegramError('TELEGRAM_UNKNOWN');
    return message.message_id;
  }
}
export function telegramClientFromEnvironment() {
  return new TelegramClient(readFileSync(process.env.TELEGRAM_TOKEN_FILE,'utf8').trim());
}
