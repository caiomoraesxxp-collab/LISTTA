const KEY="listta_v1";
const SYNC_KEY="listta_sync_ids";
const DEVICE_ID = localStorage.getItem("listta_device_id") || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
localStorage.setItem("listta_device_id", DEVICE_ID);

let data=JSON.parse(localStorage.getItem(KEY)||'null')||{schools:[]};
let currentSchool=null;
let deferredPrompt=null;
let supa=null;
let syncTimer=null;
let isSyncing=false;
let lastSyncHash="";

const STATUS_OPTS=[
  {key:"nao_chegou",label:"NÃO CHEGOU",color:"#667085"},
  {key:"atendido",label:"ATENDIDO",color:"#16a34a"},
  {key:"faltou",label:"FALTOU",color:"#dc2626"},
  {key:"foi_embora",label:"FOI EMBORA",color:"#ea580c"}
];

const SHIFT_LABELS={manha:"MANHÃ",tarde:"TARDE"};

function normalizeText(value){
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase();
}
function normalizeShift(value){
  return value==="tarde"?"tarde":"manha";
}
function normalizeStatus(value){
  let v=String(value ?? "").trim();
  return STATUS_OPTS.some(o=>o.key===v)?v:"nao_chegou";
}
function structureKey(person){
  if(!person)return "";
  return [normalizeText(person.name), person.date||"", normalizeShift(person.shift), normalizeText(person.doctor||"")].join("|");
}
function statusLabel(k){const o=STATUS_OPTS.find(x=>x.key===k);return o?o.label:"NÃO CHEGOU"}
function statusColor(k){const o=STATUS_OPTS.find(x=>x.key===k);return o?o.color:"#667085"}
function formatDate(d){if(!d)return "";const p=d.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d}
function getSyncIds(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'{"schools":{},"people":{}}')}catch(e){return{"schools":{},"people":{}}}}
function saveSyncIds(ids){localStorage.setItem(SYNC_KEY,JSON.stringify(ids))}
function dataHash(){return JSON.stringify(data.schools)}

function ensureSchoolShape(school){
  if(!school){return null;}
  school.name = String(school.name || "ESCOLA").trim();
  school.people = Array.isArray(school.people)?school.people:[];
  school.people = school.people.map(person=>{
    const clean={...person};
    clean.name = normalizeText(clean.name || "");
    clean.note = String(clean.note ?? "").trim();
    clean.status = normalizeStatus(clean.status);
    clean.date = clean.date || new Date().toISOString().split("T")[0];
    clean.shift = normalizeShift(clean.shift);
    clean.doctor = normalizeText(clean.doctor || "");
    clean.created = clean.created || new Date().toISOString();
    return clean;
  });
  return school;
}

(function migrate(){
  let changed=false;
  data.schools = Array.isArray(data.schools)?data.schools:[];
  data.schools.forEach(s=>{
    s = ensureSchoolShape(s);
    s.people.forEach(p=>{
      if(p.status===undefined){
        p.status = p.done ? "atendido" : "nao_chegou";
        if(p.done!==undefined){delete p.done;changed=true}
      }
      if(!p.date){p.date=(p.created?new Date(p.created):new Date()).toISOString().split("T")[0];changed=true}
      if(!p.shift){p.shift="manha";changed=true}
      if(p.doctor===undefined){p.doctor="";changed=true}
      p.name = normalizeText(p.name || "");
      p.doctor = normalizeText(p.doctor || "");
      p.status = normalizeStatus(p.status);
      p.shift = normalizeShift(p.shift);
    });
  });
  if(changed){localStorage.setItem(KEY,JSON.stringify(data));}
})();

(function initSupabase(){
  const url=window.SUPABASE_URL;
  const key=window.SUPABASE_ANON_KEY;
  if(!url||!key||typeof window.supabase==="undefined")return;
  try{
    supa=window.supabase.createClient(url,key,{realtime:{params:{eventsPerSecond:10}}});
  }catch(e){console.warn("Supabase init failed",e)}
})();

function setSyncIndicator(state){
  let el=document.getElementById("syncIndicator");
  if(!el)return;
  el.className="sync-dot "+state;
  el.title=state==="online"?"SINCRONIZADO":state==="syncing"?"SINCRONIZANDO...":"OFFLINE";
}

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").hidden=false});
document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}};

document.addEventListener("click",e=>{
  if(!e.target.closest(".person-actions"))document.querySelectorAll(".status-menu").forEach(x=>x.hidden=true);
});

function save(){
  localStorage.setItem(KEY,JSON.stringify(data));
  lastSyncHash=dataHash();
  renderSchools();
  updateStats();
  scheduleSync();
}
function esc(s){return String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showScreen(id,btn){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));document.getElementById(id).classList.add("active");document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");}
function goHome(){showScreen("home",document.querySelector(".nav"));currentSchool=null}
function openSchool(id){currentSchool=data.schools.find(s=>s.id===id);if(!currentSchool)return;document.getElementById("schoolTitle").textContent=currentSchool.name;document.getElementById("personSearch").value="";showScreen("school",document.querySelectorAll(".nav")[0]);renderPeople();}
function setTab(tab,btn){document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");document.getElementById("queueTab").hidden=tab!=="queue";document.getElementById("reportTab").hidden=tab!=="report";if(tab==="report"&&currentSchool)renderSchoolReport();}
function openModal(title,body){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body;document.getElementById("modal").hidden=false}
function closeModal(){document.getElementById("modal").hidden=true}

function openSchoolModal(){
  openModal("NOVA ESCOLA",`<div class="field"><label>NOME DA ESCOLA</label><input id="newSchool" placeholder="DIGITE O NOME DA ESCOLA"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="primary" onclick="addSchool()">SALVAR</button></div>`);
  setTimeout(()=>document.getElementById("newSchool").focus(),50)
}
function addSchool(){
  let name=document.getElementById("newSchool").value.trim();
  if(!name)return alert("INFORME O NOME DA ESCOLA.");
  data.schools.push({id:Date.now(),name:name.toUpperCase(),people:[]});
  save();
  closeModal();
}
function renderSchools(){
  let q=(document.getElementById("schoolSearch")?.value||"").toUpperCase();
  let list=data.schools.filter(s=>String(s.name||"").toUpperCase().includes(q));
  let el=document.getElementById("schoolList");
  el.innerHTML=list.length?list.map(s=>`<div class="school-card" onclick="openSchool(${s.id})"><div><h3>${esc(s.name)}</h3><p>${(s.people||[]).length} ATENDIMENTO(S)</p></div><span class="arrow">›</span></div>`).join(""):`<div class="empty">NENHUMA ESCOLA CADASTRADA.</div>`;
  updateStats();
}
function openPersonModal(){
  let today=new Date().toISOString().split("T")[0];
  openModal("NOVO ATENDIMENTO",`<div class="field"><label>NOME</label><input id="personName" placeholder="NOME DA PESSOA"></div><div class="field"><label>OBSERVAÇÃO</label><textarea id="personNote" placeholder="OBSERVAÇÃO"></textarea></div><div class="field split"><div><label>DATA</label><input id="personDate" type="date" value="${today}"></div><div><label>TURNO</label><select id="personShift"><option value="manha">MANHÃ</option><option value="tarde">TARDE</option></select></div></div><div class="field"><label>MÉDICO</label><input id="personDoctor" placeholder="NOME DO MÉDICO"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="primary" onclick="addPerson()">SALVAR</button></div>`);
  setTimeout(()=>document.getElementById("personName").focus(),50)
}
function openImportModal(){
  let today=new Date().toISOString().split("T")[0];
  openModal("IMPORTAR NOMES",`<p class="modal-hint">COLE A LISTA DE NOMES DA PLANILHA OU GOOGLE SHEETS (UM NOME POR LINHA OU SEPARADO POR TABULAÇÃO/SEMICOLON). OS NOMES SERÃO CONVERTIDOS PARA MAIÚSCULAS E OS DUPLICADOS SERÃO IGNORADOS.</p><div class="field"><label>NOMES</label><textarea id="importNames" rows="10" placeholder="EX: JOÃO SILVA\nMARIA\nPEDRO"></textarea></div><div class="field split"><div><label>DATA</label><input id="importDate" type="date" value="${today}"></div><div><label>TURNO</label><select id="importShift"><option value="manha">MANHÃ</option><option value="tarde">TARDE</option></select></div></div><div class="field"><label>MÉDICO</label><input id="importDoctor" placeholder="NOME DO MÉDICO"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="primary" onclick="doImport()">IMPORTAR</button></div>`);
  setTimeout(()=>document.getElementById("importNames").focus(),50)
}
function parseImportedNames(raw){
  const rows=(raw||"").replace(/\r/g,"").split("\n");
  const collected=[];
  rows.forEach(row=>{
    const candidates = row.split(/[\t;|,]+/).map(v=>v.trim()).filter(Boolean);
    candidates.forEach(part=>{
      const clean=part.replace(/^\d+[\).\-\s]*/,"").trim();
      if(clean)collected.push(clean)
    });
  });
  return [...new Set(collected.map(v=>normalizeText(v)).filter(Boolean))];
}
function doImport(){
  let raw=document.getElementById("importNames").value;
  let date=document.getElementById("importDate").value||new Date().toISOString().split("T")[0];
  let shift=document.getElementById("importShift").value;
  let doctor=document.getElementById("importDoctor").value.trim();
  let names=parseImportedNames(raw);
  if(!names.length)return alert("COLE PELO MENOS UM NOME.");
  let seen=new Set((currentSchool.people||[]).map(p=>structureKey({name:p.name,date:p.date,shift:p.shift,doctor:p.doctor})));
  let added=0,skipped=0;
  names.forEach(name=>{
    let key=structureKey({name,date,shift,doctor});
    if(seen.has(key)){
      skipped++;
      return;
    }
    currentSchool.people.push({id:Date.now()+Math.floor(Math.random()*10000),name, note:"", status:"nao_chegou", date, shift, doctor:normalizeText(doctor), created:new Date().toISOString()});
    seen.add(key);
    added++;
  });
  save();closeModal();renderPeople();
  alert(`IMPORTAÇÃO CONCLUÍDA!\n\nADICIONADOS: ${added}\nDUPLICADOS IGNORADOS: ${skipped}`);
}
function addPerson(){
  let name=document.getElementById("personName").value.trim();
  let note=document.getElementById("personNote").value.trim();
  let date=document.getElementById("personDate").value||new Date().toISOString().split("T")[0];
  let shift=document.getElementById("personShift").value;
  let doctor=document.getElementById("personDoctor").value.trim();
  if(!name)return alert("INFORME O NOME.");
  currentSchool.people.push({id:Date.now(),name:normalizeText(name),note,status:"nao_chegou",date,shift:normalizeShift(shift),doctor:normalizeText(doctor),created:new Date().toISOString()});
  save();closeModal();renderPeople()
}
function setStatus(id,status){
  let p=currentSchool.people.find(x=>x.id===id);
  if(p){p.status=normalizeStatus(status);save();renderPeople()}
}
function toggleStatusMenu(id){
  let m=document.getElementById("menu-"+id);if(!m)return;
  let isOpen=!m.hidden;
  document.querySelectorAll(".status-menu").forEach(x=>x.hidden=true);
  m.hidden=isOpen;
}
function removePerson(id){if(confirm("EXCLUIR ESTE ATENDIMENTO?")){currentSchool.people=currentSchool.people.filter(x=>x.id!==id);save();renderPeople()}}
function renderPeople(){
  if(!currentSchool)return;
  let q=(document.getElementById("personSearch")?.value||"").toUpperCase();
  let arr=(currentSchool.people||[]).filter(p=>String(p.name||"").toUpperCase().includes(q));
  let el=document.getElementById("peopleList");
  el.innerHTML=arr.length?arr.map(p=>{
    let info=[p.doctor?p.doctor.toUpperCase():"", SHIFT_LABELS[p.shift]||"MANHÃ", formatDate(p.date), p.note].filter(Boolean).join(" • ");
    return `<div class="person"><div class="person-main"><b>${esc(p.name)}</b><small>${esc(info)}</small></div><div class="person-actions"><button class="status-toggle" data-id="${p.id}" onclick="toggleStatusMenu(${p.id})" title="${statusLabel(p.status)}" style="background:${statusColor(p.status)}">+</button><div id="menu-${p.id}" class="status-menu" hidden>${STATUS_OPTS.map(o=>`<button class="status-opt" data-id="${p.id}" data-status="${o.key}" onclick="setStatus(${p.id},'${o.key}')">${o.label}</button>`).join("")}</div></div></div>`;
  }).join(""):`<div class="empty">NENHUM ATENDIMENTO.<br><br>TOQUE EM "ATENDIMENTO" PARA ADICIONAR.</div>`;
}
function totals(){let all=data.schools.flatMap(s=>(s.people||[]));return {all,done:all.filter(p=>p.status==="atendido").length}}
function updateStats(){
  let t=totals();
  const schoolCount=document.getElementById("schoolCount");
  const doneCount=document.getElementById("doneCount");
  const todayCount=document.getElementById("todayCount");
  if(schoolCount)schoolCount.textContent=data.schools.length;
  if(doneCount)doneCount.textContent=t.done;
  let today=new Date().toISOString().split("T")[0];
  if(todayCount)todayCount.textContent=data.schools.flatMap(s=>(s.people||[])).filter(p=>p.date===today).length;
}
function groupPeople(people){
  let groups={};
  people.forEach(p=>{
    let key=(p.date||"")+"|"+(p.shift||"")+"|"+(p.doctor||"");
    if(!groups[key])groups[key]={date:p.date,shift:p.shift,doctor:p.doctor,people:[]};
    groups[key].people.push(p);
  });
  return Object.keys(groups).sort().map(k=>groups[k]);
}
function renderSchoolReport(){
  if(!currentSchool)return;
  let people=currentSchool.people||[];
  let counts={};STATUS_OPTS.forEach(o=>counts[o.key]=people.filter(p=>p.status===o.key).length);
  let html=`<div class="report-box"><h3>${esc(currentSchool.name)}</h3><div class="big">${people.length}</div><p>ATENDIMENTOS REGISTRADOS</p></div>`;
  html+=`<div class="report-box"><h3>STATUS</h3>${STATUS_OPTS.map(o=>`<p><span class="dot" style="background:${o.color}"></span>${o.label}: ${counts[o.key]}</p>`).join("")}</div>`;
  groupPeople(people).forEach(g=>{
    let label=`${formatDate(g.date)} • ${SHIFT_LABELS[g.shift]||"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
    html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
  });
  document.getElementById("schoolReport").innerHTML=html||`<div class="empty">NENHUM REGISTRO.</div>`;
}
function renderGlobalReport(){
  let all=data.schools.flatMap(s=>(s.people||[]));
  let counts={};STATUS_OPTS.forEach(o=>counts[o.key]=all.filter(p=>p.status===o.key).length);
  let html=`<div class="report-box"><h3>TOTAL GERAL</h3><div class="big">${all.length}</div><p>ATENDIMENTOS</p></div>`;
  html+=`<div class="report-box"><h3>STATUS</h3>${STATUS_OPTS.map(o=>`<p><span class="dot" style="background:${o.color}"></span>${o.label}: ${counts[o.key]}</p>`).join("")}</div>`;
  data.schools.forEach(s=>{
    if(!(s.people||[]).length)return;
    groupPeople(s.people).forEach(g=>{
      let label=`${esc(s.name)} • ${formatDate(g.date)} • ${SHIFT_LABELS[g.shift]||"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
      html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
    });
  });
  document.getElementById("globalReport").innerHTML=html;
}
function exportReport(){
  let all=data.schools.flatMap(s=>(s.people||[]));
  let lines=["LISTTA — RELATÓRIO GERAL","DATA: "+new Date().toLocaleDateString("PT-BR"),"","TOTAL DE ESCOLAS: "+data.schools.length,"TOTAL DE ATENDIMENTOS: "+all.length,""];
  STATUS_OPTS.forEach(o=>lines.push(`${o.label}: ${all.filter(p=>p.status===o.key).length}`));
  lines.push("");
  data.schools.forEach(s=>{
    if(!(s.people||[]).length)return;
    groupPeople(s.people).forEach(g=>{
      lines.push("ESCOLA: "+s.name);
      lines.push("DATA: "+formatDate(g.date)+" • TURNO: "+(SHIFT_LABELS[g.shift]||"MANHÃ")+(g.doctor?" • MÉDICO: "+g.doctor:""));
      g.people.forEach((p,i)=>lines.push(`${i+1}. ${p.name} — ${statusLabel(p.status)}${p.note?" — "+p.note:""}`));
      lines.push("");
    });
  });
  let blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="RELATORIO-LISTTA.txt";a.click();URL.revokeObjectURL(a.href)
}
function renderOldReport(){
  let dateInput=document.getElementById("reportDate");
  let el=document.getElementById("oldReport");
  if(!el)return;
  if(!dateInput||!dateInput.value){el.innerHTML=`<div class="empty">SELECIONE UMA DATA PARA VISUALIZAR O RELATÓRIO.</div>`;return}
  let date=dateInput.value;
  let allForDate=data.schools.flatMap(s=>(s.people||[]).filter(p=>p.date===date).map(p=>({...p,schoolName:s.name})));
  if(!allForDate.length){el.innerHTML=`<div class="empty">NENHUM ATENDIMENTO ENCONTRADO EM ${formatDate(date)}.</div>`;return}
  let counts={};STATUS_OPTS.forEach(o=>counts[o.key]=allForDate.filter(p=>p.status===o.key).length);
  let html=`<div class="report-box"><h3>RELATÓRIO DE ${formatDate(date)}</h3><div class="big">${allForDate.length}</div><p>ATENDIMENTOS</p></div>`;
  html+=`<div class="report-box"><h3>STATUS</h3>${STATUS_OPTS.map(o=>`<p><span class="dot" style="background:${o.color}"></span>${o.label}: ${counts[o.key]}</p>`).join("")}</div>`;
  let groups={};
  allForDate.forEach(p=>{
    let key=(p.schoolName||"")+"|"+(p.shift||"")+"|"+(p.doctor||"");
    if(!groups[key])groups[key]={schoolName:p.schoolName,shift:p.shift,doctor:p.doctor,people:[]};
    groups[key].people.push(p);
  });
  Object.keys(groups).sort().forEach(k=>{
    let g=groups[k];
    let label=`${esc(g.schoolName)} • ${formatDate(date)} • ${SHIFT_LABELS[g.shift]||"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
    html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
  });
  el.innerHTML=html;
}
function exportOldReport(){
  let dateInput=document.getElementById("reportDate");
  if(!dateInput||!dateInput.value)return alert("SELECIONE UMA DATA PRIMEIRO.");
  let date=dateInput.value;
  let allForDate=data.schools.flatMap(s=>(s.people||[]).filter(p=>p.date===date).map(p=>({...p,schoolName:s.name})));
  if(!allForDate.length)return alert("NENHUM ATENDIMENTO ENCONTRADO NESTA DATA.");
  let lines=["LISTTA — RELATÓRIO DE "+formatDate(date),"","","TOTAL DE ATENDIMENTOS: "+allForDate.length,""];
  STATUS_OPTS.forEach(o=>lines.push(`${o.label}: ${allForDate.filter(p=>p.status===o.key).length}`));
  lines.push("");
  let groups={};
  allForDate.forEach(p=>{
    let key=(p.schoolName||"")+"|"+(p.shift||"")+"|"+(p.doctor||"");
    if(!groups[key])groups[key]={schoolName:p.schoolName,shift:p.shift,doctor:p.doctor,people:[]};
    groups[key].people.push(p);
  });
  Object.keys(groups).sort().forEach(k=>{
    let g=groups[k];
    lines.push("ESCOLA: "+g.schoolName);
    lines.push("DATA: "+formatDate(date)+" • TURNO: "+(SHIFT_LABELS[g.shift]||"MANHÃ")+(g.doctor?" • MÉDICO: "+g.doctor:""));
    g.people.forEach((p,i)=>lines.push(`${i+1}. ${p.name} — ${statusLabel(p.status)}${p.note?" — "+p.note:""}`));
    lines.push("");
  });
  let fname="RELATORIO-LISTTA-"+date+".txt";
  let blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;a.click();URL.revokeObjectURL(a.href)
}

function scheduleSync(){
  if(!supa)return;
  if(syncTimer)clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>doSync(),2000);
}

async function doSync(){
  if(!supa||isSyncing)return;
  if(!navigator.onLine){setSyncIndicator("offline");return}
  if(dataHash()===lastSyncHash)return;
  isSyncing=true;
  setSyncIndicator("syncing");
  try{
    let ids=getSyncIds();
    await pushToRemote(ids);
    await pullFromRemote(ids);
    lastSyncHash=dataHash();
    setSyncIndicator("online");
  }catch(e){
    console.warn("Sync error",e);
    setSyncIndicator("offline");
  }
  isSyncing=false;
}

async function pushToRemote(ids){
  for(let s of data.schools){
    let sid=String(s.id);
    if(ids.schools[sid]){
      await supa.from("schools").update({name:s.name,updated_at:new Date().toISOString(),deleted:false}).eq("id",ids.schools[sid]);
    }else{
      let {data:row,error}=await supa.from("schools").insert({name:s.name}).select("id").maybeSingle();
      if(row)ids.schools[sid]=row.id;
    }
    for(let p of (s.people||[])){
      let pid=String(p.id);
      const payload={
        school_id:ids.schools[sid],
        name:normalizeText(p.name),
        note:p.note||"",
        status:normalizeStatus(p.status),
        date:p.date,
        shift:normalizeShift(p.shift),
        doctor:normalizeText(p.doctor||""),
        updated_at:new Date().toISOString(),
        deleted:false
      };
      if(ids.people[pid]){
        await supa.from("people").update(payload).eq("id",ids.people[pid]);
      }else{
        let {data:row,error}=await supa.from("people").insert(payload).select("id").maybeSingle();
        if(row)ids.people[pid]=row.id;
      }
    }
  }
  saveSyncIds(ids);
}

async function pullFromRemote(ids){
  let {data:remoteSchools,error:se}=await supa.from("schools").select("id,name,deleted,updated_at").eq("deleted",false);
  if(se)throw se;
  (remoteSchools||[]).forEach(rs=>{
    let localId=Object.keys(ids.schools).find(k=>ids.schools[k]===rs.id);
    if(localId){
      let s=data.schools.find(x=>String(x.id)===localId);
      if(s&&rs.name)s.name=String(rs.name).toUpperCase();
    }
  });

  let {data:remotePeople,error:pe}=await supa.from("people").select("id,school_id,name,note,status,date,shift,doctor,deleted,updated_at").eq("deleted",false);
  if(pe)throw pe;

  const remoteByKey = new Map();
  (remotePeople||[]).forEach(rp=>{
    let schoolLocalId=Object.keys(ids.schools).find(k=>ids.schools[k]===rp.school_id);
    if(!schoolLocalId)return;
    let s=data.schools.find(x=>String(x.id)===schoolLocalId);
    if(!s)return;
    const key=structureKey({name:rp.name,date:rp.date,shift:rp.shift,doctor:rp.doctor});
    remoteByKey.set(key,{...rp, schoolLocalId, key});
  });

  data.schools.forEach(s=>{
    const localByKey = new Map();
    (s.people||[]).forEach(p=>localByKey.set(structureKey(p), p));
    const merged = [];
    (s.people||[]).forEach(p=>merged.push(p));
    remoteByKey.forEach((rp, key)=>{
      if(rp.schoolLocalId!==String(s.id))return;
      const local = localByKey.get(key);
      if(local){
        local.name=normalizeText(rp.name); local.note=String(rp.note||"").trim(); local.status=normalizeStatus(rp.status); local.date=rp.date||local.date; local.shift=normalizeShift(rp.shift); local.doctor=normalizeText(rp.doctor||"");
      }else{
        const newId=Date.now()+Math.floor(Math.random()*1000);
        const syncedPerson={
          id:newId,
          name:normalizeText(rp.name),
          note:String(rp.note||"").trim(),
          status:normalizeStatus(rp.status),
          date:rp.date||new Date().toISOString().split("T")[0],
          shift:normalizeShift(rp.shift),
          doctor:normalizeText(rp.doctor||""),
          created:rp.created_at || new Date().toISOString()
        };
        merged.push(syncedPerson);
        ids.people[String(newId)]=rp.id;
      }
    });
    s.people = merged;
  });

  saveSyncIds(ids);
  localStorage.setItem(KEY,JSON.stringify(data));
  lastSyncHash=dataHash();
  renderSchools();
  if(currentSchool)renderPeople();
}

window.addEventListener("online",()=>{setSyncIndicator("syncing");doSync()});
window.addEventListener("offline",()=>setSyncIndicator("offline"));

if(supa){
  supa.channel("listta_changes")
    .on("postgres_changes",{event:"*",schema:"public",table:"schools"},()=>{if(!isSyncing)doSync()})
    .on("postgres_changes",{event:"*",schema:"public",table:"people"},()=>{if(!isSyncing)doSync()})
    .subscribe();
  if(navigator.onLine){setSyncIndicator("syncing");doSync()}
}else{
  setSyncIndicator("offline");
}

renderSchools();
updateStats();
