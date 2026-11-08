import {AppError} from './store.mjs';
const fail=message=>{throw new AppError(400,message);};
const specs={
 events:{from:'events e JOIN organizations g ON g.id=e.organization_id',select:`e.id,e.title,e.venue,e.starts_at,e.state,e.is_demo,g.name AS organizer,(SELECT COALESCE(SUM(capacity),0) FROM ticket_types WHERE event_id=e.id) AS capacity,(SELECT COALESCE(SUM(quantity),0) FROM orders WHERE event_id=e.id AND state='confirmed') AS issued,(SELECT COUNT(*) FROM tickets t JOIN orders x ON x.id=t.order_id WHERE x.event_id=e.id AND t.status='used') AS used`,search:['e.id','e.title','e.venue','g.name'],state:'e.state',states:['draft','published','cancelled'],env:'e.is_demo',order:'e.starts_at DESC,e.id'},
 organizations:{from:'organizations g JOIN users u ON u.id=g.owner_id',select:`g.id,g.name,u.username AS owner,(SELECT COUNT(*) FROM events WHERE organization_id=g.id) AS events,(SELECT COUNT(*) FROM members WHERE organization_id=g.id AND role='scanner') AS scanners`,search:['g.id','g.name','u.username'],order:'g.name,g.id'},
 users:{from:'users u LEFT JOIN login_emails l ON l.user_id=u.id LEFT JOIN account_emails a ON a.user_id=u.id',select:`u.id,u.username,l.email,u.created_at,CASE WHEN a.email=l.email THEN 1 ELSE 0 END AS verified,EXISTS(SELECT 1 FROM platform_admins WHERE user_id=u.id) AS platformAdmin,(SELECT COUNT(*) FROM members WHERE user_id=u.id AND role='owner') AS ownerRoles,(SELECT COUNT(*) FROM members WHERE user_id=u.id AND role='scanner') AS scannerRoles,(SELECT COUNT(*) FROM sessions WHERE user_id=u.id AND expires_at>?) AS activeSessions`,selectParams:()=>[Date.now()],search:['u.id','u.username','l.email'],order:'u.created_at DESC,u.id'},
 orders:{from:'orders x JOIN events e ON e.id=x.event_id JOIN ticket_types t ON t.id=x.type_id JOIN users u ON u.id=x.user_id LEFT JOIN login_emails l ON l.user_id=u.id',select:'x.id,x.created_at,x.quantity,x.total_cop,x.state,e.title AS event,e.is_demo,t.name AS locality,u.username AS buyer',search:['x.id','e.title','t.name','u.username','l.email'],state:'x.state',states:['confirmed','cancelled'],env:'e.is_demo',order:'x.created_at DESC,x.id'},
 payments:{from:'payment_attempts p JOIN events e ON e.id=p.event_id JOIN users u ON u.id=p.user_id',select:'p.id,p.created_at,p.updated_at,p.expires_at,p.quantity,p.amount_cents/100 AS total_cop,p.state,p.environment,p.provider_id,p.order_id,e.title AS event,u.username AS buyer',search:['p.id','p.provider_id','p.order_id','e.title','u.username'],state:'p.state',states:['pending','confirmed','failed','expired','review','voided'],environment:'p.environment',order:'p.created_at DESC,p.id'},
 tickets:{from:'tickets t JOIN orders x ON x.id=t.order_id JOIN events e ON e.id=x.event_id JOIN ticket_types tt ON tt.id=x.type_id JOIN users u ON u.id=x.user_id LEFT JOIN users op ON op.id=t.used_by',select:'t.id,t.order_id,t.status,t.used_at,e.title AS event,e.is_demo,tt.name AS locality,u.username AS buyer,op.username AS operator',search:['t.id','t.order_id','e.title','u.username','op.username'],state:'t.status',states:['valid','used','void'],env:'e.is_demo',order:'x.created_at DESC,t.id'},
 mail:{from:'mail_outbox m LEFT JOIN payment_attempts p ON p.id=m.payment_id LEFT JOIN orders x ON x.id=COALESCE(m.order_id,p.order_id) JOIN events e ON e.id=COALESCE(x.event_id,p.event_id)',select:'m.id,m.state,m.attempts,m.next_at,m.sent_at,COALESCE(m.email,p.email) AS email,COALESCE(m.order_id,p.order_id) AS order_id,m.payment_id,e.title AS event,e.is_demo',search:['m.id','m.order_id','m.payment_id','m.email','p.email','e.title'],state:'m.state',states:['queued','sending','sent','attention'],env:'e.is_demo',order:'m.next_at DESC,m.id'},
 audit:{from:'platform_admin_audit a LEFT JOIN users u ON u.id=a.actor_id',select:'a.id,a.created_at,u.username AS actor,a.operator,a.action,a.target_id,a.reason',search:['a.id','u.username','a.operator','a.action','a.target_id','a.reason'],order:'a.created_at DESC,a.rowid DESC'}
};
export function adminConsole(store,user,input={}){
 store.requirePlatformAdmin(user);
 const section=input.section??'events',spec=specs[section];if(!Object.hasOwn(specs,section))fail('Sección no válida.');
 if(Object.keys(input).some(key=>!['section','q','state','environment','page'].includes(key)))fail('Filtro no válido.');
 const q=String(input.q??'').trim();if(q.length>100)fail('La búsqueda admite hasta 100 caracteres.');
 const state=input.state??'',environment=input.environment??'all';if(state&&!spec.states?.includes(state))fail('Estado no válido para esta sección.');if(!['all','test','prod'].includes(environment))fail('Ambiente no válido.');
 if(environment!=='all'&&!spec.env&&!spec.environment)fail('Esta sección no se filtra por ambiente.');
 const page=Number(input.page??1),pageSize=25;if(!Number.isSafeInteger(page)||page<1||page>10000)fail('Página no válida.');
 const where=[],params=[];
 if(q){where.push(`(${spec.search.map(field=>`COALESCE(${field},'') LIKE ?`).join(' OR ')})`);params.push(...spec.search.map(()=>`%${q}%`));}
 if(state){where.push(`${spec.state}=?`);params.push(state);}
 if(environment!=='all'){where.push(`${spec.env??spec.environment}=?`);params.push(spec.env?(environment==='test'?1:0):environment);}
 const clause=where.length?' WHERE '+where.join(' AND '):'';
 const total=store.get(`SELECT COUNT(*) AS n FROM ${spec.from}${clause}`,...params).n;
 const rows=store.all(`SELECT ${spec.select} FROM ${spec.from}${clause} ORDER BY ${spec.order} LIMIT ? OFFSET ?`,...(spec.selectParams?.()??[]),...params,pageSize,(page-1)*pageSize);
 return {section,rows,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize)),states:spec.states??[],environmentFilter:Boolean(spec.env||spec.environment)};
}
export function bogotaWindow(time){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));
 const value=type=>parts.find(part=>part.type===type).value;
 const day=`${value('year')}-${value('month')}-${value('day')}`,start=Date.parse(`${day}T00:00:00-05:00`);return {day,start,end:start+86400000};
}
export function adminDashboard(store,user,time=Date.now()){
 store.requirePlatformAdmin(user);const base=store.platformOverview(user),today=bogotaWindow(time);
 const financial=store.get(`SELECT COALESCE(SUM(CASE WHEN e.is_demo=0 THEN x.total_cop ELSE 0 END),0) AS commercialCop,COALESCE(SUM(CASE WHEN e.is_demo=1 THEN x.total_cop ELSE 0 END),0) AS demoCop FROM orders x JOIN events e ON e.id=x.event_id WHERE x.state='confirmed'`);
 const admissions=store.get(`SELECT COUNT(*) AS issued,COALESCE(SUM(status='valid'),0) AS valid,COALESCE(SUM(status='used'),0) AS used,COALESCE(SUM(status='void'),0) AS voided FROM tickets`);
 const todayUsed=store.get("SELECT COUNT(*) AS n FROM tickets WHERE status='used' AND used_at>=? AND used_at<?",new Date(today.start).toISOString(),new Date(today.end).toISOString()).n;
 const pending=store.get("SELECT COALESCE(SUM(state='pending'),0) AS pending,COALESCE(SUM(state='review'),0) AS review FROM payment_attempts");
 const mail=store.get("SELECT COALESCE(SUM(state='attention'),0) AS attention,COALESCE(SUM(state IN ('queued','sending')),0) AS pending FROM mail_outbox");
 const series=[];for(let offset=6;offset>=0;offset--){const start=today.start-offset*86400000,end=start+86400000;const row=store.get(`SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN e.is_demo=0 THEN x.total_cop ELSE 0 END),0) AS commercialCop,COALESCE(SUM(CASE WHEN e.is_demo=1 THEN x.total_cop ELSE 0 END),0) AS demoCop FROM orders x JOIN events e ON e.id=x.event_id WHERE x.state='confirmed' AND x.created_at>=? AND x.created_at<?`,new Date(start).toISOString(),new Date(end).toISOString());series.push({day:bogotaWindow(start).day,...row});}
 return {...base,financial,admissions,todayUsed,pending,mail,commercialDrafts:store.get("SELECT COUNT(*) AS n FROM events WHERE state='draft' AND is_demo=0").n,activeSessions:store.get('SELECT COUNT(*) AS n FROM sessions WHERE expires_at>?',time).n,series,asOf:new Date(time).toISOString()};
}
