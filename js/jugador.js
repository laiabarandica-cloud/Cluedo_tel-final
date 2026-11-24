// Teló Final — app del jugador
(function () {
  const { rpc, escoltaEstat, FASES, DEPT_CLASSE, icona, esc, $, $$ } = window.Telo;

  const S = {
    codi: null, carta: null, estat: null, directori: [], opcions: null,
    tab: 'carta', girada: false, vot: { assassi: null, arma: null, lloc: null, complice: null },
    votEditat: false, darrerRumor: null, resultats: null, filtreDir: ''
  };

  function desaCodi(c) { try { localStorage.setItem('telo-codi', c); } catch (e) {} }
  function llegeixCodi() { try { return localStorage.getItem('telo-codi'); } catch (e) { return null; } }
  function oblidaCodi() { try { localStorage.removeItem('telo-codi'); } catch (e) {} }

  // ---------- Entrada ----------
  async function entra(codi) {
    codi = (codi || '').trim().toUpperCase();
    if (codi.length !== 4) throw new Error('El codi té 4 lletres.');
    const carta = await rpc('carta', { p_codi: codi });
    if (!carta) throw new Error('Aquest codi no existeix. Revisa\'l o demana\'l al màster.');
    S.codi = codi; S.carta = carta;
    desaCodi(codi);
    rpc('marcar_entrada', { p_codi: codi }).catch(() => {});
    if (carta.vot) S.vot = Object.assign({}, carta.vot);
    $('#vista-entrada').hidden = true;
    $('#vista-joc').hidden = false;
    const url = new URL(location.href);
    if (url.searchParams.has('c')) { url.searchParams.delete('c'); history.replaceState(null, '', url.pathname + url.search); }
    escoltaEstat(onEstat, 6000);
    pinta();
  }

  $('#form-codi').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#entrada-error'); err.hidden = true;
    try { await entra($('#input-codi').value); }
    catch (e) { err.textContent = e.message; err.hidden = false; }
  });

  // ---------- Entrada escrivint el nom ----------
  $('#form-nom').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#entrada-error'); err.hidden = true;
    const boto = ev.target.querySelector('button'); boto.disabled = true;
    try {
      const codi = await rpc('entrar_per_nom', { p_nom: $('#input-nom').value });
      await entra(codi);
    } catch (e) { err.textContent = e.message; err.hidden = false; }
    boto.disabled = false;
  });

  // ---------- Estat ----------
  async function onEstat(e) {
    const abans = S.estat;
    S.estat = e;
    try {
      const [carta, dir, msgs] = await Promise.all([rpc('carta', { p_codi: S.codi }), rpc('directori'), rpc('els_meus_missatges', { p_codi: S.codi })]);
      S.missatges = msgs || [];
      if (!carta) { // la partida s'ha reiniciat
        oblidaCodi(); location.reload(); return;
      }
      S.carta = carta; S.directori = dir || [];
      if (!S.votEditat && carta.vot) S.vot = Object.assign({}, carta.vot);
      if (e.fase === 'votacio' && !S.opcions) S.opcions = await rpc('opcions_vot');
      if (e.revelat_mobils) {
        S.resultats = await rpc('resultats', { p_clau: S.codi });
        if (S.resultats && (!abans || !abans.revelat_mobils)) S.tab = 'resultats';
      } else { S.resultats = null; if (S.tab === 'resultats') S.tab = 'carta'; }
    } catch (err) { console.warn(err); }
    if (abans && e.rumor && e.rumor !== abans.rumor) mostraModalRumor(e.rumor);
    if (abans && abans.fase !== e.fase && e.fase === 'entreacte') {
      obreModal('<h2>Informe forense</h2><p>Ha arribat l\'informe del forense. El tens a la teva carta.</p><button class="boto boto-ample" data-tanca>D\'acord</button>');
    }
    pinta();
  }

  // ---------- Pintar ----------
  function pinta() {
    const e = S.estat || { fase: 'preparacio' };
    $('#joc-fase').textContent = (FASES[e.fase] || {}).curt || e.fase;
    // navegació
    $$('.pestanya').forEach(b => {
      b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false');
      const punt = b.querySelector('.punt'); if (punt) punt.remove();
    });
    if (S.carta && S.carta.confirmacions_pendents.length) afegeixPunt('missio');
    if (e.fase === 'votacio' && !S.carta.vot) afegeixPunt('votar');
    $$('.tab').forEach(t => t.hidden = t.id !== 'tab-' + S.tab);
    pintaAvisos();
    if (S.tab === 'carta') pintaCarta();
    if (S.tab === 'directori') pintaDirectori();
    if (S.tab === 'missio') pintaMissio();
    if (S.tab === 'votar') pintaVotar();
    if (S.tab === 'resultats') pintaResultats();
    if (S.tab === 'notes') pintaNotes();
  }

  // ---------- Notes i missatges al màster ----------
  let tempsNotes = null; let notesPendents = false;
  function respostesVistes() { try { return +localStorage.getItem('telo-respostes-' + S.codi) || 0; } catch (e) { return 0; } }
  function marcaRespostesVistes() {
    const n = (S.missatges || []).filter(m => m.estat === 'respost').length;
    try { localStorage.setItem('telo-respostes-' + S.codi, String(n)); } catch (e) {}
  }
  function pintaNotes() {
    const el = $('#tab-notes');
    const actiu = document.activeElement && (document.activeElement.id === 'notes' || document.activeElement.id === 'txt-missatge');
    if (el.querySelector('#notes') && actiu) { pintaMissatges(); return; } // no trepitgem el que s'escriu
    el.innerHTML = '<h2 class="seccio">Les meves notes</h2>' +
      '<p class="suau petit" style="margin-top:-6px">Apunta-hi coartades, sospites i codis. Només les veus tu i es guarden soles.</p>' +
      '<textarea id="notes" class="notes-area" maxlength="5000" placeholder="Ex.: La Clara diu que era al camerino amb la Neus. Qui porta talons?…"></textarea>' +
      '<p class="suau petit" id="notes-estat" style="text-align:right"> </p>' +
      '<h2 class="seccio" style="margin-top:22px">Escriu al màster</h2>' +
      '<p class="suau petit" style="margin-top:-6px">Un dubte, un problema amb una missió o el mòbil… El màster ho veurà al seu panell i et respondrà aquí.</p>' +
      '<textarea id="txt-missatge" maxlength="500" style="min-height:90px" placeholder="Ex.: No trobo ningú de Manteniment, com ho faig?"></textarea>' +
      '<button class="boto boto-ample" id="envia-missatge" style="margin-top:10px">Envia al màster</button>' +
      '<div id="missatge-msg"></div><div id="llista-missatges"></div>';
    const t = $('#notes');
    t.value = S.carta.notes || '';
    t.oninput = () => {
      notesPendents = true; $('#notes-estat').textContent = 'Desant…';
      clearTimeout(tempsNotes); tempsNotes = setTimeout(desaNotes, 900);
    };
    t.onblur = () => { if (notesPendents) desaNotes(); };
    $('#envia-missatge').onclick = async () => {
      const txt = $('#txt-missatge').value.trim();
      const msg = $('#missatge-msg');
      if (!txt) { msg.innerHTML = '<div class="avis error">Escriu el missatge.</div>'; return; }
      try {
        await rpc('enviar_missatge', { p_codi: S.codi, p_text: txt });
        $('#txt-missatge').value = '';
        S.missatges = await rpc('els_meus_missatges', { p_codi: S.codi }) || [];
        msg.innerHTML = '<div class="avis ok">Enviat. El màster et respondrà aquí.</div>';
        pintaMissatges();
      } catch (e) { msg.innerHTML = '<div class="avis error">' + esc(e.message) + '</div>'; }
    };
    pintaMissatges();
  }
  function pintaMissatges() {
    const el = $('#llista-missatges'); if (!el) return;
    const ms = S.missatges || [];
    el.innerHTML = ms.length ? '<h3 class="sub">Les teves peticions</h3>' + ms.map(m =>
      '<div class="panell" style="padding:12px 14px;margin-bottom:10px"><p style="margin:0">' + esc(m.text) + '</p>' +
      (m.estat === 'respost'
        ? '<p style="margin:8px 0 0;color:var(--daurat)"><b>Màster:</b> ' + esc(m.resposta || 'Fet!') + '</p>'
        : '<p class="suau petit" style="margin:6px 0 0">Pendent de resposta</p>') + '</div>').join('') : '';
    marcaRespostesVistes();
  }
  async function desaNotes() {
    const t = $('#notes'); if (!t) return;
    const text = t.value;
    try {
      await rpc('desar_notes', { p_codi: S.codi, p_text: text });
      S.carta.notes = text; notesPendents = false;
      const e = $('#notes-estat'); if (e) e.textContent = 'Desat';
    } catch (err) { const e = $('#notes-estat'); if (e) e.textContent = 'No s\'ha pogut desar: ' + err.message; }
  }
  function afegeixPunt(tab) {
    const b = $('.pestanya[data-tab="' + tab + '"]');
    if (b && !b.querySelector('.punt')) { const s = document.createElement('span'); s.className = 'punt'; b.appendChild(s); }
  }

  function pintaAvisos() {
    const e = S.estat || {};
    let h = '';
    if (S.resultats && S.tab !== 'resultats') {
      h += '<button class="boto boto-ample" style="margin-bottom:12px" data-anar="resultats">Teló final: mira la solució</button>';
    }
    if (e.rumor) h += '<div class="rumor"><div class="etiqueta">Rumor anònim</div><p>«' + esc(e.rumor) + '»</p></div>';
    const respostes = (S.missatges || []).filter(m => m.estat === 'respost').length;
    if (respostes > respostesVistes() && S.tab !== 'notes') {
      h += '<div class="avis info">El màster t\'ha respost. <a href="#" data-anar="notes" style="color:#fff;font-weight:700">Llegeix-ho</a></div>';
    }
    if (S.carta && S.carta.confirmacions_pendents.length && S.tab !== 'missio') {
      h += '<div class="avis info">Algú et demana que confirmis la seva missió. <a href="#" data-anar="missio" style="color:#fff;font-weight:700">Obre-la</a></div>';
    }
    $('#avisos').innerHTML = h;
  }

  function pintaCarta() {
    const c = S.carta; const e = S.estat || {};
    const dept = DEPT_CLASSE[c.dept] || 'dept-escena';
    let h = '';
    if (e.fase && FASES[e.fase]) h += '<p class="suau petit centre" style="margin:0 0 12px">' + esc(FASES[e.fase].text) + '</p>';
    h += '<div class="carta ' + dept + (S.girada ? ' girada' : '') + '" id="carta"><div class="carta-interior">';
    // Cara
    h += '<div class="cara" aria-hidden="' + (S.girada ? 'true' : 'false') + '"><div class="marc">' +
      '<div class="il"><img src="' + esc(c.img) + '" alt="' + esc(c.nom) + ', il·lustració en còmic">' +
      '<div class="placa">' + c.id + icona(c.dept) + '</div><div class="pindola-dept">' + esc(c.dept) + '</div></div>' +
      '<div><div class="nom-personatge">' + esc(c.nom) + '</div><div class="rol">' + esc(c.rol) + '</div></div>' +
      '<div><div class="senyals-titol">Senyals visibles</div><div class="xips" style="margin-top:5px">' +
      '<span class="xip">' + esc(c.calcat) + '</span><span class="xip">' + esc(c.peca) + '</span><span class="xip">' + esc(c.detall) + '</span></div></div>' +
      '</div></div>';
    // Revers
    h += '<div class="revers" aria-hidden="' + (S.girada ? 'false' : 'true') + '"><div class="marc">' +
      '<div class="fila" style="justify-content:space-between"><h2>Fitxa secreta</h2><span class="no-ensenyis">No l\'ensenyis</span></div>';
    if (c.paper !== 'innocent') {
      const soc = c.soci ? (c.soci.nom + (c.soci.nom_real ? ' (' + c.soci.nom_real + ')' : '')) : '—';
      h += '<div class="caixa-dolent bloc-revers"><strong>' + (c.paper === 'assassi' ? 'Ets l\'assassina' : 'Ets el còmplice') + '</strong>' +
        '<p>' + (c.paper === 'assassi' ? 'El teu còmplice és ' : 'L\'assassina és ') + esc(soc) + '. Podeu mentir en la coartada, la pista i el secret. Les dades visibles no es poden negar.</p>' +
        '<p><b>Secret real:</b> ' + esc(c.secret) + '</p><p><b>Secret de tapadora:</b> ' + esc(c.secret_tapadora) + '</p></div>';
    }
    h += '<div class="bloc-revers"><div class="etiqueta">Coartada · 21:40</div><p>' + esc(c.coartada) + '</p></div>';
    h += '<div class="bloc-revers"><div class="etiqueta">' + (c.paper === 'innocent' ? 'La teva pista' : 'Pista falsa (per despistar)') + '</div><p>' + esc(c.pista) + '</p></div>';
    h += '<div class="bloc-revers"><div class="etiqueta">Missió secreta · +2</div><p>' + esc(c.missio.text) + '</p></div>';
    if (c.paper === 'innocent') h += '<div class="bloc-revers"><div class="etiqueta">El teu secret</div><p>' + esc(c.secret) + ' Pots callar-lo, però no mentir.</p></div>';
    h += '<div class="fila" style="justify-content:space-between;margin-top:auto;border-top:1px solid var(--linia);padding-top:10px"><span class="etiqueta">Codi personal</span><span class="codi-personal">' + esc(c.codi) + '</span></div>';
    h += '</div></div></div></div>';
    h += '<div style="max-width:340px;margin:16px auto 0"><button class="boto boto-ample" id="gira">' + (S.girada ? 'Torna a la carta' : 'Gira la carta') + '</button>' +
      (c.forense ? '<div class="forense" style="margin-top:16px"><div class="etiqueta">Informe forense</div><p>' + esc(c.forense) + '</p></div>' : '') +
      '<p class="suau petit centre" style="margin-top:12px">Jugues com a <b style="color:var(--crema)">' + esc(c.nom_real) + '</b>. Si no ets tu, <a href="#" id="surt">canvia de codi</a>.</p></div>';
    $('#tab-carta').innerHTML = h;
    $('#gira').onclick = () => { S.girada = !S.girada; pinta(); };
    $('#surt').onclick = (ev) => { ev.preventDefault(); oblidaCodi(); location.href = location.pathname; };
  }

  function pintaDirectori() {
    const f = S.filtreDir.toLowerCase();
    const llista = S.directori.filter(d => !f || (d.nom + ' ' + d.nom_real + ' ' + d.rol).toLowerCase().includes(f));
    let h = '<h2 class="seccio">Directori</h2><p class="suau petit" style="margin-top:-6px">Qui és qui. Les coartades i els senyals visibles els has d\'anar a preguntar.</p>' +
      '<div class="dir-cerca"><label for="cerca" class="petit">Cerca</label><input id="cerca" type="text" placeholder="Nom, personatge o paper" value="' + esc(S.filtreDir) + '"></div><div class="dir-llista">';
    llista.forEach(d => {
      h += '<div class="dir-item ' + (DEPT_CLASSE[d.dept] || '') + '"><img src="' + esc(d.img) + '" alt="" loading="lazy"><div class="text">' +
        '<div class="nom">' + esc(d.nom) + '</div><div class="rol">' + esc(d.rol) + '</div><div class="real">És <b>' + esc(d.nom_real) + '</b></div></div></div>';
    });
    h += '</div>';
    if (!llista.length) h += '<p class="suau">No hi ha ningú amb aquest nom.</p>';
    $('#tab-directori').innerHTML = h;
    const inp = $('#cerca');
    inp.oninput = () => { S.filtreDir = inp.value; const pos = inp.selectionStart; pintaDirectori(); const n = $('#cerca'); n.focus(); n.setSelectionRange(pos, pos); };
  }

  function pintaMissio() {
    const c = S.carta; const m = c.missio; const e = S.estat || {};
    const obert = ['aperitiu', 'acte1', 'entreacte', 'acte2', 'votacio'].includes(e.fase);
    let h = '<h2 class="seccio">La teva missió</h2>';
    h += '<div class="panell"><div class="fila" style="justify-content:space-between;margin-bottom:6px"><span class="etiqueta">Missió secreta · +2 punts</span>' +
      (m.t === 'vot' ? '<span class="estat-missio pendent">Es comprova al final</span>' :
        (c.missio_feta ? '<span class="estat-missio feta">Complerta</span>' : '<span class="estat-missio pendent">Pendent</span>')) + '</div>' +
      '<p style="margin:0;font-size:16px">' + esc(m.text) + '</p></div>';

    if (!obert && m.t !== 'vot') h += '<div class="avis">Ara mateix no es poden fer missions.</div>';

    if (m.t === 'codis') {
      const n = m.ids ? m.ids.length : m.n;
      const dades = c.missio_dades || {};
      const tinc = (c.codis_aconseguits || []).length;
      h += '<div class="fila" style="justify-content:space-between"><span class="etiqueta">Progrés</span><b style="color:var(--daurat)">' + Math.min(tinc, n) + ' / ' + n + '</b></div>' +
        '<div class="progres"><div style="width:' + Math.min(100, tinc / n * 100) + '%"></div></div>';
      if (!c.missio_feta && obert) {
        h += '<p class="suau petit">Cada persona té el seu codi personal al revers de la carta. Afegeix-los d\'un en un quan te\'ls diguin: es van guardant.</p>' +
          '<form id="f-codis" class="fila" style="flex-wrap:nowrap" autocomplete="off"><input type="text" class="input-codi" maxlength="4" placeholder="ABCD" aria-label="Codi personal" style="flex:1"><button class="boto" type="submit">Afegeix</button></form>';
      }
      if (tinc) {
        h += '<h3 class="sub">Codis aconseguits</h3>';
        c.codis_aconseguits.forEach(x => { h += '<div class="aconseguit"><span>✓ ' + esc(x.nom) + ' <span class="suau">· ' + esc(x.nom_real) + '</span></span><span class="codi">' + esc(x.codi) + '</span></div>'; });
      }
      const errors = (dades.detall || []).filter(d => !d.ok);
      if (errors.length) {
        h += '<h3 class="sub">Darrer intent</h3>';
        errors.forEach(d => { h += '<div class="resultat-codi">✗ <b>' + esc(d.codi) + '</b>' + (d.nom ? ' · ' + esc(d.nom) : '') + ' — ' + esc(d.motiu) + '</div>'; });
      }
    }
    if (m.t === 'resposta') {
      if (c.missio_intentada) {
        h += c.missio_feta ? '<div class="avis ok">Resposta correcta. Missió complerta!</div>' : '<div class="avis error">Resposta incorrecta. Ja no la pots tornar a provar.</div>';
      } else if (obert) {
        h += '<p class="suau petit">Només tens un intent: assegura-te\'n abans de respondre.</p><div class="opcions-text" id="opc-resposta">';
        m.opts.forEach(o => { h += '<button type="button" class="opcio-text" data-resp="' + esc(o) + '" aria-pressed="false">' + esc(o) + '</button>'; });
        h += '</div><button class="boto boto-ample" id="envia-resposta" style="margin-top:14px" disabled>Respon</button>';
      }
    }
    if (m.t === 'confirmacio' || m.t === 'master') {
      const pendent = c.confirmacions_enviades.find(x => x.estat === 'pendent');
      if (!c.missio_feta && obert && !pendent) {
        if (m.t === 'confirmacio') {
          h += '<label for="sel-conf">Qui t\'ho ha fet?</label><select id="sel-conf"><option value="">Tria una persona…</option>';
          S.directori.filter(d => d.num !== c.id).forEach(d => { h += '<option value="' + d.num + '">' + esc(d.nom_real) + ' · ' + esc(d.nom) + '</option>'; });
          h += '</select><button class="boto boto-ample" id="demana-conf" style="margin-top:12px">Demana que ho confirmi</button>';
        } else {
          h += '<button class="boto boto-ample" id="demana-master">Ensenya-ho al màster i demana validació</button>';
        }
      }
      if (c.confirmacions_enviades.length) {
        h += '<h3 class="sub">Peticions</h3>';
        c.confirmacions_enviades.forEach(x => {
          h += '<div class="resultat-codi">' + esc(x.a) + ' — ' + (x.estat === 'pendent' ? 'pendent de confirmar' : x.estat === 'si' ? '✓ confirmat' : '✗ no ho ha confirmat') + '</div>';
        });
      }
    }
    if (m.t === 'vot') {
      h += '<p class="suau petit">Aquesta missió depèn de la votació final. L\'app la comprova sola quan es tanca la votació.</p>';
    }

    // Confirmacions que em demanen
    if (c.confirmacions_pendents.length) {
      h += '<h3 class="sub">Et demanen que confirmis</h3>';
      c.confirmacions_pendents.forEach(p => {
        h += '<div class="panell"><p style="margin:0 0 6px"><b>' + esc(p.de_real) + '</b> (' + esc(p.de) + ') diu que ha complert aquesta missió amb tu:</p>' +
          '<p class="petit" style="margin:0 0 10px;font-style:italic">«' + esc(p.missio) + '»</p>' +
          '<div class="graella-2"><button class="boto" data-conf="' + p.id + '" data-si="1">Sí, és cert</button><button class="boto-sec" data-conf="' + p.id + '" data-si="0">No</button></div></div>';
      });
    }

    // Rumor de l'assassina
    if (c.paper === 'assassi') {
      h += '<h3 class="sub">El teu rumor anònim</h3>';
      if (c.rumor_meu && c.rumor_meu.estat !== 'rebutjat') {
        h += '<div class="avis">«' + esc(c.rumor_meu.text) + '» — ' + (c.rumor_meu.estat === 'aprovat' ? 'publicat' : 'esperant que el màster l\'aprovi') + '</div>';
      } else if (e.fase === 'acte2') {
        h += (c.rumor_meu && c.rumor_meu.estat === 'rebutjat' ? '<div class="avis error">El màster ha rebutjat el teu rumor. Prova\'n un altre.</div>' : '') +
          '<p class="suau petit">Sortirà a tots els mòbils i a la pantalla com a «Rumor anònim». Idea: acusa algú que jugui avui, per exemple «Algú ha vist [nom] rentant-se les mans al lavabo a les 21:45…»</p>' +
          '<textarea id="txt-rumor" maxlength="140" style="min-height:90px" placeholder="Màxim 140 caràcters"></textarea>' +
          '<button class="boto boto-ample" id="envia-rumor" style="margin-top:10px">Envia el rumor</button>';
      } else {
        h += '<p class="suau petit">Podràs enviar-lo durant el 2n acte.</p>';
      }
    }
    h += '<div id="missio-msg"></div>';
    $('#tab-missio').innerHTML = h;
    lligaMissio();
  }

  function msgMissio(text, tipus) { const el = $('#missio-msg'); if (el) el.innerHTML = '<div class="avis ' + (tipus || '') + '">' + esc(text) + '</div>'; }

  function lligaMissio() {
    const f = $('#f-codis');
    if (f) f.onsubmit = async (ev) => {
      ev.preventDefault();
      const codis = $$('input', f).map(i => i.value.trim().toUpperCase()).filter(Boolean);
      if (!codis.length) return msgMissio('Escriu almenys un codi.', 'error');
      try {
        const r = await rpc('missio_codis', { p_codi: S.codi, p_codis: codis });
        await refresca();
        const nou = (r.detall || []).find(d => d.ok && d.motiu === 'Vàlid');
        msgMissio(r.feta ? 'Missió complerta! +2 punts' : nou ? 'Codi vàlid: ja en tens ' + r.valids + ' de ' + r.necessaris + '.' : ((r.detall[0] || {}).motiu || 'Codi no vàlid'), r.feta || nou ? 'ok' : 'error');
      } catch (e) { msgMissio(e.message, 'error'); }
    };
    let triada = null;
    $$('[data-resp]').forEach(b => b.onclick = () => {
      triada = b.dataset.resp;
      $$('[data-resp]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      $('#envia-resposta').disabled = false;
    });
    const er = $('#envia-resposta');
    if (er) er.onclick = async () => {
      if (!triada) return;
      if (!confirm('Segur? Només tens un intent.')) return;
      try { await rpc('missio_resposta', { p_codi: S.codi, p_resposta: triada }); await refresca(); }
      catch (e) { msgMissio(e.message, 'error'); }
    };
    const dc = $('#demana-conf');
    if (dc) dc.onclick = async () => {
      const v = $('#sel-conf').value;
      if (!v) return msgMissio('Tria primer la persona.', 'error');
      try { await rpc('missio_demanar', { p_codi: S.codi, p_personatge: parseInt(v, 10) }); await refresca(); msgMissio('Petició enviada. Quan ho confirmi, la missió quedarà complerta.', 'ok'); }
      catch (e) { msgMissio(e.message, 'error'); }
    };
    const dm = $('#demana-master');
    if (dm) dm.onclick = async () => {
      try { await rpc('missio_demanar', { p_codi: S.codi, p_personatge: null }); await refresca(); msgMissio('Petició enviada al màster. Ensenya-li el selfie.', 'ok'); }
      catch (e) { msgMissio(e.message, 'error'); }
    };
    $$('[data-conf]').forEach(b => b.onclick = async () => {
      try { await rpc('confirmar', { p_codi: S.codi, p_id: parseInt(b.dataset.conf, 10), p_si: b.dataset.si === '1' }); await refresca(); }
      catch (e) { msgMissio(e.message, 'error'); }
    });
    const rr = $('#envia-rumor');
    if (rr) rr.onclick = async () => {
      const t = $('#txt-rumor').value.trim();
      if (!t) return msgMissio('Escriu el rumor.', 'error');
      try { await rpc('enviar_rumor', { p_codi: S.codi, p_text: t }); await refresca(); }
      catch (e) { msgMissio(e.message, 'error'); }
    };
  }

  async function refresca() {
    S.carta = await rpc('carta', { p_codi: S.codi });
    pinta();
  }

  function pintaVotar() {
    const e = S.estat || {}; const c = S.carta;
    let h = '<h2 class="seccio">Votació</h2>';
    if (e.fase !== 'votacio') {
      h += '<div class="avis">' + (['tancat', 'revelacio'].includes(e.fase) ? 'La votació ja s\'ha tancat.' : 'La votació s\'obrirà a les postres, quan el màster ho digui.') + '</div>';
      if (c.vot) h += '<p class="suau petit">El teu vot està desat.</p>';
      $('#tab-votar').innerHTML = h; return;
    }
    const o = S.opcions;
    if (!o) { h += '<p class="suau">Carregant…</p>'; $('#tab-votar').innerHTML = h; rpc('opcions_vot').then(r => { S.opcions = r; pinta(); }); return; }
    const imgDe = {}; S.directori.forEach(d => imgDe[d.num] = d.img);
    if (c.vot) h += '<div class="avis ok">Ja has votat. Pots canviar el vot fins que el màster tanqui la votació.</div>';
    h += '<h3 class="sub">Qui és l\'assassí? (+3)</h3><div class="opcions-vot">';
    o.sospitosos.forEach(s => { h += '<button type="button" class="opcio-sosp" data-camp="assassi" data-val="' + s.id + '" aria-pressed="' + (S.vot.assassi === s.id) + '"><img src="' + esc(imgDe[s.id] || '') + '" alt="">' + esc(s.nom) + '</button>'; });
    h += '</div><h3 class="sub">Amb què? (+1)</h3><div class="opcions-text">';
    o.armes.forEach(a => { h += '<button type="button" class="opcio-text" data-camp="arma" data-val="' + esc(a) + '" aria-pressed="' + (S.vot.arma === a) + '">' + esc(a) + '</button>'; });
    h += '</div><h3 class="sub">On? (+1)</h3><div class="opcions-text">';
    o.llocs.forEach(a => { h += '<button type="button" class="opcio-text" data-camp="lloc" data-val="' + esc(a) + '" aria-pressed="' + (S.vot.lloc === a) + '">' + esc(a) + '</button>'; });
    h += '</div><h3 class="sub">I el còmplice? (opcional, +2)</h3><select id="sel-complice"><option value="">No ho sé</option>';
    o.sospitosos.forEach(s => { h += '<option value="' + s.id + '"' + (S.vot.complice === s.id ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; });
    h += '</select><button class="boto boto-ample" id="envia-vot" style="margin-top:18px">' + (c.vot ? 'Actualitza el vot' : 'Vota') + '</button><div id="vot-msg"></div>';
    $('#tab-votar').innerHTML = h;
    $$('[data-camp]').forEach(b => b.onclick = () => {
      const camp = b.dataset.camp; S.votEditat = true;
      S.vot[camp] = camp === 'assassi' ? parseInt(b.dataset.val, 10) : b.dataset.val;
      $$('[data-camp="' + camp + '"]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    });
    $('#sel-complice').onchange = (ev) => { S.votEditat = true; S.vot.complice = ev.target.value ? parseInt(ev.target.value, 10) : null; };
    $('#envia-vot').onclick = async () => {
      const msg = $('#vot-msg');
      if (!S.vot.assassi) { msg.innerHTML = '<div class="avis error">Tria almenys qui és l\'assassí.</div>'; return; }
      try {
        await rpc('votar', { p_codi: S.codi, p_assassi: S.vot.assassi, p_arma: S.vot.arma, p_lloc: S.vot.lloc, p_complice: S.vot.complice });
        S.votEditat = false; S.carta = await rpc('carta', { p_codi: S.codi });
        pinta(); $('#vot-msg').innerHTML = '<div class="avis ok">Vot desat!</div>';
      } catch (e) { msg.innerHTML = '<div class="avis error">' + esc(e.message) + '</div>'; }
    };
  }

  function pintaResultats() {
    const r = S.resultats;
    if (!r) { $('#tab-resultats').innerHTML = '<p class="suau">Encara no hi ha resultats.</p>'; return; }
    const s = r.solucio;
    let h = '<div class="revelacio-cap"><span class="fase">Teló final</span><h2 class="seccio" style="margin-top:12px">L\'assassina era…</h2>' +
      '<img src="' + esc(s.assassi.img) + '" alt=""><div class="nom-personatge" style="color:var(--crema)">' + esc(s.assassi.nom) + '</div>' +
      (s.assassi.nom_real ? '<p class="suau">(' + esc(s.assassi.nom_real) + ')</p>' : '') + '</div>';
    h += '<div class="panell"><p style="margin:0"><b>Còmplice:</b> ' + esc(s.complice.nom) + (s.complice.nom_real ? ' (' + esc(s.complice.nom_real) + ')' : '') + '</p>' +
      '<p style="margin:6px 0 0"><b>Arma:</b> ' + esc(s.arma) + '</p><p style="margin:6px 0 0"><b>Lloc:</b> ' + esc(s.lloc) + '</p>' +
      '<p class="petit" style="margin:10px 0 0">' + esc(s.relat) + '</p></div>';
    const meu = r.ranking.find(x => x.codi === S.codi);
    if (meu) {
      const pos = r.ranking.indexOf(meu) + 1;
      h += '<div class="panell"><h3>La teva puntuació</h3><p style="margin:0;font-size:28px;font-family:var(--font-display);font-weight:800;color:var(--daurat)">' + meu.punts + ' punts · ' + pos + 'a posició</p>' +
        '<p class="petit" style="margin:6px 0 0">Endevinalla: ' + meu.enquesta + ' · Missió: ' + (meu.missio ? '+2 (complerta)' : '0') + (meu.bonus ? ' · Bonus de dolent: +' + meu.bonus : '') + '</p></div>';
    }
    h += '<h3 class="sub">Classificació</h3>';
    r.ranking.slice(0, 10).forEach((x, i) => { h += '<div class="rank' + (x.codi === S.codi ? ' jo' : '') + '"><span>' + (i + 1) + '. ' + esc(x.nom_real) + ' <span class="suau">· ' + esc(x.personatge) + '</span></span><b>' + x.punts + '</b></div>'; });
    if (r.mentider) h += '<p class="petit" style="margin-top:14px">Millor mentider: <b>' + esc(r.mentider.nom_real) + '</b> (' + esc(r.mentider.personatge) + '), amb ' + r.mentider.vots + ' vots en contra.</p>';
    $('#tab-resultats').innerHTML = h;
  }

  // ---------- Modals ----------
  function obreModal(html) {
    const m = $('#modal');
    m.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    m.hidden = false;
    m.querySelectorAll('[data-tanca]').forEach(b => b.onclick = () => { m.hidden = true; });
  }
  function mostraModalRumor(t) {
    obreModal('<div class="etiqueta" style="color:var(--corall)">Rumor anònim</div><h2>Corre un rumor…</h2><p style="font-style:italic">«' + esc(t) + '»</p><button class="boto boto-ample" data-tanca>Entesos</button>');
  }

  // ---------- Navegació ----------
  document.addEventListener('click', (ev) => {
    const p = ev.target.closest('.pestanya');
    if (p) { S.tab = p.dataset.tab; window.scrollTo(0, 0); pinta(); return; }
    const a = ev.target.closest('[data-anar]');
    if (a) { ev.preventDefault(); S.tab = a.dataset.anar; window.scrollTo(0, 0); pinta(); }
  });

  // ---------- Inici ----------
  const param = new URL(location.href).searchParams.get('c');
  const guardat = param || llegeixCodi();
  if (guardat) {
    $('#input-codi').value = guardat.toUpperCase();
    entra(guardat).catch(e => { oblidaCodi(); const err = $('#entrada-error'); err.textContent = e.message; err.hidden = false; });
  }
})();
