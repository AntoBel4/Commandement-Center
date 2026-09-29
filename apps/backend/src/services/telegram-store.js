export class TelegramStore {
  constructor(pool) { this.pool=pool; }
  async transaction(family,run) {
    const c=await this.pool.connect();
    try {
      await c.query('begin');
      await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",['telegram:'+family]);
      const {rows}=await c.query('select data from telegram_state where family_id=$1 for update',[family]);
      const members=(await c.query('select user_id from family_members where family_id=$1',[family])).rows.map(r=>r.user_id);
      const s=rows[0]?.data??{links:{},pairs:{},deliveries:{},offset:0};
      const result=await run(s,members);
      await c.query('insert into telegram_state(family_id,data) values($1,$2) on conflict(family_id) do update set data=$2',[family,s]);
      await c.query('commit');return result;
    } catch(e) {await c.query('rollback');throw e;} finally {c.release();}
  }
  async exclusive(family,run) {
    const c=await this.pool.connect();let locked=false;
    try {
      locked=(await c.query('select pg_try_advisory_lock(hashtextextended($1,0)) as ok',['telegram-worker:'+family])).rows[0].ok;
      if(locked)return await run();
    } finally {if(locked)await c.query('select pg_advisory_unlock(hashtextextended($1,0))',['telegram-worker:'+family]);c.release();}
  }
}
