import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../src/store.mjs';
import {launchManifest,prepareLaunchEvents,runEventSetupTask} from '../src/launch-events.mjs';
import {backupBeforeMigration} from '../src/migration-backup.mjs';
const password='test-launch-owner-password-2032';
const manifest=()=>{
 const value=structuredClone(launchManifest);
 value.events.forEach((event,index)=>event.startsAt=`2032-11-${18+index}T18:00:00-05:00`);
 return value;
};
function setup(){const store=new Store();const owner=store.register({username:'launch-owner',password});store.initializePlatformAdmin(owner.id);return {store,owner};}

test('launch preparation assigns the owner, publishes only identified demos, and is idempotent',()=>{
 const {store,owner}=setup();
 try{
  const results=prepareLaunchEvents(store,owner.id,manifest());
  assert.equal(results.length,launchManifest.events.length);assert.equal(store.events().length,launchManifest.events.filter(e=>e.isDemo).length);
  assert.equal(store.organizations(owner).length,2);
  assert.ok(store.all('SELECT owner_id FROM organizations').every(org=>org.owner_id===owner.id));
  for(const item of results){
   const event=store.event(owner,item.id,true);
   assert.equal(event.state,item.isDemo?'published':'draft');
   assert.equal(event.types.length,launchManifest.events.find(e=>e.key===item.key).types.length);
   assert.ok(event.image.startsWith('/media/'));assert.ok(event.category);
   if(!item.isDemo)assert.throws(()=>store.event(null,item.id),e=>e.status===404);
  }
  const before=store.platformAuditLog(owner).length;
  assert.deepEqual(prepareLaunchEvents(store,owner.id,manifest()),results);
  assert.equal(store.platformAuditLog(owner).length,before);
  assert.equal(store.all('SELECT * FROM ticket_types').length,launchManifest.events.reduce((sum,event)=>sum+event.types.length,0));
 }finally{store.close();}
});
test('private setup never grants access and rejects missing or non-admin owners before writing',()=>{
 const {store,owner}=setup();
 try{
  const other=store.register({username:'ordinary-buyer',password});
  assert.throws(()=>prepareLaunchEvents(store,other.id,manifest()),e=>e.status===403);
  assert.throws(()=>prepareLaunchEvents(store,randomUUID(),manifest()),e=>e.status===404);
  assert.equal(store.all('SELECT * FROM organizations').length,0);
  prepareLaunchEvents(store,owner.id,manifest());
  const real=store.managedEvents(owner).find(event=>!event.is_demo);
  assert.throws(()=>store.event(other,real.id,true),e=>e.status===403);
  assert.equal(store.isPlatformAdmin(other),false);
 }finally{store.close();}
});
test('a conflicting event rolls back new organizations and cannot overwrite another organizer',()=>{
 const {store,owner}=setup();
 try{
  const other=store.register({username:'other-organizer',password});
  const org=store.createOrganization(other,{name:'Foreign organizer'});
  const foreign=store.createEvent(other,{organizationId:org.id,title:'Other event',description:'Existing event must remain unchanged.',venue:'Other venue',startsAt:'2032-11-20T18:00:00-05:00'});
  const value=manifest();value.events[0].id=foreign.id;
  assert.throws(()=>prepareLaunchEvents(store,owner.id,value),e=>e.status===409);
  assert.equal(store.organizations(owner).length,0);
  assert.equal(store.all('SELECT * FROM events').length,1);
  assert.equal(store.event(other,foreign.id,true).title,'Other event');
 }finally{store.close();}
});
test('presentation fields are optional and reject remote or executable image paths atomically',()=>{
 const {store,owner}=setup();
 try{
  const org=store.createOrganization(owner,{name:'Presentation tests'});
  const input={organizationId:org.id,title:'Visual event',description:'A valid event with a visual cover.',venue:'Test location',startsAt:'2032-11-20T18:00:00-05:00'};
  for(const image of ['javascript:alert(1)','https://other.invalid/image.jpg','/media/../secret.jpg','/media/cover.svg'])assert.throws(()=>store.createEvent(owner,{...input,image}),e=>e.status===400);
  assert.equal(store.all('SELECT * FROM events').length,0);
  const plain=store.createEvent(owner,input);
  assert.equal(store.event(owner,plain.id,true).image,null);
  const visual=store.createEvent(owner,{...input,image:'/media/sharkcaribe-pitch-2026.jpg',category:'Emprendimiento'});
  assert.equal(store.event(owner,visual.id,true).category,'Emprendimiento');
 }finally{store.close();}
});
test('one-use private task consumes its file and the public batch contains no account IDs',()=>{
 const {store,owner}=setup();const folder=mkdtempSync(join(tmpdir(),'sharkpass-launch-task-'));const path=join(folder,'task.json');
 try{
  writeFileSync(path,JSON.stringify({batch:launchManifest.batch,ownerId:randomUUID()}),{mode:0o600});
  assert.equal(runEventSetupTask(store,path),null);assert.equal(existsSync(path),false);assert.equal(existsSync(path+'.failed'),true);
  assert.equal(store.all('SELECT * FROM events').length,0);
  assert.equal(runEventSetupTask(store,path),null);
  writeFileSync(path,JSON.stringify({batch:launchManifest.batch,ownerId:owner.id}),{mode:0o600});
  assert.equal(runEventSetupTask(store,path,manifest()).length,launchManifest.events.length);
  assert.equal(existsSync(path),false);
  writeFileSync(path,JSON.stringify({batch:launchManifest.batch,ownerId:owner.id}),{mode:0o600});
  assert.equal(runEventSetupTask(store,path,manifest()).length,launchManifest.events.length);
  assert.equal(store.all('SELECT * FROM events').length,launchManifest.events.length);
  assert.equal(JSON.stringify(launchManifest).includes(owner.id),false);
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});
test('presentation migration preserves existing events and backs up the previous schema',()=>{
 const folder=mkdtempSync(join(tmpdir(),'sharkpass-presentation-'));const path=join(folder,'db.sqlite');
 try{
  let store=new Store(path);const owner=store.register({username:'existing-owner',password});
  const org=store.createOrganization(owner,{name:'Existing org'});
  const event=store.createEvent(owner,{organizationId:org.id,title:'Existing event',description:'An existing event before the new presentation table.',venue:'Existing place',startsAt:'2032-11-20T18:00:00-05:00'});
  store.db.exec('DROP TABLE event_presentation');store.run('DELETE FROM schema_migrations WHERE name=?','202611060002_event_presentation.sql');store.close();
  const snapshot=backupBeforeMigration(path,'202611060002_event_presentation.sql');assert.ok(snapshot);
  const prior=new DatabaseSync(snapshot,{readOnly:true});assert.equal(prior.prepare('SELECT id FROM events WHERE id=?').get(event.id).id,event.id);assert.equal(prior.prepare("SELECT name FROM sqlite_master WHERE name='event_presentation'").get(),undefined);prior.close();
  store=new Store(path);assert.equal(store.event(owner,event.id,true).title,'Existing event');assert.equal(store.event(owner,event.id,true).image,null);store.close();
  assert.equal(backupBeforeMigration(path,'202611060002_event_presentation.sql'),null);
 }finally{rmSync(folder,{recursive:true,force:true});}
});

 test('private organizer resolution preserves ownership and rejects ordinary owners',()=>{
 const {store,owner}=setup();const folder=mkdtempSync(join(tmpdir(),'sharkpass-owner-task-'));const path=join(folder,'task.json');
 try{
  const org=store.createOrganization(owner,{name:launchManifest.organizations[0].name});
  writeFileSync(path,JSON.stringify({batch:launchManifest.batch,ownerOrganizationId:org.id}),{mode:0o600});
  const events=runEventSetupTask(store,path,manifest());assert.equal(events.length,launchManifest.events.length);
  assert.ok(store.all('SELECT owner_id FROM organizations').every(item=>item.owner_id===owner.id));
  assert.equal(store.event(owner,launchManifest.events.find(e=>!e.isDemo).id,true).state,'draft');
  const other=store.register({username:'non-admin-owner',password});const foreign=store.createOrganization(other,{name:'Ordinary organization'});
  const before=store.all('SELECT id FROM events').length;
  writeFileSync(path,JSON.stringify({batch:launchManifest.batch,ownerOrganizationId:foreign.id}),{mode:0o600});
  assert.equal(runEventSetupTask(store,path,manifest()),null);assert.equal(store.all('SELECT id FROM events').length,before);assert.equal(store.isPlatformAdmin(other),false);
 }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});
