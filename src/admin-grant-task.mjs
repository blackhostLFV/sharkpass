import {readFileSync,renameSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Private one-use deployment task. Never called by an HTTP request or public registration.
export function grantVerifiedAdmin(store,task){
 if(!task||Object.keys(task).sort().join(',')!=='email,id,reason')throw new Error('Invalid private admin task.');
 if(typeof task.id!=='string'||!/^[a-f0-9-]{36}$/.test(task.id))throw new Error('Invalid private task identifier.');
 const email=store.emailAddress(task.email);
 if(typeof task.reason!=='string'||task.reason.trim().length<12||task.reason.length>500)throw new Error('Invalid admin grant reason.');
 {
  if(store.get("SELECT id FROM platform_admin_audit WHERE action='admin_setup_consumed' AND target_id=?",task.id))return {status:'consumed',changed:false};
  // Persist consumption first: a crash cannot leave a future automatic grant.
  store.platformAudit(null,'private-admin-setup','admin_setup_consumed',task.id,'One-use private administrator setup consumed.');
  const candidate=store.get('SELECT l.user_id FROM login_emails l JOIN account_emails a ON a.user_id=l.user_id AND lower(a.email)=lower(l.email) WHERE l.email=? AND a.verified_at IS NOT NULL',email);
  if(!candidate){
   const login=store.get('SELECT user_id FROM login_emails WHERE email=?',email);
   const verified=store.get('SELECT user_id FROM account_emails WHERE lower(email)=? AND verified_at IS NOT NULL',email);
   return {status:'awaiting_verified_account',changed:false,reason:!login?'account_not_found':!verified?'email_not_verified':'account_email_mismatch'};
  }
  const result=store.provisionPlatformAdmin(candidate.user_id,'private-admin-setup',task.reason.trim());
  return {status:'active',changed:result.changed};
 }
}
export function runAdminGrantTask(store,taskPath=fileURLToPath(new URL('../ops/admin-grant.json',import.meta.url)),log=console.log){
 const claimed=`${taskPath}.${process.pid}.running`;
 try{renameSync(taskPath,claimed);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 let result;
 try{result=grantVerifiedAdmin(store,JSON.parse(readFileSync(claimed,'utf8')));}catch{result={status:'failed',changed:false};}
 // Consume even when waiting: a later registration never gains privileges automatically.
 unlinkSync(claimed);
 log(JSON.stringify({timestamp:new Date().toISOString(),level:result.status==='failed'?'ERROR':'INFO',message:JSON.stringify({operation:'verified_admin_setup',...result})}));
 return result;
}
