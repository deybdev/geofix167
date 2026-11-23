import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const { build } = require('esbuild');
const output = await build({entryPoints:[join(repoRoot,'server/src/index.ts')], absWorkingDir:repoRoot, bundle:true, platform:'node', format:'esm', write:false});
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE roles(role_id INTEGER, code TEXT); CREATE TABLE account_statuses(status_id INTEGER, status_code TEXT);
CREATE TABLE users(user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, mobile_number TEXT, role_id INTEGER, account_status_id INTEGER, password_hash TEXT);
CREATE TABLE user_sessions_and_devices(user_id TEXT, token_hash TEXT, expires_at TEXT, revoked_at TEXT);
INSERT INTO roles VALUES(1,'resident'),(2,'admin'); INSERT INTO account_statuses VALUES(1,'ACTIVE');
INSERT INTO users VALUES('a','A','Resident','1',1,1,NULL),('b','B','Resident','2',1,1,NULL),('admin','Staff','Admin','3',2,1,NULL);`);
sql.exec('CREATE TABLE auth_rate_limits (rate_limit_key TEXT NOT NULL, action TEXT NOT NULL, window_started_at TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, blocked_until TEXT, PRIMARY KEY (rate_limit_key, action))');
for (const file of ['0005_guest_incidents.sql','0006_review_alerts.sql','0007_dispatch_support.sql','0009_qr_handovers.sql','0012_community_audit.sql','0015_admin_dispatch.sql','0017_report_attachments.sql','0018_guest_report_intake.sql', '0019_resident_report_notifications.sql','0020_guest_report_location_metadata.sql','0021_guest_report_urgency.sql','0022_normalize_maintenance_categories.sql','0028_responder_dispatches.sql','0029_dispatch_coordinates.sql','0033_live_tracking.sql','0034_incident_report_snapshots.sql','0037_admin_notifications.sql']) sql.exec(readFileSync(join(repoRoot,'server/src/migrations',file),'utf8'));
const hash = async s => Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
for (const id of ['a','b','admin']) sql.prepare('INSERT INTO user_sessions_and_devices(user_id,token_hash,expires_at) VALUES(?,?,?)').run(id,await hash(id),'2099-01-01');
const db = {prepare(query) { const stmt = sql.prepare(query); let args=[]; return { bind(...v){args=v;return this}, async first(){return stmt.get(...args) ?? null}, async all(){return {results:stmt.all(...args)}}, async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}} }; }, async batch(statements){sql.exec('BEGIN');try {const results=[];for(const stmt of statements) results.push(await stmt.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const uploads = new Map();
const uploadBucket = {
  async put(key, value) { uploads.set(key, value); },
  async delete(key) { uploads.delete(key); },
};
const env = {geofix167_db:db,geofix167_uploads:uploadBucket,FRONTEND_ORIGIN:'http://localhost:5173',AUTH_HASH_SECRET:'integration-test-secret'};
const request = async (path, method='GET', body, cookie, token) => {
  const multipart = body instanceof FormData;
  const headers = {...(multipart ? {} : body ? {'Content-Type':'application/json'} : {}),...(cookie?{Cookie:`geofix_session=${cookie}`} : {}),...(token?{'X-Guest-Token':token}:{})};
  return app.request('/api/reports'+(path === '/' ? '' : path),{method, headers,...(body?{body:multipart?body:JSON.stringify(body)}:{})},env);
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOc8AAAAASUVORK5CYII=', 'base64');
const guestForm = (report, includePhoto=true) => {
  const form = new FormData();
  form.append('report', JSON.stringify(report));
  if (includePhoto) form.append('photos', new File([png], 'incident.png', {type:'image/png'}));
  return form;
};
const payload={reporter_type:'RESIDENT',incident_category:'Flood',description:'Saved report',reverse_geocoded_address:'Address',landmark_description:'Landmark'};
const emptyMap = await request('/map-feed');
assert.equal(emptyMap.status, 200);
assert.deepEqual(await emptyMap.json(), { items: [] });
const queryError = new Error('Simulated D1 failure');
const failedMap = await app.request('/api/reports/map-feed', {}, {
  ...env,
  geofix167_db: { prepare: () => ({ all: () => Promise.reject(queryError) }) },
});
assert.equal(failedMap.status, 500);
console.log('PASS public map feed returns an empty list on success and HTTP 500 on D1 failure');
const guestPayload={reporter_type:'GUEST',guest_alias:'Guest Reporter',title:'Flood report',classification:'sudden',is_emergency:1,incident_category:'Incident / Emergency',priority_level:'HIGH',description:'Saved report',reverse_geocoded_address:'Address',landmark_description:'Landmark'};
let res=await request('/','POST',payload,'a');assert.equal(res.status,201);const resident=(await res.json()).report;
assert.equal(resident.reported_by_user_id,'a');assert.equal(resident.guest_session_id,null);assert.equal(resident.latitude,null);assert.equal(resident.longitude,null);assert.equal(resident.location_description,'Address');
assert.equal((await request('/','POST',{...payload,reporter_user_id:'b'},'a')).status,403);
assert.equal((await request('/','POST',{...payload,reporter_type:'RESIDENT'})).status,401);
assert.equal((await request('/','POST',payload,'invalid')).status,401);
assert.equal((await request('/'+resident.incident_id)).status,404);
assert.equal((await request('/'+resident.incident_id,'GET',undefined,'b')).status,404);
assert.equal((await request('/'+resident.incident_id,'GET',undefined,'admin')).status,200);
res=await request('/','GET',undefined,'a');assert.equal((await res.json()).reports.length,1);
res=await request('/','GET',undefined,'b');assert.equal((await res.json()).reports.length,0);
assert.equal((await request('/')).status,401);
res=await request('/','POST',guestForm(guestPayload));assert.equal(res.status,201);const guest=(await res.json()).report;
assert.ok(guest.guest_access_token);assert.equal(guest.reported_by_user_id,null);
assert.equal((await request('/'+guest.incident_id,'GET',undefined,undefined,'wrong')).status,404);
res=await request('/'+guest.incident_id,'GET',undefined,undefined,guest.guest_access_token);assert.equal(res.status,200);const tracked=(await res.json()).report;assert.equal(tracked.location_description,'Address');assert.equal(tracked.guest_access_token,undefined);
const suddenIntake={...guestPayload,title:'Guest sudden report',guest_alias:'Sudden Reporter',latitude:14.7307,longitude:121.0138,accuracy_meters:7,within_barangay_boundary:1,reverse_geocoded_address:'Roxas Boulevard'};
const maintenanceIntake={...guestPayload,title:'Guest maintenance report',guest_alias:'Maintenance Reporter',classification:'maintenance',is_emergency:0,incident_category:'Drainage / Flooding',priority_level:'MEDIUM',latitude:14.7292,longitude:121.0161,accuracy_meters:28,within_barangay_boundary:0,reverse_geocoded_address:'Bonifacio Street'};
const suddenResponse=await request('/','POST',guestForm({...suddenIntake,description:''}));assert.equal(suddenResponse.status,201);const suddenBody=await suddenResponse.json();const suddenReport=suddenBody.report;
const maintenanceResponse=await request('/','POST',guestForm(maintenanceIntake));assert.equal(maintenanceResponse.status,201);const maintenanceReport=(await maintenanceResponse.json()).report;
assert.match(suddenReport.reference_number,/^GF-\d{3}$/);assert.equal(suddenReport.title,suddenIntake.title);assert.equal(suddenReport.classification,'sudden');assert.equal(suddenReport.priority_code,'P2');assert.equal(suddenReport.assigned_team,'BDRRMO Response');assert.equal(suddenReport.reporter_name,suddenIntake.guest_alias);assert.equal(suddenReport.latitude,suddenIntake.latitude);assert.equal(suddenReport.longitude,suddenIntake.longitude);assert.equal(suddenReport.accuracy_meters,7);assert.equal(suddenReport.location_description,'Roxas Boulevard');assert.equal(suddenReport.status_label,'Forwarded to BDRRMO');
assert.equal(maintenanceReport.classification,'maintenance');assert.equal(maintenanceReport.priority_code,'P3');assert.equal(maintenanceReport.assigned_team,'Maintenance Team A');assert.equal(maintenanceReport.within_barangay_boundary,0);
assert.match(suddenBody.tracking_url,/^http:\/\/localhost:5173\/track\/[A-Za-z0-9_-]{43}$/);
const trackingToken=new URL(suddenBody.tracking_url).pathname.split('/').at(-1);
assert.ok(trackingToken);
assert.equal(sql.prepare('SELECT count(*) AS n FROM tracking_links WHERE report_id=? AND token_hash=?').get(suddenReport.incident_id,trackingToken).n,0,'raw tracking tokens are never stored');
assert.equal(sql.prepare('SELECT count(*) AS n FROM tracking_links WHERE report_id=? AND length(token_hash)=64').get(suddenReport.incident_id).n,1);
const trackingRequest=async (method='GET',body,account='')=>app.request(`/api/track/${trackingToken}/status`,{method,headers:{...(account?{Cookie:`geofix_session=${account}`}:{})}},env);
let publicTracking=await trackingRequest();assert.equal(publicTracking.status,200);assert.equal(publicTracking.headers.get('Cache-Control'),'no-store, private');
let publicTrackingBody=await publicTracking.json();assert.equal(publicTrackingBody.status_label,'Forwarded to BDRRMO');assert.equal(publicTrackingBody.timeline[0].label,'Report received');assert.deepEqual(Object.keys(publicTrackingBody).sort(),['eta_minutes','incident_location','responder','responder_location','status_label','timeline']);
assert.equal('reporter_name' in publicTrackingBody,false);assert.equal('photos' in publicTrackingBody,false);
const adminIntakes=await request('/','GET',undefined,'admin');assert.equal(adminIntakes.status,200);const adminRows=(await adminIntakes.json()).reports;
for(const expected of [suddenReport,maintenanceReport]) { const row=adminRows.find((item)=>item.incident_id===expected.incident_id);assert.ok(row);assert.equal(row.reference_number,expected.reference_number);assert.equal(row.title,expected.title);assert.equal(row.reporter_name,expected.reporter_name);assert.ok(row.location_description);assert.ok(row.submitted_at);assert.ok(row.assigned_team);assert.equal(row.accuracy_meters,expected.accuracy_meters); }
assert.equal((await request('/','POST',{...suddenIntake,title:''})).status,400);
assert.equal((await request('/','POST',{...suddenIntake,incident_category:'Made Up Category'})).status,400);
assert.equal((await request('/','POST',{...suddenIntake,priority_level:'URGENT'})).status,400);
assert.equal((await request('/','POST',guestForm({...maintenanceIntake,description:''}))).status,400);
assert.equal((await request('/','POST',guestForm(suddenIntake,false))).status,400);
console.log('PASS guest intake: both classifications, admin fields, coordinates, boundary flag and server validation');
sql.prepare('UPDATE guest_sessions SET ended_at = ? WHERE guest_session_id = ?').run('2026-01-01',guest.guest_session_id);
assert.equal((await request('/'+guest.incident_id,'GET',undefined,undefined,guest.guest_access_token)).status,404);
res=await request('/public');assert.deepEqual((await res.json()).reports,[]);
sql.prepare('INSERT INTO community_feed_posts(community_feed_post_id,title,body,published_by_user_id,published_at) VALUES(?,?,?,?,?)').run('post','Public title','Approved summary','admin','2020-01-01');
res=await request('/public');assert.deepEqual(Object.keys((await res.json()).reports[0]).sort(),['description','id','published_at','title']);
console.log('PASS reporting HTTP integration: identity, ownership, guest credentials, privacy, persisted location and NULL coordinates');



const patch = (id, body, cookie, token, status=false) => request('/'+id+(status?'/status':''),'PATCH',body,cookie,token);
const transition = (id,status,cookie='admin') => patch(id,{status_id:status},cookie,undefined,true);
const create = async (body=payload,cookie='a',token) => {
  const requestBody = body?.reporter_type === 'GUEST' ? guestForm(body) : body;
  const response=await request('/','POST',requestBody,cookie,token);
  assert.ok([200,201].includes(response.status), await response.clone().text());
  return {status:response.status,...await response.json()};
};
const replayBody={...payload,callback_contact:' 09123456789 ',idempotency_key:'same-key'};
const first=await create(replayBody);
const second=await create(replayBody);
assert.equal(second.status,200);assert.equal(second.idempotent_replay,true);
assert.equal(second.report.incident_id,first.report.incident_id);assert.equal(second.status_events,undefined);
assert.equal(second.report.callback_mobile_number,'09123456789');assert.equal(second.report.status_events.length,1);
assert.notEqual((await create(replayBody,'b')).report.incident_id,first.report.incident_id);
const guestCreated=await create({...maintenanceIntake,idempotency_key:'guest-key'},null);
const guestReplay=await create({...guestPayload,idempotency_key:'guest-key',guest_session_id:guestCreated.report.guest_session_id},null,guestCreated.report.guest_access_token);
assert.equal(guestReplay.status,200);assert.equal(guestReplay.report.incident_id,guestCreated.report.incident_id);
assert.equal(guestReplay.report.guest_access_token,undefined);
assert.equal((await request('/','POST',{...guestPayload,guest_session_id:guestCreated.report.guest_session_id,idempotency_key:'guest-key'})).status,401);
assert.equal(sql.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='REPORT_CREATED' AND incident_id=?").get(first.report.incident_id).n,1);
assert.equal((await patch(resident.incident_id,{},'a')).status,400);
assert.equal((await patch(resident.incident_id,{priority_code:'P9'},'admin')).status,400);
assert.equal((await patch(resident.incident_id,{reported_by_user_id:'b'},'admin')).status,400);
assert.equal((await patch(resident.incident_id,{location_description:'Other'},'b')).status,404);
assert.equal((await patch(resident.incident_id,{category:'Forbidden'},'a')).status,403);
assert.equal((await patch(resident.incident_id,{location_description:'Updated'},'a')).status,200);
assert.equal((await patch(resident.incident_id,{category:'Fire'},'admin')).status,200);
let row=sql.prepare('SELECT * FROM incident_reports WHERE incident_id=?').get(resident.incident_id);
assert.equal(row.title,'Fire Incident Report');
const audits=sql.prepare("SELECT * FROM audit_logs WHERE action='REPORT_DETAILS_UPDATED' AND incident_id=?").all(resident.incident_id);
assert.equal(audits.length,2);assert.ok(audits.some(a=>JSON.parse(a.metadata_json).title==='Fire Incident Report'));
assert.equal((await transition(resident.incident_id,10)).status,409);
assert.equal((await transition(resident.incident_id,2,'a')).status,403);
assert.equal((await transition(resident.incident_id,999)).status,400);
assert.equal((await transition(resident.incident_id,4)).status,200);
assert.equal((await patch(resident.incident_id,{location_description:'Too late'},'a')).status,409);
assert.equal((await transition(resident.incident_id,6)).status,409);
assert.equal((await transition(resident.incident_id,13)).status,409);
sql.exec("INSERT INTO roles VALUES(3,'tanod'),(4,'bdrrmo'); INSERT INTO users VALUES('tanod','T','T','4',3,1,NULL),('bdrrmo','D','D','5',4,1,NULL)");
for(const id of ['tanod','bdrrmo']) sql.prepare('INSERT INTO user_sessions_and_devices(user_id,token_hash,expires_at) VALUES(?,?,?)').run(id,await hash(id),'2099-01-01');
assert.equal((await request('/'+resident.incident_id,'GET',undefined,'bdrrmo')).status,200);
assert.equal((await request('/'+resident.incident_id,'GET',undefined,'tanod')).status,404);
sql.exec("INSERT INTO responder_resources(responder_resource_id,resource_type,display_name,availability_status) VALUES('unit','TANOD','Unit','BUSY'),('tracking-unit','TANOD','Tracking Unit','BUSY')");
const emergencyVerified=await app.request(`/api/admin/dispatch/reports/${suddenReport.incident_id}/verify`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:'geofix_session=admin'},body:JSON.stringify({decision:'VERIFIED'})},env);
assert.equal(emergencyVerified.status,409);
sql.prepare('INSERT INTO tanod_assignments(tanod_assignment_id,incident_id,tanod_user_id,responder_resource_id,assignment_status_id,assigned_by_user_id) VALUES(?,?,?,?,?,?)')
  .run('tracking-assignment',suddenReport.incident_id,'tanod','tracking-unit',1,'bdrrmo');
const acceptedTracking=await app.request('/api/responder/dispatches/tracking-assignment/status',{method:'PATCH',headers:{'Content-Type':'application/json',Cookie:'geofix_session=tanod'},body:JSON.stringify({status:'ACCEPTED'})},env);
assert.equal(acceptedTracking.status,200);
const locationUpdate=await app.request('/api/responder/location',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'geofix_session=tanod'},body:JSON.stringify({assignment_id:'tracking-assignment',lat:14.731, lng:121.014, accuracy:9, heading:135})},env);
assert.equal(locationUpdate.status,200);
publicTracking=await trackingRequest();assert.equal(publicTracking.status,200);publicTrackingBody=await publicTracking.json();
assert.equal(publicTrackingBody.status_label,'Accepted');assert.deepEqual(publicTrackingBody.responder,{first_name:'T',unit_name:'Tracking Unit'});
assert.deepEqual(publicTrackingBody.responder_location,{lat:14.731,lng:121.014,accuracy:9,heading:135,updated_at:publicTrackingBody.responder_location.updated_at});
assert.ok(publicTrackingBody.eta_minutes >= 1);
const assign=(aid,id,status=1)=>sql.prepare('INSERT INTO tanod_assignments(tanod_assignment_id,incident_id,tanod_user_id,assignment_status_id,assigned_by_user_id,responder_resource_id) VALUES(?,?,?,?,?,?)').run(aid,id,'tanod',status,'admin','unit');
assign('assigned',resident.incident_id);
assert.equal((await request('/'+resident.incident_id,'GET',undefined,'tanod')).status,200);
assert.ok((await (await request('/','GET',undefined,'tanod')).json()).reports.some(r=>r.incident_id===resident.incident_id));
assert.equal((await transition(resident.incident_id,13,'tanod')).status,403);
assert.equal((await transition(resident.incident_id,13,'bdrrmo')).status,200);
sql.exec("UPDATE tanod_assignments SET assignment_status_id=2 WHERE tanod_assignment_id='assigned'");
assert.equal((await transition(resident.incident_id,7,'tanod')).status,200);
assert.equal((await transition(resident.incident_id,10,'tanod')).status,403);
assert.equal((await transition(resident.incident_id,8,'tanod')).status,200);
const other=await create();assign('other',other.report.incident_id,2);
assert.equal((await transition(resident.incident_id,10)).status,200);
row=sql.prepare("SELECT * FROM tanod_assignments WHERE tanod_assignment_id='assigned'").get();assert.equal(row.assignment_status_id,6);assert.ok(row.completed_at);
assert.equal(sql.prepare("SELECT availability_status FROM responder_resources WHERE responder_resource_id='unit'").get().availability_status,'BUSY');
assert.equal(sql.prepare("SELECT count(*) n FROM tanod_assignment_events WHERE tanod_assignment_id='assigned' AND assignment_status_id=6 AND note='Incident closed'").get().n,1);
assert.equal((await transition(other.report.incident_id,11)).status,200);
assert.equal(sql.prepare("SELECT availability_status FROM responder_resources WHERE responder_resource_id='unit'").get().availability_status,'AVAILABLE');
assert.equal((await transition(resident.incident_id,2,'tanod')).status,403);
assert.equal((await transition(resident.incident_id,2,'bdrrmo')).status,200);
assert.equal(sql.prepare('SELECT closed_at FROM incident_reports WHERE incident_id=?').get(resident.incident_id).closed_at,null);
assert.equal((await transition(suddenReport.incident_id,9,"bdrrmo")).status,200);
const resolvedTrack=await app.request(`/api/reports/${suddenReport.incident_id}/resolve`,{method:'POST',headers:{Cookie:'geofix_session=admin'}},env);
assert.equal(resolvedTrack.status,200);
const resolvedBody=await resolvedTrack.json();
assert.equal(resolvedBody.snapshot.incident.id,suddenReport.reference_number);
assert.equal(resolvedBody.snapshot.incident.title,suddenReport.title);
assert.equal(resolvedBody.snapshot.incident.category,suddenReport.category);
assert.equal(resolvedBody.snapshot.incident.reporter.name,suddenIntake.guest_alias);
assert.equal(resolvedBody.snapshot.incident.reporter.type,'Guest');
assert.equal(resolvedBody.snapshot.incident.location.address,suddenIntake.reverse_geocoded_address);
assert.equal(resolvedBody.snapshot.incident.status,'Resolved');
assert.ok(resolvedBody.snapshot.generated_at);
assert.ok(resolvedBody.snapshot.incident.timestamps.resolved_at);
assert.ok(resolvedBody.snapshot.media.length > 0);
const snapshotAgain=await request('/'+suddenReport.incident_id+'/report-snapshot','GET',undefined,'admin');
assert.equal(snapshotAgain.status,200);
assert.deepEqual((await snapshotAgain.json()).snapshot,resolvedBody.snapshot,'repeat reads return the immutable snapshot');
assert.equal((await request('/'+suddenReport.incident_id+'/report-snapshot','GET',undefined,'a')).status,403,'non-admins cannot read printable snapshots');
assert.equal((await request('/'+maintenanceReport.incident_id+'/report-snapshot','GET',undefined,'admin')).status,409,'open reports have no printable closure snapshot');
assert.throws(() => sql.prepare('UPDATE incident_report_snapshots SET snapshot_json=? WHERE incident_id=?').run('{}',suddenReport.incident_id),/immutable/);
assert.equal(sql.prepare('SELECT count(*) n FROM responder_locations WHERE assignment_id=?').get('tracking-assignment').n,0);
publicTracking=await trackingRequest();assert.equal(publicTracking.status,410);assert.equal((await publicTracking.json()).message,'This incident has been resolved. This tracking link has expired.');
const responderClosedReport=(await create({...maintenanceIntake,title:'Responder closed report'},null)).report;
sql.prepare('UPDATE incident_reports SET incident_status_id=5 WHERE incident_id=?').run(responderClosedReport.incident_id);
sql.prepare(`INSERT INTO responder_dispatches(responder_dispatch_id,incident_id,incident_title,incident_category,dispatched_by_user_id,target_role,urgency)
  VALUES(?,?,?,?,?,'bdrrmo','Medium')`)
  .run('completion-assignment',responderClosedReport.incident_id,responderClosedReport.title,responderClosedReport.category,'admin');
const responderCompleted=await app.request('/api/responder/dispatches/completion-assignment/status',{method:'PATCH',headers:{'Content-Type':'application/json',Cookie:'geofix_session=bdrrmo'},body:JSON.stringify({status:'COMPLETED'})},env);
assert.equal(responderCompleted.status,200);
const responderSnapshot=await request('/'+responderClosedReport.incident_id+'/report-snapshot','GET',undefined,'admin');
assert.equal(responderSnapshot.status,200);
assert.equal((await responderSnapshot.json()).snapshot.incident.status,'Resolved');
assert.ok(sql.prepare('SELECT closed_at FROM incident_reports WHERE incident_id=?').get(responderClosedReport.incident_id).closed_at);
assert.equal((await patch(guestCreated.report.incident_id,{location_description:'Guest update'},undefined,guestCreated.report.guest_access_token)).status,200);
assert.equal((await patch(guestCreated.report.incident_id,{priority_code:'P1'},undefined,guestCreated.report.guest_access_token)).status,403);
assert.equal((await transition(guestCreated.report.incident_id,4)).status,200);
assert.equal((await patch(guestCreated.report.incident_id,{description_sanitized:'Late'},undefined,guestCreated.report.guest_access_token)).status,409);
sql.prepare("UPDATE user_sessions_and_devices SET revoked_at=datetime('now') WHERE user_id='a'").run();
assert.equal((await request('/','GET',undefined,'a')).status,401);
assert.equal((await request('/','POST',payload,'a')).status,401);
console.log('PASS integration gaps: callback, scoped replay, read assignments, transitions, closure release, stage restrictions, title/audit sync and revocation');

// Exercise all permitted/rejected edges, not just the happy path.
const edgeReport=(await create(payload,'admin')).report;
assign('edge',edgeReport.incident_id,2);
const edges={1:[2,3,4,11,12],2:[3,4,11,12],3:[2,4,11],4:[5,6,13,14,11,12],5:[6,13,14,10],
  13:[6,7,8,14,10],14:[6,7,8,9,10],6:[7,8,9,10],7:[8,9,10],8:[9,10],9:[8,10],10:[2,4],11:[2,4],12:[2,4]};
for(const [from, allowed] of Object.entries(edges)) for(let to=1;to<=14;to++) {
  sql.prepare('UPDATE incident_reports SET incident_status_id=?, closed_at=NULL WHERE incident_id=?').run(Number(from),edgeReport.incident_id);
  sql.exec("UPDATE tanod_assignments SET assignment_status_id=2, completed_at=NULL WHERE tanod_assignment_id='edge'");
  const response=await transition(edgeReport.incident_id,to);
  assert.equal(response.status,allowed.includes(to)?200:409,`${from} -> ${to}`);
}
const repoOutput=await build({entryPoints:[join(repoRoot,'server/src/repositories/report.repository.ts')],absWorkingDir:repoRoot,bundle:true,platform:'node',format:'esm',write:false});
const repo=await import(`data:text/javascript;base64,${Buffer.from(repoOutput.outputFiles[0].text).toString('base64')}`);
sql.prepare('UPDATE incident_reports SET incident_status_id=4 WHERE incident_id=?').run(edgeReport.incident_id);
sql.exec("UPDATE tanod_assignments SET assignment_status_id=2, completed_at=NULL WHERE tanod_assignment_id='edge'");
const eventCount=sql.prepare('SELECT count(*) n FROM incident_status_events').get().n;
const notificationCount=sql.prepare('SELECT count(*) n FROM resident_notifications').get().n;
assert.equal(await repo.updateIncidentReportStatus(db,edgeReport.incident_id,1,10,true,'admin'),false);
assert.equal(sql.prepare('SELECT count(*) n FROM resident_notifications').get().n,notificationCount);
assert.equal(sql.prepare('SELECT count(*) n FROM incident_status_events').get().n,eventCount);
assert.equal(sql.prepare("SELECT assignment_status_id FROM tanod_assignments WHERE tanod_assignment_id='edge'").get().assignment_status_id,2);
sql.exec("CREATE TEMP TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.action='REPORT_DETAILS_UPDATED' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");
const originalTitle=sql.prepare('SELECT title FROM incident_reports WHERE incident_id=?').get(edgeReport.incident_id).title;
await assert.rejects(repo.updateIncidentReportDetails(db,edgeReport.incident_id,{category:'Rollback'},true,'admin'),/test audit failure/);
assert.equal(sql.prepare('SELECT title FROM incident_reports WHERE incident_id=?').get(edgeReport.incident_id).title,originalTitle);
sql.exec('DROP TRIGGER fail_audit');
console.log('PASS all 196 status edges, stale-update isolation, and transactional detail-audit rollback');

// Mobile requests carry a session token in Authorization, with no browser cookie.
// Use real session hashing/lookup, controllers, ownership checks and SQLite writes.
const mobileTokens = { a: crypto.randomUUID(), b: crypto.randomUUID(), expired: crypto.randomUUID(), revoked: crypto.randomUUID() };
for (const [kind, token] of Object.entries(mobileTokens)) {
  sql.prepare('INSERT INTO user_sessions_and_devices(user_id,token_hash,expires_at,revoked_at) VALUES(?,?,?,?)')
    .run(kind === 'b' ? 'b' : 'a', await hash(token), kind === 'expired' ? '2000-01-01' : '2099-01-01', kind === 'revoked' ? '2020-01-01' : null);
}
const mobileEnv = { ...env, MEDIA_SIGNING_SECRET: 'mobile-test-signing-secret-at-least-32-characters' };
const mobileRequest = (path, method = 'GET', body, token = mobileTokens.a, cookie) => {
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (cookie) headers.set('Cookie', `geofix_session=${cookie}`);
  const multipart = body instanceof FormData;
  if (body && !multipart) headers.set('Content-Type', 'application/json');
  return app.request('/api/reports' + path, {
    method, headers, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
  }, mobileEnv);
};
const mobilePhoto = (uploadId = crypto.randomUUID()) => {
  const form = new FormData();
  form.append('file', new File([png], 'mobile.png', { type: 'image/png' }));
  form.append('upload_id', uploadId);
  return form;
};
const mobileReports = [];
for (const emergency of [0, 1]) {
  const input = { ...payload, is_emergency: emergency, incident_category: emergency ? 'fire' : 'drainage', priority_level: 'CRITICAL', idempotency_key: crypto.randomUUID() };
  const response = await mobileRequest('', 'POST', input);
  assert.equal(response.status, 201, `Bearer-only ${emergency ? 'emergency' : 'regular'} creation`);
  const created = await response.json();
  const report = created.report;
  assert.equal(report.reported_by_user_id, 'a');
  assert.equal(report.guest_session_id, null);
  assert.equal(report.is_emergency, emergency);
  assert.equal(report.priority_code, emergency ? 'P1' : 'P2');
  assert.equal(sql.prepare('SELECT count(*) n FROM tracking_links WHERE report_id=?').get(report.incident_id).n, emergency);
  assert.equal(Boolean(created.tracking_url), Boolean(emergency));
  const replay = await mobileRequest('', 'POST', input);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).report.incident_id, report.incident_id);
  mobileReports.push(report);
}
const mobileId = mobileReports[0].incident_id;
let mobileResponse = await mobileRequest('');
assert.equal(mobileResponse.status, 200);
const ownReports = (await mobileResponse.json()).reports;
assert.ok(ownReports.every(report => report.reported_by_user_id === 'a'));
assert.ok(mobileReports.every(report => ownReports.some(own => own.incident_id === report.incident_id)));
assert.equal((await mobileRequest('/' + mobileId)).status, 200);
for (const status of [1, 2, 3]) {
  sql.prepare('UPDATE incident_reports SET incident_status_id=? WHERE incident_id=?').run(status, mobileId);
  const response = await mobileRequest('/' + mobileId, 'PATCH', { description_sanitized: `Mobile edit ${status}`, location_description: 'Updated mobile location' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).report.description_sanitized, `Mobile edit ${status}`);
}
assert.equal((await mobileRequest('/' + mobileId, 'PATCH', { priority_code: 'P4' })).status, 403);
assert.equal((await mobileRequest('/' + mobileId + '/status', 'PATCH', { status_id: 4 })).status, 403);
sql.prepare('UPDATE incident_reports SET incident_status_id=4 WHERE incident_id=?').run(mobileId);
assert.equal((await mobileRequest('/' + mobileId, 'PATCH', { description_sanitized: 'Too late' })).status, 409);
sql.prepare('UPDATE incident_reports SET incident_status_id=1 WHERE incident_id=?').run(mobileId);

const mobileUploadId = crypto.randomUUID();
assert.equal((await mobileRequest('/' + mobileId + '/attachments', 'POST', mobilePhoto(mobileUploadId))).status, 201);
assert.equal((await mobileRequest('/' + mobileId + '/attachments', 'POST', mobilePhoto(mobileUploadId))).status, 200);
mobileResponse = await mobileRequest('/' + mobileId + '/attachments');
assert.equal(mobileResponse.status, 200);
const mobileAttachments = (await mobileResponse.json()).attachments;
assert.equal(mobileAttachments.length, 1);
assert.equal(mobileAttachments[0].upload_id, mobileUploadId);
const mobileMediaRow = sql.prepare('SELECT * FROM incident_media WHERE incident_id=?').get(mobileId);
assert.equal(mobileMediaRow.uploaded_by_user_id, 'a');
assert.equal(mobileMediaRow.byte_size, png.length);
assert.deepEqual(Buffer.from(uploads.get(mobileMediaRow.storage_key)), png);

// A different resident cannot read, edit or attach evidence to this report.
for (const [path, method, body] of [
  ['/' + mobileId, 'GET'], ['/' + mobileId, 'PATCH', { description_sanitized: 'Not mine' }],
  ['/' + mobileId + '/attachments', 'GET'], ['/' + mobileId + '/attachments', 'POST', mobilePhoto()],
]) assert.equal((await mobileRequest(path, method, body, mobileTokens.b)).status, 404);
const otherReports = await (await mobileRequest('', 'GET', undefined, mobileTokens.b)).json();
assert.ok(otherReports.reports.every(report => report.reported_by_user_id === 'b'));
assert.ok(!otherReports.reports.some(report => report.incident_id === mobileId));
assert.equal((await mobileRequest('', 'POST', { ...payload, reporter_user_id: 'b' })).status, 403);

const countBeforeInvalid = sql.prepare('SELECT count(*) n FROM incident_reports').get().n;
for (const token of ['invalid-mobile-token', mobileTokens.expired, mobileTokens.revoked]) {
  for (const [path, method, body] of [
    ['', 'POST', payload], ['', 'GET'], ['/' + mobileId, 'GET'],
    ['/' + mobileId, 'PATCH', { description_sanitized: 'Rejected' }],
    ['/' + mobileId + '/attachments', 'GET'], ['/' + mobileId + '/attachments', 'POST', mobilePhoto()],
  ]) assert.equal((await mobileRequest(path, method, body, token)).status, 401);
}
assert.equal(sql.prepare('SELECT count(*) n FROM incident_reports').get().n, countBeforeInvalid);
// Keep the verifier's Bearer precedence even when a stale/different cookie exists.
assert.equal((await mobileRequest('/' + mobileId, 'GET', undefined, mobileTokens.a, 'b')).status, 200);
assert.equal((await mobileRequest('', 'GET', undefined, 'invalid-mobile-token', 'b')).status, 401);
assert.equal((await request('/', 'GET', undefined, 'b')).status, 200);
assert.equal((await request('/public')).status, 200);
assert.equal((await mobileRequest('/public')).status, 200);
console.log('PASS Bearer-only regular/emergency creation, replay, owner listing/details/eligible edits, photo upload/replay/list, token rejection and cross-resident isolation');
