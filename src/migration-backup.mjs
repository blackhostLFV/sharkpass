import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {backupDatabase} from './backup.mjs';
export function backupBeforeMigration(path, migration) {
  if (!path || path === ':memory:' || !existsSync(path)) return null;
  const db=new DatabaseSync(path,{readOnly:true});
  let applied=false;
  try {
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get())
      applied=Boolean(db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(migration));
  } finally {db.close();}
  if(applied)return null;
  const snapshot=backupDatabase(path);
  console.log('Pre-migration backup passed integrity and foreign key checks.');
  return snapshot;
}
