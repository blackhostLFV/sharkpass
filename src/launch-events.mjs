import {readFileSync,renameSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {AppError} from './store.mjs';

export const launchManifest=JSON.parse(readFileSync(new URL('../content/launch-events.json',import.meta.url),'utf8'));

// Private operations only. No HTTP route accepts an owner override or invokes this.
export function prepareLaunchEvents(store,ownerId,manifest=launchManifest){
 const owner=store.get('SELECT id,username FROM users WHERE id=?',ownerId);
 if(!owner)throw new AppError(404,'La cuenta propietaria debe existir.');
 store.requirePlatformAdmin(owner);
 if(manifest.batch!=='launch-preview-20261106')throw new AppError(400,'Lote desconocido.');
 const prepared=store.transaction(()=>{
  const organizations=new Map();
  for(const org of manifest.organizations){
   const matches=store.all('SELECT id FROM organizations WHERE owner_id=? AND name=?',ownerId,org.name);
   if(matches.length>1)throw new AppError(409,'Hay organizadores duplicados; revisar antes de preparar eventos.');
   const id=matches[0]?.id??org.id;
   if(!matches.length){
    if(store.get('SELECT id FROM organizations WHERE id=?',id))throw new AppError(409,'Identificador de organizador ocupado.');
    store.run('INSERT INTO organizations VALUES(?,?,?)',id,org.name,ownerId);
    store.run('INSERT INTO members VALUES(?,?,?)',id,ownerId,'owner');
   }
   store.org(owner,id,true);organizations.set(org.key,id);
  }
  return manifest.events.map(item=>{
   const marker=`${manifest.batch}:${item.key}`;
   const previous=store.get("SELECT target_id FROM platform_admin_audit WHERE action='launch_event_prepared' AND reason=?",marker);
   const organizationId=organizations.get(item.organization);
   if(!organizationId)throw new AppError(400,'Organizador no definido.');
   if(previous){
    const existing=store.event(owner,previous.target_id,true);
    if(existing.organization_id!==organizationId || Boolean(existing.is_demo)!==item.isDemo)throw new AppError(409,'La preparación previa no coincide con su propietario o ambiente.');
    return {id:existing.id,isDemo:item.isDemo,key:item.key};
   }
   if(store.get('SELECT id FROM events WHERE id=?',item.id))throw new AppError(409,'Identificador de evento ocupado.');
   const event=store._createEvent(owner,{...item,organizationId},item.id);
   for(const type of item.types)store.addType(owner,event.id,type);
   store.platformAudit(owner,'private-event-setup','launch_event_prepared',event.id,marker);
   return {id:event.id,isDemo:item.isDemo,key:item.key};
  });
 });
 // Use the same publishing rules as the organizer; commercial events stay draft.
 for(const item of prepared){
  const event=store.event(owner,item.id,true);
  const marker=`${manifest.batch}:${item.key}`;
  const published=store.get("SELECT id FROM platform_admin_audit WHERE action='launch_demo_published' AND target_id=? AND reason=?",item.id,marker);
  if(item.isDemo && !published && event.state==='draft'){
   store.setEventState(owner,item.id,'published');
   store.platformAudit(owner,'private-event-setup','launch_demo_published',item.id,marker);
  }
 }
 return prepared.map(item=>({id:item.id,key:item.key,state:store.event(owner,item.id,true).state,isDemo:item.isDemo}));
}

export function runEventSetupTask(store,taskPath=fileURLToPath(new URL('../ops/event-setup.json',import.meta.url)),manifest=launchManifest){
 const claimed=`${taskPath}.${process.pid}.running`;
 try{renameSync(taskPath,claimed);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 try{
  const task=JSON.parse(readFileSync(claimed,'utf8'));
  const keys=Object.keys(task).sort().join(',');
  if(task.batch!==launchManifest.batch || !['batch,ownerId','batch,ownerOrganizationId'].includes(keys))throw new Error('Invalid private event setup task.');
  const identifier=task.ownerId??task.ownerOrganizationId;
  if(!/^[a-f0-9-]{36}$/.test(identifier))throw new Error('Invalid private event setup identifier.');
  // Resolve an existing organizer privately; never create users or grant access.
  const ownerId=task.ownerId??store.get('SELECT owner_id FROM organizations WHERE id=?',identifier)?.owner_id;
  if(!ownerId)throw new Error('Existing organizer owner not found.');
  const events=prepareLaunchEvents(store,ownerId,manifest);
  unlinkSync(claimed);
  console.log(JSON.stringify({timestamp:new Date().toISOString(),level:'INFO',message:JSON.stringify({operation:'launch_events_prepared',events})}));
  return events;
 }catch(error){
  renameSync(claimed,`${taskPath}.failed`);
  console.error(JSON.stringify({timestamp:new Date().toISOString(),level:'ERROR',message:'Private event preparation failed; review the task privately.'}));
  return null;
 }
}
