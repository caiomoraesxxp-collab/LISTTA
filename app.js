const KEY="listta_v1";
let data=JSON.parse(localStorage.getItem(KEY)||'null')||{schools:[]};
let currentSchool=null;
let currentShift=null;
let deferredPrompt=null;
let supa=null;
let syncTimer=null;
let isSyncing=false;
let lastSyncHash="";
const SYNC_KEY="listta_sync_ids";

const STATUS_OPTS=[
  {key:"nao_chegou",label:"NÃO CHEGOU",color:"#667085"},
  {key:"atendido",label:"ATENDIDO",color:"#16a34a"},
  {key:"faltou",label:"FALTOU",color:"#dc2626"},
  {key:"foi_embora",label:"FOI EMBORA",color:"#ea580c"}
];

function statusLabel(k){let o=STATUS_OPTS.find(x=>x.key===k);return o?o.label:"NÃO CHEGOU"}
function statusColor(k){let o=STATUS_OPTS.find(x=>x.key===k);return o?o.color:"#667085"}
function formatDate(d){if(!d)return "";let p=d.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d}

function getSyncIds(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'{"schools":{},"people":{}}')}catch(e){return{"schools":{},"people":{}}}}
function saveSyncIds(ids){localStorage.setItem(SYNC_KEY,JSON.stringify(ids))}
function dataHash(){return JSON.stringify(data.schools)}

(function migrate(){
  let changed=false;
  data.schools.forEach(s=>{
    s.people.forEach(p=>{
      if(p.status===undefined){
        p.status=p.done?"atendido":"nao_chegou";
        if(p.done!==undefined){delete p.done;changed=true}
      }
      if(!p.date){p.date=(p.created?new Date(p.created):new Date()).toISOString().split("T")[0];changed=true}
      if(!p.shift){p.shift="manha";changed=true}
      if(p.doctor===undefined){p.doctor="";changed=true}
    });
  });
  if(changed)localStorage.setItem(KEY,JSON.stringify(data));
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
  renderSchools();
  updateStats();
  scheduleSync();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showScreen(id,btn){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));document.getElementById(id).classList.add("active");document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active")}
function goHome(){showScreen("home",document.querySelector(".nav"));currentSchool=null;currentShift=null}
function openSchool(id){
  const school=data.schools.find(s=>String(s.id)===String(id));
  if(!school)return;
  openModal("SELECIONE O TURNO",`<p class="modal-hint">${esc(school.name)}<br>ESCOLHA A LISTA QUE DESEJA ABRIR.</p><div class="form-actions"><button class="save" onclick="enterSchool(${school.id},'manha')">MANHÃ</button><button class="save" onclick="enterSchool(${school.id},'tarde')">TARDE</button></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button></div>`);
}
function enterSchool(id,shift){
  currentSchool=data.schools.find(s=>String(s.id)===String(id));
  if(!currentSchool)return;
  currentShift=shift==="tarde"?"tarde":"manha";
  closeModal();
  document.getElementById("schoolTitle").textContent=currentSchool.name+" — "+(currentShift==="tarde"?"TARDE":"MANHÃ");
  document.getElementById("personSearch").value="";
  showScreen("school");
  setTab("queue",document.querySelector(".tab"));
  renderPeople();
}
function setTab(tab,btn){document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");document.getElementById("queueTab").hidden=tab!=="queue";document.getElementById("reportTab").hidden=tab!=="report";if(tab==="report")renderSchoolReport()}
function openModal(title,body){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body;document.getElementById("modal").hidden=false}
function closeModal(){document.getElementById("modal").hidden=true}

function openSchoolModal(){
openModal("NOVA ESCOLA",`<div class="field"><label>NOME DA ESCOLA</label><input id="newSchool" placeholder="DIGITE O NOME DA ESCOLA"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="save" onclick="addSchool()">SALVAR</button></div>`);
setTimeout(()=>document.getElementById("newSchool").focus(),50)
}
function addSchool(){let name=document.getElementById("newSchool").value.trim();if(!name)return alert("INFORME O NOME DA ESCOLA.");data.schools.push({id:Date.now(),name,people:[]});save();closeModal()}
function renderSchools(){
let q=(document.getElementById("schoolSearch")?.value||"").toUpperCase();let list=data.schools.filter(s=>s.name.includes(q));let el=document.getElementById("schoolList");
el.innerHTML=list.length?list.map(s=>`<div class="school-card" onclick="openSchool(${s.id})"><div><h3>${esc(s.name)}</h3><p>${s.people.length} ATENDIMENTO(S)</p></div><span class="arrow">›</span></div>`).join(""):`<div class="empty">NENHUMA ESCOLA CADASTRADA.<br><br>TOQUE EM "NOVA ESCOLA" PARA COMEÇAR.</div>`;
updateStats()
}
function openPersonModal(){
let today=new Date().toISOString().split("T")[0];
openModal("NOVO ATENDIMENTO",`<div class="field"><label>NOME</label><input id="personName" placeholder="NOME DA PESSOA"></div><div class="field"><label>OBSERVAÇÃO</label><textarea id="personNote" placeholder="OBSERVAÇÃO (OPCIONAL)"></textarea></div><div class="field-row"><div class="field"><label>DATA</label><input type="date" id="personDate" value="${today}"></div><div class="field"><label>TURNO DA LISTA</label><input value="${currentShift==="tarde"?"TARDE":"MANHÃ"}" disabled></div></div><div class="field"><label>MÉDICO</label><input id="personDoctor" placeholder="NOME DO MÉDICO"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="save" onclick="addPerson()">ADICIONAR</button></div>`);
setTimeout(()=>document.getElementById("personName").focus(),50)
}
function openImportModal(){
let today=new Date().toISOString().split("T")[0];
openModal("IMPORTAR NOMES",`<p class="modal-hint">COLE A LISTA DE NOMES DA PLANILHA (UM NOME POR LINHA). OS NOMES SERÃO CONVERTIDOS PARA MAIÚSCULAS E OS DUPLICADOS SERÃO IGNORADOS.</p><div class="field"><label>NOMES</label><textarea id="importNames" placeholder="JOÃO SILVA&#10;MARIA SANTOS&#10;PEDRO OLIVEIRA"></textarea></div><div class="field-row"><div class="field"><label>DATA</label><input type="date" id="importDate" value="${today}"></div><div class="field"><label>TURNO DA LISTA</label><input value="${currentShift==="tarde"?"TARDE":"MANHÃ"}" disabled></div></div><div class="field"><label>MÉDICO</label><input id="importDoctor" placeholder="NOME DO MÉDICO (OPCIONAL)"></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="save" onclick="doImport()">IMPORTAR</button></div>`);
setTimeout(()=>document.getElementById("importNames").focus(),50)
}
function doImport(){
let raw=document.getElementById("importNames").value;
let date=document.getElementById("importDate").value||new Date().toISOString().split("T")[0];
let shift=currentShift||"manha";
let doctor=document.getElementById("importDoctor").value.trim().toUpperCase();
let names=raw.split(/[\n\r\t;]+/).map(n=>n.trim().toUpperCase()).filter(n=>n.length>0);
if(!names.length)return alert("COLE PELO PELO MENOS UM NOME.");
let existing=new Set(currentSchool.people.filter(p=>(p.shift||"manha")===shift).map(p=>p.name.toUpperCase()));
let added=0,skipped=0;
names.forEach(name=>{
if(existing.has(name)){skipped++;return}
let id=Date.now()+Math.floor(Math.random()*10000);
currentSchool.people.push({id,name,note:"",status:"nao_chegou",date,shift,doctor,created:new Date().toISOString()});
existing.add(name);
added++;
});
save();closeModal();renderPeople();
alert(`IMPORTAÇÃO CONCLUÍDA!\n\nADICIONADOS: ${added}\nDUPLICADOS IGNORADOS: ${skipped}`);
}
function addPerson(){
let name=document.getElementById("personName").value.trim().toUpperCase();
let note=document.getElementById("personNote").value.trim();
let date=document.getElementById("personDate").value||new Date().toISOString().split("T")[0];
let shift=currentShift||"manha";
let doctor=document.getElementById("personDoctor").value.trim().toUpperCase();
if(!name)return alert("INFORME O NOME.");
currentSchool.people.push({id:Date.now(),name,note,status:"nao_chegou",date,shift,doctor,created:new Date().toISOString()});
save();closeModal();renderPeople()
}
function setStatus(id,status){let p=currentSchool.people.find(x=>x.id===id);if(p){p.status=status;save();renderPeople()}}
function toggleStatusMenu(id){
let m=document.getElementById("menu-"+id);if(!m)return;
let isOpen=!m.hidden;
document.querySelectorAll(".status-menu").forEach(x=>x.hidden=true);
m.hidden=isOpen;
}
function removePerson(id){if(confirm("EXCLUIR ESTE ATENDIMENTO?")){currentSchool.people=currentSchool.people.filter(x=>x.id!==id);save();renderPeople()}}
function renderPeople(){
let q=(document.getElementById("personSearch")?.value||"").toUpperCase();let arr=currentSchool.people.filter(p=>(p.shift||"manha")===currentShift&&p.name.includes(q));let el=document.getElementById("peopleList");
el.innerHTML=arr.length?arr.map(p=>{
let info=[p.doctor,p.shift==="tarde"?"TARDE":"MANHÃ",formatDate(p.date),p.note].filter(Boolean).join(" • ");
return `<div class="person"><div class="person-main"><b>${esc(p.name)}</b><small>${esc(info)}</small></div><div class="person-actions"><button class="status-btn" style="background:${statusColor(p.status)}" onclick="toggleStatusMenu(${p.id})">${statusLabel(p.status)} ▾</button><div class="status-menu" id="menu-${p.id}" hidden>${STATUS_OPTS.map(o=>`<button class="status-opt" onclick="setStatus(${p.id},'${o.key}')">${o.label}</button>`).join("")}</div><button class="delete" onclick="removePerson(${p.id})">×</button></div></div>`;
}).join(""):`<div class="empty">NENHUM ATENDIMENTO.<br><br>TOQUE EM "ATENDIMENTO" PARA ADICIONAR.</div>`;
}
function totals(){let all=data.schools.flatMap(s=>s.people);return {all,done:all.filter(p=>p.status==="atendido").length}}
function updateStats(){let t=totals();document.getElementById("schoolCount").textContent=data.schools.length;document.getElementById("doneCount").textContent=t.done;let today=new Date().toISOString().split("T")[0];document.getElementById("todayCount").textContent=t.all.filter(p=>p.date===today).length}
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
let people=currentSchool.people.filter(p=>(p.shift||"manha")===currentShift);
let counts={};STATUS_OPTS.forEach(o=>counts[o.key]=people.filter(p=>p.status===o.key).length);
let html=`<div class="report-box"><h3>${esc(currentSchool.name)} — ${currentShift==="tarde"?"TARDE":"MANHÃ"}</h3><div class="big">${people.length}</div><p>ATENDIMENTOS REGISTRADOS</p></div>`;
html+=`<div class="report-box"><h3>STATUS</h3>${STATUS_OPTS.map(o=>`<p><span class="dot" style="background:${o.color}"></span>${o.label}: ${counts[o.key]}</p>`).join("")}</div>`;
groupPeople(people).forEach(g=>{
let label=`${formatDate(g.date)} • ${g.shift==="tarde"?"TARDE":"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
});
document.getElementById("schoolReport").innerHTML=html||`<div class="empty">NENHUM REGISTRO.</div>`;
}
function renderGlobalReport(){
let all=data.schools.flatMap(s=>s.people);
let counts={};STATUS_OPTS.forEach(o=>counts[o.key]=all.filter(p=>p.status===o.key).length);
let html=`<div class="report-box"><h3>TOTAL GERAL</h3><div class="big">${all.length}</div><p>ATENDIMENTOS</p></div>`;
html+=`<div class="report-box"><h3>STATUS</h3>${STATUS_OPTS.map(o=>`<p><span class="dot" style="background:${o.color}"></span>${o.label}: ${counts[o.key]}</p>`).join("")}</div>`;
data.schools.forEach(s=>{
if(!s.people.length)return;
groupPeople(s.people).forEach(g=>{
let label=`${esc(s.name)} • ${formatDate(g.date)} • ${g.shift==="tarde"?"TARDE":"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
});
});
document.getElementById("globalReport").innerHTML=html;
}
function exportReport(){
let all=data.schools.flatMap(s=>s.people);
let lines=["LISTTA — RELATÓRIO GERAL","DATA: "+new Date().toLocaleDateString("PT-BR"),"","TOTAL DE ESCOLAS: "+data.schools.length,"TOTAL DE ATENDIMENTOS: "+all.length,""];
STATUS_OPTS.forEach(o=>lines.push(`${o.label}: ${all.filter(p=>p.status===o.key).length}`));
lines.push("");
data.schools.forEach(s=>{
if(!s.people.length)return;
groupPeople(s.people).forEach(g=>{
lines.push("ESCOLA: "+s.name);
lines.push("DATA: "+formatDate(g.date)+" • TURNO: "+(g.shift==="tarde"?"TARDE":"MANHÃ")+(g.doctor?" • MÉDICO: "+g.doctor:""));
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
let allForDate=data.schools.flatMap(s=>s.people.filter(p=>p.date===date).map(p=>({...p,schoolName:s.name})));
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
let label=`${esc(g.schoolName)} • ${formatDate(date)} • ${g.shift==="tarde"?"TARDE":"MANHÃ"}${g.doctor?" • "+esc(g.doctor):""}`;
html+=`<div class="report-box"><h3>${esc(label)}</h3>${g.people.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${statusLabel(p.status)}</p>`).join("")}</div>`;
});
el.innerHTML=html;
}
function exportOldReport(){
let dateInput=document.getElementById("reportDate");
if(!dateInput||!dateInput.value)return alert("SELECIONE UMA DATA PRIMEIRO.");
let date=dateInput.value;
let allForDate=data.schools.flatMap(s=>s.people.filter(p=>p.date===date).map(p=>({...p,schoolName:s.name})));
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
lines.push("DATA: "+formatDate(date)+" • TURNO: "+(g.shift==="tarde"?"TARDE":"MANHÃ")+(g.doctor?" • MÉDICO: "+g.doctor:""));
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
  isSyncing=true;
  setSyncIndicator("syncing");
  try{
    let ids=getSyncIds();
    // Enviar somente quando houve alteração local; sempre consultar o remoto,
    // inclusive em dispositivos novos e após eventos de tempo real.
    if(dataHash()!==lastSyncHash) await pushToRemote(ids);
    await pullFromRemote(ids);
    lastSyncHash=dataHash();
    setSyncIndicator("online");
  }catch(e){
    console.warn("Sync error",e);
    setSyncIndicator("offline");
  }finally{
    isSyncing=false;
  }
}

async function pushToRemote(ids){
  for(let s of data.schools){
    let sid=String(s.id);
    if(ids.schools[sid]){
      const {error}=await supa.from("schools").update({
        name:s.name,updated_at:new Date().toISOString(),deleted:false
      }).eq("id",ids.schools[sid]);
      if(error)throw error;
    }else{
      let{data:row,error}=await supa.from("schools").insert({
        name:s.name,deleted:false,updated_at:new Date().toISOString()
      }).select("id").maybeSingle();
      if(error)throw error;
      if(row)ids.schools[sid]=row.id;
      else throw new Error("Não foi possível salvar a escola no servidor.");
    }
    for(let p of s.people){
      let pid=String(p.id);
      if(ids.people[pid]){
        const {error}=await supa.from("people").update({
          name:p.name,note:p.note||"",status:p.status,date:p.date,shift:p.shift,doctor:p.doctor||"",
          updated_at:new Date().toISOString(),deleted:false
        }).eq("id",ids.people[pid]);
        if(error)throw error;
      }else{
        if(!ids.schools[sid])throw new Error("A escola ainda não foi sincronizada.");
        let{data:row,error}=await supa.from("people").insert({
          school_id:ids.schools[sid],name:p.name,note:p.note||"",status:p.status,date:p.date,shift:p.shift,doctor:p.doctor||"",deleted:false,updated_at:new Date().toISOString()
        }).select("id").maybeSingle();
        if(error)throw error;
        if(row)ids.people[pid]=row.id;
        else throw new Error("Não foi possível salvar o atendimento no servidor.");
      }
    }
  }
  saveSyncIds(ids);
}

async function pullFromRemote(ids){
  let{data:remoteSchools,error:se}=await supa.from("schools").select("id,name,deleted,updated_at").eq("deleted",false);
  if(se)throw se;
  let remoteSchoolIds={};
  let remotePeopleIds={};
  (remoteSchools||[]).forEach(rs=>{
    let localId=Object.keys(ids.schools).find(k=>String(ids.schools[k])===String(rs.id));
    if(localId){
      remoteSchoolIds[localId]=rs;
      let school=data.schools.find(x=>String(x.id)===localId);
      if(school&&rs.name&&school.name!==rs.name)school.name=rs.name;
    }else{
      // Uma escola criada em outro celular/computador precisa ser criada localmente
      // e vinculada ao ID remoto para que seus alunos também sejam importados.
      let existing=data.schools.find(x=>x.name.trim().toUpperCase()===String(rs.name||"").trim().toUpperCase());
      if(existing){
        localId=String(existing.id);
      }else{
        localId=String(Date.now()+Math.floor(Math.random()*100000));
        data.schools.push({id:Number(localId),name:rs.name||"ESCOLA",people:[]});
      }
      ids.schools[localId]=rs.id;
      remoteSchoolIds[localId]=rs;
    }
  });
  let{data:remotePeople,error:pe}=await supa.from("people").select("id,school_id,name,note,status,date,shift,doctor,deleted,updated_at").eq("deleted",false);
  if(pe)throw pe;
  (remotePeople||[]).forEach(rp=>{
    let schoolLocalId=Object.keys(ids.schools).find(k=>ids.schools[k]===rp.school_id);
    if(!schoolLocalId)return;
    let s=data.schools.find(x=>String(x.id)===schoolLocalId);
    if(!s)return;
    let localPid=Object.keys(ids.people).find(k=>ids.people[k]===rp.id);
    if(localPid){
      let p=s.people.find(x=>String(x.id)===localPid);
      if(p){
        p.name=rp.name;p.note=rp.note||"";p.status=rp.status;p.date=rp.date;p.shift=rp.shift;p.doctor=rp.doctor||"";
      }
      remotePeopleIds[localPid]=true;
    }else{
      let newId=Date.now()+Math.floor(Math.random()*1000);
      ids.people[String(newId)]=rp.id;
      s.people.push({id:newId,name:rp.name,note:rp.note||"",status:rp.status,date:rp.date,shift:rp.shift,doctor:rp.doctor||"",created:rp.created_at});
      remotePeopleIds[String(newId)]=true;
    }
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

renderSchools();updateStats();
