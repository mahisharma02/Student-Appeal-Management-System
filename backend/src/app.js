import "dotenv/config";
import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const pool = new pg.Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "SECRET_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing database/settings: ${missing.join(", ")}`);

const uploadDir = path.resolve(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg"]);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new (pgSession(session))({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SECRET_KEY, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000 }
}));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const query = (text, params = []) => pool.query(text, params);
const ok = (res, data = {}, message = "Success", status = 200) =>
  res.status(status).json({ status: "success", message, data });
const fail = (res, message, status = 400, code) =>
  res.status(status).json({ status: "error", message, ...(code ? { code } : {}) });
const user = (req) => req.session.user;
const requireLogin = (req, res, next) => user(req) ? next() : fail(res, "Authentication required", 401, "AUTH_REQUIRED");
const requireRole = (...roles) => (req, res, next) =>
  !user(req) ? fail(res, "Authentication required", 401, "AUTH_REQUIRED") :
  roles.includes(user(req).role) ? next() : fail(res, "You are not authorized to perform this action", 403, "FORBIDDEN");

function cleanText(value, field, max, required = true) {
  if (value == null) { if (required) throw new Error(`${field} is required`); return null; }
  const v = String(value).trim();
  if (required && !v) throw new Error(`${field} is required`);
  if (v.length > max) throw new Error(`${field} must be at most ${max} characters`);
  return v;
}
function emailValue(v) {
  const e = cleanText(v, "Email", 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Enter a valid email address");
  return e;
}
function passwordValue(v) {
  if (typeof v !== "string" || v.length < 10) throw new Error("Password must contain at least 10 characters");
  if (v.length > 200) throw new Error("Password is too long");
  return v;
}
// Werkzeug-compatible pbkdf2:sha256 hashes allow existing Flask accounts to keep working.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 600000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2:sha256:${iterations}$${salt}$${hash}`;
}
function checkPassword(stored, password) {
  try {
    const [method, salt, expected] = stored.split("$");
    if (method?.startsWith("pbkdf2:sha256:")) {
      const iterations = Number(method.split(":")[2]);
      const actual = crypto.pbkdf2Sync(password, salt, iterations, Buffer.from(expected, "hex").length, "sha256");
      return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
    }
    if (method?.startsWith("scrypt:")) {
      const [, n, r, p] = method.split(":").map((v, i) => i === 0 ? v : Number(v));
      const actual = crypto.scryptSync(password, salt, Buffer.from(expected, "hex").length,
        { N: n, r, p, maxmem: Math.max(64 * 1024 * 1024, 256 * n * r) });
      return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
    }
    return false;
  } catch { return false; }
}
function appendEvent(client, appealId, actorId, action, oldStatus, newStatus, remarks) {
  return client.query(`INSERT INTO appeal_events
    (appeal_id, actor_id, seq, action, old_status, new_status, remarks)
    SELECT $1,$2,COALESCE(MAX(seq),0)+1,$3,$4,$5,$6
    FROM appeal_events WHERE appeal_id=$1`,
    [appealId, actorId, action, oldStatus, newStatus, remarks || null]);
}
async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
async function getAppeal(id) {
  const r = await query(`SELECT a.*, d.department_name, c.category_name,
    u.name AS student_name, u.email AS student_email
    FROM appeals a JOIN departments d ON d.department_id=a.department_id
    JOIN appeal_categories c ON c.category_id=a.category_id
    JOIN users u ON u.user_id=a.student_id WHERE a.appeal_id=$1`, [id]);
  return r.rows[0];
}
async function getEvents(id) {
  const r = await query(`SELECT e.event_id,e.appeal_id,e.actor_id,u.name AS actor_name,
    e.seq,e.action,e.old_status,e.new_status,e.remarks,e.created_at
    FROM appeal_events e JOIN users u ON u.user_id=e.actor_id
    WHERE e.appeal_id=$1 ORDER BY e.seq`, [id]);
  return r.rows;
}
async function listAttachments(id) {
  const r = await query(`SELECT attachment_id,appeal_id,uploaded_by,file_name,mime_type,file_size,uploaded_at
    FROM attachments WHERE appeal_id=$1 ORDER BY uploaded_at`, [id]);
  return r.rows;
}
async function canAccessAppeal(appealId, currentUser) {
  if (currentUser.role === "ADMIN") return true;
  if (currentUser.role === "STUDENT") {
    const r = await query("SELECT 1 FROM appeals WHERE appeal_id=$1 AND student_id=$2", [appealId,currentUser.user_id]);
    return !!r.rowCount;
  }
  if (currentUser.role === "REVIEWER") {
    const r = await query("SELECT 1 FROM reviewer_assignments WHERE appeal_id=$1 AND reviewer_id=$2", [appealId,currentUser.user_id]);
    return !!r.rowCount;
  }
  return false;
}
function fileSafeName(name) { return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_"); }
const storage = multer.diskStorage({
  destination: (req, file, cb) => { const dir = path.join(uploadDir, String(req.params.appealId)); fs.mkdirSync(dir,{recursive:true}); cb(null,dir); },
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.${path.extname(file.originalname).slice(1).toLowerCase()}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req,file,cb) => allowedExtensions.has(path.extname(file.originalname).slice(1).toLowerCase()) ? cb(null,true) : cb(new Error("Only PDF, PNG and JPG files are allowed")) });

// Authentication
app.post("/api/auth/register", asyncRoute(async (req,res) => {
  try {
    const name=cleanText(req.body.name,"Name",150), email=emailValue(req.body.email), password=passwordValue(req.body.password);
    const departmentId=Number(req.body.department_id);
    if (!Number.isInteger(departmentId)) return fail(res,"A valid department_id is required",400);
    const dept=await query("SELECT 1 FROM departments WHERE department_id=$1",[departmentId]);
    if (!dept.rowCount) return fail(res,"Selected department does not exist",400);
    const r=await query(`INSERT INTO users(department_id,name,email,password_hash,role,account_status)
      VALUES($1,$2,$3,$4,'STUDENT','ACTIVE')
      RETURNING user_id,department_id,name,email,role,account_status`,
      [departmentId,name,email,hashPassword(password)]);
    return ok(res,{user:r.rows[0]},"Student account created",201);
  } catch(e) { if (e.code==="23505") return fail(res,"An account with this email already exists",409); return fail(res,e.message,400); }
}));
app.post("/api/auth/login", asyncRoute(async (req,res) => {
  try {
    const email=emailValue(req.body.email), password=req.body.password;
    if (typeof password!=="string" || !password) return fail(res,"Email and password are required",400);
    const r=await query(`SELECT user_id,name,email,password_hash,role,account_status,department_id
      FROM users WHERE LOWER(email)=LOWER($1)`,[email]);
    const row=r.rows[0];
    if (!row || row.account_status!=="ACTIVE" || !checkPassword(row.password_hash,password))
      return fail(res,"Invalid email or password, or account is inactive",401);
    req.session.regenerate((err)=>{ if(err) return fail(res,"Could not create session",500);
      req.session.user={user_id:row.user_id,name:row.name,email:row.email,role:row.role,department_id:row.department_id};
      req.session.save((e)=> e ? fail(res,"Could not save session",500) : ok(res,{user:req.session.user},"Login successful"));
    });
  } catch(e) { return fail(res,e.message,400); }
}));
app.get("/api/auth/me",(req,res)=> user(req) ? ok(res,{user:user(req)}) : fail(res,"Not logged in",401));
app.post("/api/auth/logout",(req,res)=> {
  const token=req.get("X-CSRF-Token");
  if (!token || token !== req.session.csrfToken) return fail(res,"Invalid CSRF token",403);
  req.session.destroy(()=>{res.clearCookie("connect.sid"); return ok(res,{},"Logged out successfully");});
});
app.get("/api/auth/csrf",(req,res)=> {
  if (!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(32).toString("hex");
  return ok(res,{csrf_token:req.session.csrfToken});
});

// Metadata
app.get("/api/meta/departments",asyncRoute(async(req,res)=>ok(res,{departments:(await query("SELECT department_id,department_name,description FROM departments ORDER BY department_name")).rows})));
app.get("/api/meta/categories",asyncRoute(async(req,res)=>ok(res,{categories:(await query("SELECT category_id,category_name,description FROM appeal_categories ORDER BY category_name")).rows})));

// Student
app.get("/api/student/profile",requireRole("STUDENT"),asyncRoute(async(req,res)=>{
  const r=await query(`SELECT u.user_id,u.name,u.email,u.role,u.account_status,u.department_id,d.department_name,u.created_at
    FROM users u LEFT JOIN departments d ON d.department_id=u.department_id WHERE u.user_id=$1`,[user(req).user_id]);
  return ok(res,r.rows[0] || {});
}));
app.get("/api/student/appeals",requireRole("STUDENT"),asyncRoute(async(req,res)=>{
  const r=await query(`SELECT a.*,d.department_name,c.category_name FROM appeals a
    JOIN departments d ON d.department_id=a.department_id JOIN appeal_categories c ON c.category_id=a.category_id
    WHERE a.student_id=$1 ORDER BY a.created_at DESC,a.appeal_id DESC`,[user(req).user_id]);
  return ok(res,{appeals:r.rows});
}));
app.post("/api/student/appeals",requireRole("STUDENT"),asyncRoute(async(req,res)=>{
  try {
    const title=cleanText(req.body.title,"Title",200), description=cleanText(req.body.description,"Description",10000);
    const departmentId=Number(req.body.department_id), categoryId=Number(req.body.category_id);
    if(!Number.isInteger(departmentId)||!Number.isInteger(categoryId)) return fail(res,"Valid department_id and category_id are required",400);
    if(user(req).department_id!=null && departmentId!==Number(user(req).department_id)) return fail(res,"You can submit an appeal only to your registered department",403);
    const created=await transaction(async c=>{
      const d=await c.query("SELECT 1 FROM departments WHERE department_id=$1",[departmentId]);
      const cat=await c.query("SELECT 1 FROM appeal_categories WHERE category_id=$1",[categoryId]);
      if(!d.rowCount||!cat.rowCount) throw new Error("Selected department or category does not exist");
      const a=await c.query(`INSERT INTO appeals(student_id,department_id,category_id,title,description,status,version)
        VALUES($1,$2,$3,$4,$5,'SUBMITTED',1) RETURNING *`,[user(req).user_id,departmentId,categoryId,title,description]);
      await appendEvent(c,a.rows[0].appeal_id,user(req).user_id,"SUBMITTED",null,"SUBMITTED","Appeal submitted successfully.");
      return a.rows[0];
    });
    return ok(res,{appeal:created},"Appeal submitted",201);
  } catch(e) { return fail(res,e.message,400); }
}));
app.get("/api/student/appeals/:appealId",requireRole("STUDENT"),asyncRoute(async(req,res)=>{
  const a=await getAppeal(req.params.appealId);
  if(!a||Number(a.student_id)!==Number(user(req).user_id)) return fail(res,"Appeal not found",404);
  return ok(res,{appeal:a,events:await getEvents(a.appeal_id),attachments:await listAttachments(a.appeal_id)});
}));
app.post("/api/student/appeals/:appealId/attachments",requireRole("STUDENT"),(req,res,next)=>{
  upload.single("file")(req,res,async(err)=>{
    if(err) return fail(res,err.message,400);
    try {
      const id=Number(req.params.appealId), a=await query("SELECT 1 FROM appeals WHERE appeal_id=$1 AND student_id=$2",[id,user(req).user_id]);
      if(!a.rowCount) { if(req.file) fs.unlinkSync(req.file.path); return fail(res,"Appeal not found",404); }
      if(!req.file) return fail(res,"Choose a file to upload",400);
      const relative=`${id}/${req.file.filename}`;
      const r=await query(`INSERT INTO attachments(appeal_id,uploaded_by,file_name,file_path,mime_type,file_size)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING attachment_id,appeal_id,uploaded_by,file_name,mime_type,file_size,uploaded_at`,
        [id,user(req).user_id,fileSafeName(req.file.originalname),relative,req.file.mimetype,req.file.size]);
      return ok(res,{attachment:r.rows[0]},"Attachment uploaded",201);
    } catch(e) { if(req.file) fs.unlinkSync(req.file.path); return fail(res,"Could not save attachment",500); }
  });
});
async function sendAttachment(req,res,attachmentId) {
  const r=await query("SELECT * FROM attachments WHERE attachment_id=$1",[attachmentId]);
  const a=r.rows[0]; if(!a) return fail(res,"Attachment not found",404);
  if(!await canAccessAppeal(a.appeal_id,user(req))) return fail(res,"Attachment not found",404);
  const file=path.resolve(uploadDir,a.file_path);
  if(!file.startsWith(uploadDir+path.sep)||!fs.existsSync(file)) return fail(res,"File is missing from storage",404);
  return res.download(file,a.file_name);
}
app.get("/api/student/attachments/:attachmentId",requireRole("STUDENT"),asyncRoute(sendAttachment));
app.get("/api/appeals/attachments/:attachmentId/download",requireRole("STUDENT","REVIEWER","ADMIN"),asyncRoute(sendAttachment));

// Reviewer
app.get("/api/reviewer/assignments",requireRole("REVIEWER"),asyncRoute(async(req,res)=>{
 const r=await query(`SELECT ra.assignment_id,ra.appeal_id,ra.assignment_status,ra.assigned_at,a.title,a.description,a.status,a.version,a.created_at,
 d.department_name,c.category_name,u.name AS student_name FROM reviewer_assignments ra
 JOIN appeals a ON a.appeal_id=ra.appeal_id JOIN departments d ON d.department_id=a.department_id
 JOIN appeal_categories c ON c.category_id=a.category_id JOIN users u ON u.user_id=a.student_id
 WHERE ra.reviewer_id=$1 ORDER BY ra.assigned_at DESC`,[user(req).user_id]);
 return ok(res,{assignments:r.rows});
}));
app.get("/api/reviewer/appeals/:appealId",requireRole("REVIEWER"),asyncRoute(async(req,res)=>{
 const a=await getAppeal(req.params.appealId);
 if(!a||!await canAccessAppeal(a.appeal_id,user(req))) return fail(res,"Appeal not found",404);
 return ok(res,{appeal:a,events:await getEvents(a.appeal_id),attachments:await listAttachments(a.appeal_id)});
}));
app.post("/api/reviewer/appeals/:appealId/decision",requireRole("REVIEWER"),asyncRoute(async(req,res)=>{
 const {decision,remarks,version}=req.body;
 if(remarks!=null&&(typeof remarks!=="string"||remarks.length>5000)) return fail(res,"Remarks must be at most 5000 characters",400);
 try {
  const updated=await transaction(async c=>{
   const ar=await c.query("SELECT appeal_id,status,version FROM appeals WHERE appeal_id=$1 FOR UPDATE",[req.params.appealId]);
   const a=ar.rows[0]; if(!a) throw Object.assign(new Error("Appeal not found"),{status:404});
   if(["RESOLVED","REJECTED"].includes(a.status)) throw Object.assign(new Error("This appeal already has a final decision"),{status:409});
   const as=await c.query(`SELECT assignment_id FROM reviewer_assignments WHERE appeal_id=$1 AND reviewer_id=$2 AND assignment_status='ACTIVE' FOR UPDATE`,[a.appeal_id,user(req).user_id]);
   if(!as.rowCount) throw Object.assign(new Error("You do not have an active assignment for this appeal"),{status:403});
   if(version!=null&&Number(version)!==Number(a.version)) throw Object.assign(new Error("This appeal has changed. Refresh and try again."),{status:409});
   let next,action;
   if(decision==="start_review"){if(a.status!=="SUBMITTED") throw Object.assign(new Error("Only submitted appeals can be moved into review"),{status:409}); next="UNDER_REVIEW";action="REVIEWED";}
   else if(decision==="approve"){next="RESOLVED";action="RESOLVED";}
   else if(decision==="reject"){next="REJECTED";action="REJECTED";}
   else throw Object.assign(new Error("Decision must be start_review, approve, or reject"),{status:400});
   const up=await c.query("UPDATE appeals SET status=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE appeal_id=$2 AND version=$3 RETURNING appeal_id,status,version,updated_at",[next,a.appeal_id,a.version]);
   if(!up.rowCount) throw Object.assign(new Error("Concurrent update detected. Refresh and retry."),{status:409});
   await appendEvent(c,a.appeal_id,user(req).user_id,action,a.status,next,remarks);
   if(["RESOLVED","REJECTED"].includes(next)) await c.query("UPDATE reviewer_assignments SET assignment_status='COMPLETED',unassigned_at=CURRENT_TIMESTAMP WHERE appeal_id=$1 AND assignment_status='ACTIVE'",[a.appeal_id]);
   return up.rows[0];
  });
  return ok(res,{appeal:updated},"Decision recorded");
 } catch(e){return fail(res,e.message,e.status||400,e.status===409?"CONFLICT":undefined);}
}));

// Admin
app.get("/api/admin/users",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 const r=await query("SELECT user_id,department_id,name,email,role,account_status,created_at FROM users ORDER BY user_id");
 return ok(res,{users:r.rows});
}));
app.post("/api/admin/users",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 try{
  const name=cleanText(req.body.name,"Name",150),email=emailValue(req.body.email),password=passwordValue(req.body.password);
  const role=req.body.role||"STUDENT"; if(!["STUDENT","REVIEWER","ADMIN"].includes(role)) return fail(res,"Invalid role",400);
  const dept=req.body.department_id==null?null:Number(req.body.department_id);
  const r=await query(`INSERT INTO users(department_id,name,email,password_hash,role,account_status)
   VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING user_id,department_id,name,email,role,account_status,created_at`,
   [dept,name,email,hashPassword(password),role]);
  return ok(res,{user:r.rows[0]},"User created",201);
 }catch(e){return fail(res,e.code==="23505"?"A user with this email already exists":e.message,e.code==="23505"?409:400);}
}));
app.patch("/api/admin/users/:userId/status",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 const status=req.body.account_status;
 if(!["ACTIVE","INACTIVE","SUSPENDED"].includes(status)) return fail(res,"Status must be ACTIVE, INACTIVE, or SUSPENDED",400);
 const r=await query("UPDATE users SET account_status=$1 WHERE user_id=$2 RETURNING user_id,name,email,role,account_status",[status,req.params.userId]);
 return r.rowCount?ok(res,{user:r.rows[0]},"Account status updated"):fail(res,"User not found",404);
}));
app.get("/api/admin/departments",requireRole("ADMIN"),asyncRoute(async(req,res)=>ok(res,{departments:(await query("SELECT department_id,department_name,description FROM departments ORDER BY department_name")).rows})));
app.get("/api/admin/categories",requireRole("ADMIN"),asyncRoute(async(req,res)=>ok(res,{categories:(await query("SELECT category_id,category_name,description FROM appeal_categories ORDER BY category_name")).rows})));
app.get("/api/admin/appeals",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 const r=await query(`SELECT a.*,u.name AS student_name,d.department_name,c.category_name FROM appeals a
 JOIN users u ON u.user_id=a.student_id JOIN departments d ON d.department_id=a.department_id
 JOIN appeal_categories c ON c.category_id=a.category_id ORDER BY a.created_at DESC`);
 return ok(res,{appeals:r.rows});
}));
app.post("/api/admin/appeals/:appealId/assignments",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 try{
  const reviewerId=Number(req.body.reviewer_id); if(!Number.isInteger(reviewerId)) return fail(res,"Valid reviewer_id is required",400);
  const result=await transaction(async c=>{
   const ar=await c.query("SELECT appeal_id,status FROM appeals WHERE appeal_id=$1 FOR UPDATE",[req.params.appealId]);
   const a=ar.rows[0]; if(!a) throw Object.assign(new Error("Appeal not found"),{status:404});
   if(["RESOLVED","REJECTED"].includes(a.status)) throw Object.assign(new Error("Cannot assign a reviewer to a closed appeal"),{status:409});
   const rr=await c.query("SELECT user_id FROM users WHERE user_id=$1 AND role='REVIEWER' AND account_status='ACTIVE'",[reviewerId]);
   if(!rr.rowCount) throw Object.assign(new Error("Selected user is not an active reviewer"),{status:400});
   const ex=await c.query("SELECT 1 FROM reviewer_assignments WHERE appeal_id=$1 AND reviewer_id=$2 AND assignment_status='ACTIVE'",[a.appeal_id,reviewerId]);
   if(ex.rowCount) throw Object.assign(new Error("This reviewer is already assigned to the appeal"),{status:400});
   await c.query("INSERT INTO reviewer_assignments(appeal_id,reviewer_id,assigned_by,assignment_status) VALUES($1,$2,$3,'ACTIVE')",[a.appeal_id,reviewerId,user(req).user_id]);
   await appendEvent(c,a.appeal_id,user(req).user_id,"REASSIGNED",a.status,a.status,"Reviewer assigned.");
   return {appeal_id:Number(a.appeal_id),reviewer_id:reviewerId,assignment_status:"ACTIVE"};
  });
  return ok(res,{assignment:result},"Reviewer assigned",201);
 }catch(e){return fail(res,e.message,e.status||400);}
}));
app.patch("/api/admin/assignments/:assignmentId/unassign",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 try{
  const result=await transaction(async c=>{
   const ar=await c.query("SELECT assignment_id,appeal_id,assignment_status FROM reviewer_assignments WHERE assignment_id=$1 FOR UPDATE",[req.params.assignmentId]);
   const a=ar.rows[0]; if(!a) throw Object.assign(new Error("Assignment not found"),{status:404});
   if(a.assignment_status!=="ACTIVE") throw Object.assign(new Error("Only active assignments can be unassigned"),{status:409});
   const ap=await c.query("SELECT status FROM appeals WHERE appeal_id=$1 FOR UPDATE",[a.appeal_id]);
   await c.query("UPDATE reviewer_assignments SET assignment_status='UNASSIGNED',unassigned_at=CURRENT_TIMESTAMP WHERE assignment_id=$1",[a.assignment_id]);
   await appendEvent(c,a.appeal_id,user(req).user_id,"REASSIGNED",ap.rows[0].status,ap.rows[0].status,"Reviewer unassigned.");
   return {assignment_id:Number(a.assignment_id),assignment_status:"UNASSIGNED"};
  });
  return ok(res,{assignment:result},"Reviewer unassigned");
 }catch(e){return fail(res,e.message,e.status||400);}
}));

// Appeal event history and attachment downloads
app.get("/api/appeals/:appealId/events",requireRole("STUDENT","REVIEWER","ADMIN"),asyncRoute(async(req,res)=>{
 if(!await canAccessAppeal(req.params.appealId,user(req))) return fail(res,"Appeal not found",404);
 return ok(res,{events:await getEvents(req.params.appealId)});
}));
app.get("/api/appeals/attachments/:attachmentId/download",requireRole("STUDENT","REVIEWER","ADMIN"),asyncRoute(sendAttachment));
app.get("/api/health",asyncRoute(async(req,res)=>{
 const r=await query("SELECT current_user,current_database()");
 return res.json({status:"success",message:"Database connected successfully",database_user:r.rows[0].current_user,database_name:r.rows[0].current_database});
}));
app.get("/",(req,res)=>res.json({message:"Student Appeal Management System API",status:"Running"}));
app.get("/api/appeals",requireRole("ADMIN"),asyncRoute(async(req,res)=>{
 const r=await query("SELECT appeal_id,student_id,department_id,category_id,title,description,status,version,created_at,updated_at FROM appeals ORDER BY created_at DESC");
 return res.json({status:"success",total_appeals:r.rowCount,appeals:r.rows});
}));

app.use((err,req,res,next)=>{
 console.error(err);
 if(res.headersSent) return next(err);
 return fail(res,process.env.NODE_ENV==="production"?"Internal server error":err.message,500);
});

export default app;
