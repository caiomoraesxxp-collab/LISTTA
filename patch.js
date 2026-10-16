(function(){
  // PATCH FOR LISTTA: seed correct schools, accent-insensitive search, statuses and import normalization
  try{
    const SEED_SCHOOLS = [
"EM AGOSTINHO MOREIRA E SILVA",
"EM ALBA FROTA",
"EM ALDEÍDES REGES",
"EM ANTÔNIO CORREIA LIMA",
"EM ANTÔNIO MENDES",
"EM CASIMIRO JOSÉ DE LIMA FILHO",
"EM CASTELO DE CASTRO",
"EM CRISTO REDENTOR",
"EMTI ALDEMIR MARTINS",
"EMTI DEPUTADO ROBERTO MESQUITA",
"EMTI NOSSA SENHORA DE FÁTIMA",
"EM DOIS DE DEZEMBRO",
"EM DOM ANTÔNIO BATISTA DE FRAGOSO",
"EM DOM HELDER CÂMARA",
"EM FRANCISCO DOMINGOS DA SILVA",
"EM FRANCISCO EDILSON PINHEIRO",
"EM FRANCISCO SILVA CAVALCANTE",
"EM HERONDINA LIMA CAVALCANTE",
"EM HILBERTO SILVA",
"EM JADER DE FIGUEIREDO CORREIA",
"EM JESUS CRISTO",
"EM JOSÉ DE ALENCAR",
"EM LORHAN MARQUES DE MEDEIROS",
"EM MANOEL RODRIGUES",
"EM MARIA DALVA SEVERINO MARREIRA",
"EM MARIA MARISA MENDES DE CARVALHO",
"EM MARIA ROSELI DE LIMA MESQUITA",
"EM MOURA BRASIL",
"EM NOSSA SENHORA APARECIDA",
"EM NOSSA SENHORA DO PERPÉTUO SOCORRO",
"EM ONZE DE AGOSTO",
"EM PATATIVA DO ASSARÉ",
"EM PROFESSOR JOSÉ PARSIFAL BARROSO",
"EM PROFESSOR JOSÉ REBOUÇAS MACAMBIRA",
"EM QUINTINO CUNHA",
"EM RACHEL DE QUEIROZ",
"EM RAIMUNDO DE SOUSA MANGUEIRA",
"EM REITOR PEDRO TEIXEIRA BARROSO",
"EM SANTA TEREZA",
"EM SÃO CURA D'ARS",
"EM SÃO RAFAEL",
"EM SEBASTIANA ALDIGUERI",
"EM SECRETÁRIO PAULO PETROLA",
"EM TERTULIANO CAMBRAIA",
"EM VIRGÍLIO TÁVORA"
    ];

    function normalizeString(s){
      return String(s||"").normalize('NFD').replace(/\p{Diacritic}/gu,'')
        .replace(/[\u0300-\u036f]/g,'') // fallback
        .toUpperCase().trim();
    }

    // Ensure global helpers exist
    const win = window;

    // Replace STATUSES with the required four statuses
    win.STATUSES = [
      {key: "nao_chegou", label: "NÃO CHEGOU", color: "#9ca3af"},
      {key: "atendido", label: "ATENDIDO", color: "#16834a"},
      {key: "faltou", label: "FALTOU", color: "#c93434"},
      {key: "foi_embora", label: "FOI EMBORA", color: "#6b7280"}
    ];

    // Ensure SEED_SCHOOLS available globally
    win.SEED_SCHOOLS = SEED_SCHOOLS.map(s=>s);

    // If data not present yet, wait for app init
    function applyPatches(){
      try{
        if(!win.data || !Array.isArray(win.data.schools)) return false;

        // Add any missing seed schools preserving order
        const existingNorm = new Set(win.data.schools.map(s=>normalizeString(s.name)));
        for(let i=0;i<SEED_SCHOOLS.length;i++){
          const name = SEED_SCHOOLS[i];
          if(!existingNorm.has(normalizeString(name))){
            // insert at end
            win.data.schools.push({id:'seed-'+i,name:name,people:[]});
          }
        }

        // Ensure no duplicates of PROFESSOR JOSÉ PARSIFAL BARROSO etc.
        // Remove near-duplicates by normalized name, keep first
        const byNorm = {};
        const uniq = [];
        for(const s of win.data.schools){
          const n = normalizeString(s.name);
          if(!byNorm[n]){ byNorm[n]=s; uniq.push(s); }
        }
        win.data.schools = uniq;

        // Persist and re-render
        if(typeof win.persist==='function') win.persist();
        if(typeof win.renderSchools==='function') win.renderSchools();
        if(typeof win.updateStats==='function') win.updateStats();

        // Monkeypatch addPerson to enforce uppercase and default status
        win.addPerson = function(){
          if(!win.requireAdmin()) return;
          const nameEl = document.getElementById('personName');
          const raw = (nameEl?.value||'').trim();
          const name = normalizeString(raw);
          if(!name) return win.toast('INFORME O NOME DO ALUNO.');
          const s = win.getSchool(); if(!s) return win.toast('ESCOLA NÃO SELECIONADA.');
          const id = 'p-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
          s.people.push({id:id,name:name,note:'',status:'nao_chegou',shift:win.currentShift || 'manha',date:win.today()});
          if(typeof win.save==='function') win.save();
          if(typeof win.closeModal==='function') win.closeModal();
          win.toast('ALUNO ADICIONADO.');
        };

        // Override setStatus to accept our keys and store uppercase label as needed
        const originalSetStatus = win.setStatus;
        win.setStatus = function(id,status){
          // Only admins can change
          if(!win.requireAdmin()) return;
          const s = win.getSchool();
          const p = s?.people.find(x=>String(x.id)===String(id)); if(!p) return;
          p.status = String(status);
          if(typeof win.save==='function') win.save();
          win.toast('STATUS ATUALIZADO.');
        };

        // Accent-insensitive search for schools
        win.renderSchools = function(){
          const qRaw = (document.getElementById('schoolSearch')?.value||'');
          const q = normalizeString(qRaw);
          const list = win.data.schools.filter(s=>normalizeString(s.name).includes(q));
          const el = document.getElementById('schoolList');
          if(!el) return;
          el.innerHTML = list.map(s=>{
            const cnt = Array.isArray(s.people)?s.people.length:0;
            return `<div class="card" onclick="openSchool('${s.id.replace(/'/g, "\\'")}')"><div class="card-body"><div class="card-title">${s.name}</div><div class="card-meta">${cnt} ALUNOS</div></div></div>`;
          }).join('') || '<div class="empty">NENHUMA ESCOLA ENCONTRADA</div>';
        };

        // Accent-insensitive search for people within the current school
        win.renderPeople = function(){
          const s = win.getSchool(); if(!s) return;
          const qRaw = (document.getElementById('personSearch')?.value||'');
          const q = normalizeString(qRaw);
          const list = s.people.filter(p=> (p.shift||'manha')=== (win.currentShift||'manha'))
            .filter(p=> normalizeString(p.name).includes(q));
          const el = document.getElementById('peopleList'); if(!el) return;
          el.innerHTML = list.map(p=>{
            const statusLabel = (win.STATUSES.find(x=>x.key===p.status)?.label) || p.status.toUpperCase();
            return `<div class="person" draggable="true" ondragstart="dragStart('${p.id}')">
              <div class="person-main"><div class="person-name">${p.name}</div><div class="person-status">${statusLabel}</div></div>
              <div class="person-actions"><button class="action-btn" onclick="toggleStatusMenu('${p.id}')">＋</button><div id="menu-${p.id}" class="status-menu" hidden></div></div>
            </div>`;
          }).join('') || '<div class="empty">SEM ALUNOS</div>';
        };

        // Patch toggleStatusMenu to render the four options in uppercase
        win.toggleStatusMenu = function(id){
          const el = document.getElementById('menu-'+CSS.escape(String(id)));
          if(!el) return;
          const wasHidden = el.hidden;
          document.querySelectorAll('.status-menu').forEach(x=>x.hidden=true);
          if(!wasHidden) return;
          const options = win.STATUSES.map(o=>({k:o.key,l:o.label}));
          el.innerHTML = options.map(o=>`<button class="status-option" onclick="setStatus('${id}','${o.k}')">${o.l}</button>`).join('');
          el.hidden = false;
        };

        // Ensure UI texts are uppercase where dynamic
        document.querySelectorAll('input[placeholder]').forEach(i=>i.placeholder = (i.placeholder||'').toUpperCase());

        // Re-render on patch
        if(typeof win.renderSchools==='function') win.renderSchools();
        if(typeof win.renderPeople==='function') win.renderPeople();

        return true;
      }catch(e){console.error('LISTTA PATCH apply error',e);return false;}
    }

    // Try to apply immediately, or wait for app to initialize
    if(!applyPatches()){
      document.addEventListener('DOMContentLoaded',()=>{
        setTimeout(applyPatches,200);
      });
      // Also attempt periodically for single-page reloads
      let tries=0; const ti=setInterval(()=>{ if(applyPatches() || ++tries>20) clearInterval(ti); },300);
    }

  }catch(err){console.error('LISTTA PATCH ERROR',err)}
})();
