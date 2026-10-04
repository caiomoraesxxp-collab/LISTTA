const KEY="listta_v1";
let data=JSON.parse(localStorage.getItem(KEY)||'null')||{schools:[]};
let currentSchool=null;
let deferredPrompt=null;

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").hidden=false});
document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}};

function save(){localStorage.setItem(KEY,JSON.stringify(data));renderSchools();updateStats()}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showScreen(id,btn){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));document.getElementById(id).classList.add("active");document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active")}
function goHome(){showScreen("home",document.querySelector(".nav"));currentSchool=null}
function openSchool(id){currentSchool=data.schools.find(s=>s.id===id);document.getElementById("schoolTitle").textContent=currentSchool.name;document.getElementById("personSearch").value="";showScreen("school");setTab("queue",document.querySelector(".tab"));renderPeople()}
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
el.innerHTML=list.length?list.map(s=>`<div class="school-card" onclick="openSchool(${s.id})"><div><h3>${esc(s.name)}</h3><p>${s.people.length} ATENDIMENTO(S)</p></div><span class="arrow">›</span></div>`).join(""):`<div class="empty">NENHUMA ESCOLA CADASTRADA.<br><br>TOQUE EM “NOVA ESCOLA” PARA COMEÇAR.</div>`;
updateStats()
}
function openPersonModal(){
openModal("NOVO ATENDIMENTO",`<div class="field"><label>NOME</label><input id="personName" placeholder="NOME DA PESSOA"></div><div class="field"><label>OBSERVAÇÃO</label><textarea id="personNote" placeholder="OBSERVAÇÃO (OPCIONAL)"></textarea></div><div class="form-actions"><button class="cancel" onclick="closeModal()">CANCELAR</button><button class="save" onclick="addPerson()">ADICIONAR</button></div>`);
setTimeout(()=>document.getElementById("personName").focus(),50)
}
function addPerson(){let name=document.getElementById("personName").value.trim();let note=document.getElementById("personNote").value.trim();if(!name)return alert("INFORME O NOME.");currentSchool.people.push({id:Date.now(),name,note,done:false,created:new Date().toISOString()});save();closeModal();renderPeople()}
function togglePerson(id){let p=currentSchool.people.find(x=>x.id===id);p.done=!p.done;save();renderPeople()}
function removePerson(id){if(confirm("EXCLUIR ESTE ATENDIMENTO?")){currentSchool.people=currentSchool.people.filter(x=>x.id!==id);save();renderPeople()}}
function renderPeople(){
let q=(document.getElementById("personSearch")?.value||"").toUpperCase();let arr=currentSchool.people.filter(p=>p.name.includes(q));let el=document.getElementById("peopleList");
el.innerHTML=arr.length?arr.map(p=>`<div class="person"><button class="check ${p.done?"done":""}" onclick="togglePerson(${p.id})">${p.done?"✓":""}</button><div class="person-main"><b>${esc(p.name)}</b><small>${p.note?esc(p.note)+" • ":""}${p.done?"CONCLUÍDO":"PENDENTE"}</small></div><button class="delete" onclick="removePerson(${p.id})">×</button></div>`).join(""):`<div class="empty">NENHUM ATENDIMENTO.<br><br>TOQUE EM “ATENDIMENTO” PARA ADICIONAR.</div>`;
}
function totals(){let all=data.schools.flatMap(s=>s.people);return {all,done:all.filter(p=>p.done).length}}
function updateStats(){let t=totals();document.getElementById("schoolCount").textContent=data.schools.length;document.getElementById("doneCount").textContent=t.done;let today=new Date().toDateString();document.getElementById("todayCount").textContent=t.all.filter(p=>new Date(p.created).toDateString()===today).length}
function renderSchoolReport(){
let a=currentSchool.people,d=a.filter(p=>p.done).length;document.getElementById("schoolReport").innerHTML=`<div class="report-box"><h3>${esc(currentSchool.name)}</h3><div class="big">${a.length}</div><p>ATENDIMENTOS REGISTRADOS</p><div class="bar"><i style="width:${a.length?d/a.length*100:0}%"></i></div><p>${d} CONCLUÍDO(S) • ${a.length-d} PENDENTE(S)</p></div><div class="report-box"><h3>LISTA DE NOMES</h3>${a.length?a.map((p,i)=>`<p>${i+1}. ${esc(p.name)} — ${p.done?"CONCLUÍDO":"PENDENTE"}</p>`).join(""):"<p>NENHUM REGISTRO.</p>"}</div>`
}
function renderGlobalReport(){
let t=totals(), schools=data.schools;document.getElementById("globalReport").innerHTML=`<div class="report-box"><h3>TOTAL GERAL</h3><div class="big">${t.all.length}</div><p>ATENDIMENTOS • ${t.done} CONCLUÍDOS • ${t.all.length-t.done} PENDENTES</p></div>`+schools.map(s=>{let d=s.people.filter(p=>p.done).length;return `<div class="report-box"><h3>${esc(s.name)}</h3><p>${s.people.length} ATENDIMENTO(S)</p><div class="bar"><i style="width:${s.people.length?d/s.people.length*100:0}%"></i></div><p>${d} CONCLUÍDO(S)</p></div>`}).join("")}
function exportReport(){
let t=totals();let lines=["LISTTA — RELATÓRIO GERAL","DATA: "+new Date().toLocaleDateString("PT-BR"),"",`TOTAL DE ESCOLAS: ${data.schools.length}`,`TOTAL DE ATENDIMENTOS: ${t.all.length}`,`CONCLUÍDOS: ${t.done}`,`PENDENTES: ${t.all.length-t.done}`,""];
data.schools.forEach(s=>{lines.push("ESCOLA: "+s.name);s.people.forEach((p,i)=>lines.push(`${i+1}. ${p.name} — ${p.done?"CONCLUÍDO":"PENDENTE"}${p.note?" — "+p.note:""}`));lines.push("")});
let blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="RELATORIO-LISTTA.txt";a.click();URL.revokeObjectURL(a.href)
}
renderSchools();updateStats();
