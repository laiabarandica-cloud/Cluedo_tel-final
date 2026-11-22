// Teló Final — funcions comunes (jugador, màster i pantalla)
(function () {
  const cfg = window.TELO_CONFIG;
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  async function rpc(nom, params) {
    const { data, error } = await client.rpc(nom, params || {});
    if (error) {
      const msg = (error.message || 'Error desconegut').replace(/^.*?ERROR:\s*/, '');
      throw new Error(msg);
    }
    return data;
  }

  async function estat() {
    const { data, error } = await client.from('estat').select('*').eq('id', 1).single();
    if (error) throw new Error(error.message);
    return data;
  }

  // Avisa quan canvia l'estat de la partida (temps real + sondeig de seguretat)
  function escoltaEstat(callback, cadaMs) {
    let darreraVersio = null;
    async function comprova() {
      try {
        const e = await estat();
        if (e.versio !== darreraVersio) { darreraVersio = e.versio; callback(e); }
      } catch (err) { /* sense connexió: ho tornarem a provar */ }
    }
    client.channel('estat-partida')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estat' }, () => comprova())
      .subscribe();
    comprova();
    setInterval(comprova, cadaMs || 6000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) comprova(); });
    return comprova;
  }

  const FASES = {
    preparacio: { nom: 'Preparació', curt: 'Preparació', text: 'La partida encara no ha començat.' },
    aperitiu: { nom: 'Aperitiu', curt: 'Aperitiu', text: 'Mira la teva carta i enganxa\'t l\'etiqueta. Aviat comença el primer acte.' },
    acte1: { nom: '1r acte · Investigació', curt: '1r acte', text: 'Pregunta coartades, comparteix pistes i fes la teva missió.' },
    entreacte: { nom: 'Entreacte · Informe forense', curt: 'Entreacte', text: 'Ha arribat l\'informe forense. Llegeix-lo a la teva carta.' },
    acte2: { nom: '2n acte · Acusacions', curt: '2n acte', text: 'Compte amb els rumors. Qui menteix?' },
    votacio: { nom: 'Votació', curt: 'Votació', text: 'Vota qui, amb què i on abans que baixi el teló.' },
    tancat: { nom: 'Votació tancada', curt: 'Tancat', text: 'Ja no es pot votar. Espera la revelació.' },
    revelacio: { nom: 'Teló final', curt: 'Teló final', text: 'Revelació a la pantalla gran.' }
  };

  const DEPT_CLASSE = {
    'Escena': 'dept-escena', 'Tècnica': 'dept-tecnica', 'Sala': 'dept-sala', 'Taquilla': 'dept-taquilla',
    'Oficines': 'dept-oficines', 'Manteniment': 'dept-manteniment', 'Públic': 'dept-public'
  };
  const DEPT_ICONA = {
    'Escena': 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
    'Públic': 'M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M3 11h18v5H3zM5 16v4M19 16v4',
    'Sala': 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01',
    'Tècnica': 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
    'Taquilla': 'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM13 6v12',
    'Oficines': 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    'Manteniment': 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
  };

  function icona(dept) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (DEPT_ICONA[dept] || DEPT_ICONA['Escena']) + '"/></svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  window.Telo = { client, rpc, estat, escoltaEstat, FASES, DEPT_CLASSE, icona, esc, $, $$ };
})();
