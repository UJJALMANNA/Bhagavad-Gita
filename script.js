/* ===================== SUPABASE SETUP ===================== */
const SUPABASE_URL = 'https://cvtwmbadbbavwwzqivnd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dHdtYmFkYmJhdnd3enFpdm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMzgzOTIsImV4cCI6MjA5ODcxNDM5Mn0.ByuBZD-uble7T1vMyAugMa7THzc3NS1UJ7S4LmYMeV4';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

let chapters = [];
let liveSessions = [];
let progressMap = {};
let activeChapterId = null;
let activeLessonId = null;

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function showToast(msg, type='info'){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type==='error' ? ' error' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 4200);
}
function scrollToId(id){document.getElementById(id).scrollIntoView({behavior:'smooth'});}
function toggleMobileNav(){
  const nav = document.getElementById('mobileNav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
}

/* ===================== ADMIN PASSCODE LOGIN =====================
   Team members share ONE simple passcode instead of an email/password.
   Entering it correctly signs in behind the scenes to the single admin
   Supabase account below, so your existing is_admin + RLS rules keep
   working exactly as before — the passcode is just a friendlier front door.

   IMPORTANT: replace the three placeholder values below.
   - ADMIN_PASSCODE: whatever simple word/phrase you want your team to type.
   - ADMIN_EMAIL / ADMIN_PASSWORD: the real login for the ONE Supabase
     account you already set is_admin = true for.

   Note on security: this passcode (and the admin email/password) live in
   this JS file, which anyone can view via "View Source" in their browser.
   That's fine for keeping casual visitors out of the upload tools, but it
   is NOT a substitute for real per-person accounts if you need to know
   exactly who uploaded what, or if this content is sensitive. */
const ADMIN_PASSCODE  = 'ujju03';
const ADMIN_EMAIL     = 'mannaujjal683@gmail.com';
const ADMIN_PASSWORD  = '123456';

function openAdminLogin(){
  document.getElementById('adminModalOverlay').classList.add('open');
  document.getElementById('adminPasscodeInput').value = '';
  document.getElementById('adminPasscodeError').classList.remove('show');
}
function closeAdminModal(){
  document.getElementById('adminModalOverlay').classList.remove('open');
}
document.getElementById('adminModalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='adminModalOverlay') closeAdminModal();
});

async function submitAdminPasscode(){
  const input = document.getElementById('adminPasscodeInput').value.trim();
  const errEl = document.getElementById('adminPasscodeError');
  errEl.classList.remove('show');

  if(!input){
    errEl.textContent = 'Please enter the admin passcode.';
    errEl.classList.add('show');
    return;
  }
  if(input !== ADMIN_PASSCODE){
    errEl.textContent = 'Incorrect passcode.';
    errEl.classList.add('show');
    return;
  }

  setBusy('adminPasscodeSubmit','adminPasscodeSubmitText', true);
  const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  setBusy('adminPasscodeSubmit','adminPasscodeSubmitText', false, 'Unlock Admin Tools');

  if(error){
    errEl.textContent = 'Passcode correct, but admin sign-in failed: ' + error.message;
    errEl.classList.add('show');
    return;
  }

  await refreshSession();
  closeAdminModal();

  if(currentProfile && currentProfile.is_admin){
    showToast('Admin access confirmed — upload tools unlocked.');
    setTimeout(()=>scrollToId('library'), 500);
  } else {
    showToast('Signed in, but this account is not flagged is_admin in Supabase.', 'error');
  }
}

function openModal(tab){
  document.getElementById('modalOverlay').classList.add('open');
  switchTab(tab);
}
function closeModal(){document.getElementById('modalOverlay').classList.remove('open');}
function switchTab(tab){
  document.getElementById('tabSignup').classList.toggle('active', tab==='signup');
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabSignupBtn').classList.toggle('active', tab==='signup');
  document.getElementById('tabLoginBtn').classList.toggle('active', tab==='login');
}
document.getElementById('modalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='modalOverlay') closeModal();
});

function setBusy(btnId, textId, busy, label){
  const btn = document.getElementById(btnId);
  const span = document.getElementById(textId);
  btn.disabled = busy;
  span.innerHTML = busy ? '<span class="spinner"></span>' : label;
}

async function handleSignup(){
  const first = document.getElementById('suFirst').value.trim();
  const last = document.getElementById('suLast').value.trim();
  const age = document.getElementById('suAge').value;
  const mobile = document.getElementById('suMobile').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const password = document.getElementById('suPassword').value;
  const confirmPassword = document.getElementById('suConfirmPassword').value;
  const errEl = document.getElementById('suError');
  errEl.classList.remove('show');

  if(!first || !last || !email || !password || !confirmPassword || !mobile || !age){
    errEl.textContent = 'Please fill in every field.';
    errEl.classList.add('show');
    return;
  }
  if(password.length < 6){
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.classList.add('show');
    return;
  }
  if(password !== confirmPassword){
    errEl.textContent = 'Passwords do not match.';
    errEl.classList.add('show');
    return;
  }

  setBusy('suSubmit','suSubmitText', true);
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { first_name: first, last_name: last, age: String(age), mobile } }
  });
  if(error){
    setBusy('suSubmit','suSubmitText', false, 'Create Account');
    errEl.textContent = error.message;
    errEl.classList.add('show');
    return;
  }

  setBusy('suSubmit','suSubmitText', false, 'Create Account');
  showToast('Welcome, ' + first + '! Your account is ready.');
  closeModal();
  await refreshSession();
}

async function handleLogin(){
  const email = document.getElementById('liEmail').value.trim();
  const password = document.getElementById('liPassword').value;
  const errEl = document.getElementById('liError');
  errEl.classList.remove('show');

  if(!email || !password){
    errEl.textContent = 'Please enter your email and password.';
    errEl.classList.add('show');
    return;
  }

  setBusy('liSubmit','liSubmitText', true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  setBusy('liSubmit','liSubmitText', false, 'Log In');
  if(error){
    errEl.textContent = error.message;
    errEl.classList.add('show');
    return;
  }
  showToast('Namaste, welcome back 🙏');
  closeModal();
  await refreshSession();
}

async function handleLogout(){
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  progressMap = {};
  renderAuthUI();
  renderChapterTabs();
  renderLessons();
  showToast('Logged out.');
}

function renderAuthUI(){
  const wrap = document.getElementById('navActions');
  if(!wrap){ return; }
  const hamburger = wrap.querySelector('.hamburger');
  if(currentUser && currentProfile){
    const initial = (currentProfile.first_name || '?').charAt(0).toUpperCase();
    wrap.innerHTML = `
      <div class="user-chip">
        <div class="avatar">${initial}</div>
        <span class="uname">Namaste, ${escapeHtml(currentProfile.first_name)}</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="handleLogout()">Logout</button>
    `;
    if(hamburger) wrap.appendChild(hamburger);
  } else {
    wrap.innerHTML = `
      <button class="btn btn-admin" onclick="openAdminLogin()">🔑 Admin Login</button>
      <button class="btn btn-ghost" onclick="openModal('login')">Devotee Login</button>
      <button class="btn btn-primary" onclick="openModal('signup')">Sign Up</button>
    `;
    if(hamburger) wrap.appendChild(hamburger);
  }
  const sessionForm = document.getElementById('adminSessionForm');
  const lessonForm = document.getElementById('adminLessonForm');
  if(sessionForm) sessionForm.style.display = (currentProfile && currentProfile.is_admin) ? 'block' : 'none';
  if(lessonForm) lessonForm.style.display = (currentProfile && currentProfile.is_admin) ? 'block' : 'none';
}

async function refreshSession(){
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  if(currentUser){
    const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    currentProfile = profile || { first_name: (currentUser.email || 'Devotee').split('@')[0], is_admin: false };
    await loadProgress();
  } else {
    currentProfile = null;
    progressMap = {};
  }
  renderAuthUI();
  renderChapterTabs();
  renderLessons();
}

let authInitDone = false;
sb.auth.onAuthStateChange((_event, session) => {
  if(!authInitDone) return;
  currentUser = session?.user || null;
  refreshSession();
});

async function loadSloka(){
  const { data, error } = await sb.from('daily_sloka').select('*').order('sloka_date', {ascending:false}).limit(1);
  if(error || !data || !data.length){
    document.getElementById('slokaSanskrit').textContent = 'No verse has been added yet.';
    return;
  }
  const s = data[0];
  document.getElementById('slokaSanskrit').textContent = s.sanskrit || '';
  document.getElementById('slokaRef').textContent = '— ' + (s.reference || '');
  document.getElementById('slokaMeaning').textContent = 'Meaning: ' + (s.meaning || '');
}

async function loadLiveSessions(){
  const { data, error } = await sb.from('live_sessions').select('*').order('session_date', {ascending:true}).order('session_time', {ascending:true});
  const grid = document.getElementById('liveGrid');
  if(error){ grid.innerHTML = '<p class="empty-note">Could not load sessions.</p>'; return; }
  liveSessions = data || [];
  if(!liveSessions.length){
    grid.innerHTML = '<p class="empty-note">No live satsangs scheduled yet — check back soon.</p>';
    return;
  }
  grid.innerHTML = liveSessions.map(s => `
    <div class="live-card">
      <span class="live-badge"><span class="pulse-dot" style="width:7px;height:7px;"></span> Scheduled</span>
      <h3>${escapeHtml(s.title)}</h3>
      <p class="live-meta">${s.session_date ? new Date(s.session_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long', month:'long', day:'numeric'}) : 'Date TBA'} ${s.session_time ? '· ' + s.session_time : ''}</p>
      <button class="btn btn-ghost" style="width:100%;" onclick="showToast('You will be reminded before this satsang.')">🔔 Remind Me</button>
    </div>
  `).join('');
}

async function loadChaptersAndLessons(){
  const { data: chapterRows, error: chErr } = await sb.from('chapters').select('*').order('order_index', {ascending:true});
  const { data: lessonRows, error: lsErr } = await sb.from('lessons').select('*').order('order_index', {ascending:true});
  if(chErr || lsErr){
    document.getElementById('lessonList').innerHTML = '<p class="empty-note">Could not load the library.</p>';
    return;
  }
  chapters = (chapterRows || []).map(c => ({ ...c, lessons: (lessonRows||[]).filter(l => l.chapter_id === c.id) }));
  if(activeChapterId === null && chapters.length) activeChapterId = chapters[0].id;
  populateUploadChapterSelect();
  renderChapterTabs();
  renderLessons();
}

async function loadProgress(){
  if(!currentUser) return;
  const { data, error } = await sb.from('lesson_progress').select('lesson_id, completed').eq('user_id', currentUser.id);
  progressMap = {};
  if(!error && data){
    data.forEach(row => { progressMap[row.lesson_id] = row.completed; });
  }
}

async function addSession(){
  const title = document.getElementById('sessTitle').value.trim();
  const date = document.getElementById('sessDate').value;
  const time = document.getElementById('sessTime').value;
  if(!title){ showToast('Please enter a topic name.', 'error'); return; }

  document.getElementById('addSessionBtn').disabled = true;
  const { error } = await sb.from('live_sessions').insert({
    title, session_date: date || null, session_time: time || null
  });
  document.getElementById('addSessionBtn').disabled = false;

  if(error){ showToast(error.message, 'error'); return; }
  document.getElementById('sessTitle').value = '';
  document.getElementById('sessDate').value = '';
  document.getElementById('sessTime').value = '';
  showToast('Live session added.');
  await loadLiveSessions();
}

function isLocked(chapter, lessonIdx){
  if(lessonIdx === 0) return false;
  const prevLesson = chapter.lessons[lessonIdx-1];
  return !progressMap[prevLesson.id];
}

function renderChapterTabs(){
  const wrap = document.getElementById('chapterTabs');
  if(!chapters.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = chapters.map(c =>
    `<button class="chapter-tab ${c.id===activeChapterId?'active':''}" onclick="selectChapter(${c.id})">${escapeHtml(c.name.split('—')[0].trim())}</button>`
  ).join('');
}

function selectChapter(id){
  activeChapterId = id;
  renderChapterTabs();
  renderLessons();
}

function renderLessons(){
  const list = document.getElementById('lessonList');
  const chapter = chapters.find(c => c.id === activeChapterId);
  if(!chapter){ list.innerHTML = '<p class="empty-note">No chapters yet.</p>'; return; }
  if(!chapter.lessons.length){ list.innerHTML = '<p class="empty-note">No lessons uploaded for this chapter yet.</p>'; return; }

  list.innerHTML = chapter.lessons.map((l,i) => {
    const locked = isLocked(chapter, i);
    const completed = !!progressMap[l.id];
    const isCurrent = activeLessonId === l.id;
    let statusClass = '', statusIcon = i+1;
    if(completed){ statusClass='done'; statusIcon='✓'; }
    if(isCurrent && !completed){ statusClass='playing'; statusIcon='▶'; }
    let stateText = completed ? 'Completed' : (locked ? 'Locked' : (l.media_url ? 'Ready to play' : 'Awaiting upload'));
    return `<div class="lesson-item ${locked?'locked':''} ${isCurrent?'current':''}" onclick="${locked?'':`playLesson(${l.id})`}">
      <div class="lesson-status ${statusClass}">${locked?'🔒':statusIcon}</div>
      <div class="lesson-info">
        <div class="lname">${escapeHtml(l.title)}</div>
        <div class="lstate">${stateText}</div>
      </div>
    </div>`;
  }).join('');
}

function playLesson(lessonId){
  const chapter = chapters.find(c => c.id === activeChapterId);
  const idx = chapter.lessons.findIndex(l => l.id === lessonId);
  const lesson = chapter.lessons[idx];
  if(isLocked(chapter, idx)) return;

  if(!currentUser){
    showToast('Log in to track your progress and unlock the next lesson.');
  }

  activeLessonId = lessonId;
  const player = document.getElementById('lessonPlayer');
  const empty = document.getElementById('playerEmpty');
  const title = document.getElementById('playerTitle');
  const markBtn = document.getElementById('markDoneBtn');
  title.textContent = `${chapter.name} · ${lesson.title}`;

  if(lesson.media_url){
    player.src = lesson.media_url;
    player.style.display='block';
    empty.style.display='none';
    player.play().catch(()=>{});
  } else {
    player.removeAttribute('src');
    player.style.display='none';
    empty.style.display='flex';
    empty.querySelector('p').textContent = 'This lesson is awaiting upload from the admin.';
  }
  markBtn.style.display = (!progressMap[lesson.id] && currentUser) ? 'inline-flex' : 'none';
  renderLessons();
}

async function markCurrentComplete(){
  if(!activeLessonId || !currentUser) return;
  const { error } = await sb.from('lesson_progress').upsert({
    user_id: currentUser.id, lesson_id: activeLessonId, completed: true, completed_at: new Date().toISOString()
  }, { onConflict: 'user_id,lesson_id' });
  if(error){ showToast(error.message, 'error'); return; }

  progressMap[activeLessonId] = true;
  document.getElementById('markDoneBtn').style.display = 'none';
  renderLessons();

  const chapter = chapters.find(c => c.id === activeChapterId);
  const idx = chapter.lessons.findIndex(l => l.id === activeLessonId);
  const next = chapter.lessons[idx+1];
  if(next) setTimeout(()=>playLesson(next.id), 400);
  else showToast('Chapter complete! 🙏');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const player = document.getElementById('lessonPlayer');
  if(player){
    player.addEventListener('ended', ()=>{
      if(activeLessonId && currentUser && !progressMap[activeLessonId]) markCurrentComplete();
    });
  }
});

function populateUploadChapterSelect(){
  const sel = document.getElementById('uploadChapter');
  if(!sel) return;
  sel.innerHTML = chapters.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function addLesson(){
  const chapterId = parseInt(document.getElementById('uploadChapter').value, 10);
  const titleInput = document.getElementById('uploadTitle');
  const fileInput = document.getElementById('uploadFile');
  const title = titleInput.value.trim();
  const file = fileInput.files[0];
  if(!title || !file){ showToast('Please add a lesson title and choose a file.', 'error'); return; }

  setBusy('addLessonBtn','addLessonBtnText', true);
  const chapter = chapters.find(c => c.id === chapterId);
  const nextOrder = chapter ? chapter.lessons.length + 1 : 1;
  const path = `${chapterId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;

  const { error: uploadError } = await sb.storage.from('lessons').upload(path, file);
  if(uploadError){
    setBusy('addLessonBtn','addLessonBtnText', false, 'Add Lesson');
    showToast(uploadError.message, 'error');
    return;
  }
  const { data: urlData } = sb.storage.from('lessons').getPublicUrl(path);

  const { error: insertError } = await sb.from('lessons').insert({
    chapter_id: chapterId, title, order_index: nextOrder, media_url: urlData.publicUrl
  });
  setBusy('addLessonBtn','addLessonBtnText', false, 'Add Lesson');
  if(insertError){ showToast(insertError.message, 'error'); return; }

  titleInput.value = '';
  fileInput.value = '';
  showToast('Lesson uploaded and added to "' + chapter.name + '".');
  await loadChaptersAndLessons();
}

let trialSeconds = 15*60;
let trialInterval = null;
let trialRunning = false;
function toggleTrial(){
  const btn = document.getElementById('trialBtn');
  if(!trialRunning){
    trialRunning = true;
    btn.textContent = '⏸ Pause';
    trialInterval = setInterval(()=>{
      trialSeconds--;
      updateTrialDisplay();
      if(trialSeconds<=0){
        clearInterval(trialInterval);
        trialRunning = false;
        document.getElementById('trialTimer').textContent = "Time's Up";
        btn.textContent = 'Continue for ₹9';
        btn.onclick = ()=>scrollToId('subscribe');
      }
    },1000);
  } else {
    trialRunning = false;
    clearInterval(trialInterval);
    btn.textContent = '▶ Resume';
  }
}
function updateTrialDisplay(){
  const m = Math.floor(trialSeconds/60).toString().padStart(2,'0');
  const s = (trialSeconds%60).toString().padStart(2,'0');
  document.getElementById('trialTimer').textContent = `${m}:${s}`;
  document.getElementById('trialFill').style.width = (trialSeconds/(15*60)*100)+'%';
}

const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
},{threshold:0.15});
revealEls.forEach(el=>io.observe(el));

(async function init(){
  await refreshSession();
  authInitDone = true;
  await Promise.all([ loadSloka(), loadLiveSessions(), loadChaptersAndLessons() ]);
})();
