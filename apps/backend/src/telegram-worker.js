import pg from 'pg';
import {writeFile} from 'node:fs/promises';
import {TelegramStore} from './services/telegram-store.js';
import {TelegramReminders} from './services/telegram-reminders.js';
import {telegramClientFromEnvironment} from './services/telegram-client.js';
import {calendarFromEnvironment} from './services/google-calendar.js';
import {PostgresStore} from './services/store.js';
const familyId=process.env.GOOGLE_CALENDAR_FAMILY_ID,botUsername=process.env.TELEGRAM_BOT_USERNAME,portal=process.env.PORTAL_URL;
if(!familyId||!botUsername||!/^https:\/\//.test(portal??'')||!process.env.DATABASE_URL)throw Error('Incomplete Telegram worker configuration');
// Optional: the Maison account (UUID) of the only person who receives the 17:30 probe alert.
const alertUser=process.env.TELEGRAM_ALERT_USER||null;
if(alertUser&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alertUser))throw Error('Invalid Telegram alert user');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const groceries=new PostgresStore(process.env.DATABASE_URL);
const reminders=new TelegramReminders({store:new TelegramStore(pool),familyId,botUsername,portal,calendar:calendarFromEnvironment(),client:telegramClientFromEnvironment(),groceries,alertUser:alertUser?.toLowerCase()??null});
const bot=await reminders.client.call('getMe',{});
if(bot.username!==botUsername||!bot.is_bot)throw Error('Telegram bot identity mismatch');
const webhook=await reminders.client.call('getWebhookInfo',{});
if(webhook.url)throw Error('Existing Telegram webhook must be reviewed before starting polling');
let stopping=false;
process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
while(!stopping) {
  try {await reminders.tick();await writeFile('/tmp/telegram-health',String(Date.now()));}
  catch {console.error('telegram_cycle_unavailable');}
  if(!stopping)await new Promise(r=>setTimeout(r,5000));
}
await pool.end();await groceries.close();
