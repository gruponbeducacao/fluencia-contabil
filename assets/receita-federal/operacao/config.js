/* ═══════════════════════════════════════════════════════════════
   Operação Receita (lançamento do curso "Fluente em FGV", Receita Federal, banca FGV).
   Os valores que mudam durante a campanha ficam TODOS aqui, num lugar só, e valem para
   receita-federal.html e receita-federal-obrigado.html.

   Trocou algum valor? Suba o ?v= deste arquivo nas DUAS páginas: o CDN guarda assets por 4h.

   GRUPO_URL       convite do grupo "Operação Receita" (https://chat.whatsapp.com/...).
                   Vazio = o botão do grupo some e o Raio-X fica à mostra.
   RAIO_X_URL      PDF do Raio-X FGV. Vazio = o botão de baixar some e aparece
                   "o Raio-X FGV sai em breve, no grupo".
   LIVE_VIDEO      id do vídeo da live de 09/12 no YouTube. Vazio = os links vão para
                   a página /live do canal e o player embutido não aparece.
   VENDA_LIBERADA  false = depois da live a página NÃO mostra a venda (fica no estado
                   "espera"). Só vira true com o OK do Vinícius.
   CHECKOUT_URL    checkout da Kiwify do pacote (R$ 297, até 12x).
   FUNIL_URL       página do funil de venda (perguntas → plano). Vazio = botão some.
   VIDEO_CONVITE   endereço de EMBED do vídeo-convite do professor (Panda ou YouTube). Vazio = o topo
                   mostra a arte do dossiê; preenchido = o vídeo entra por cima dela.
   NUMEROS         números da FGV no banco e das vagas, num lugar só (cards, fichas do topo, página
                   do Raio-X e aba Questões). Atualize aqui quando entrarem questões novas.
   ═══════════════════════════════════════════════════════════════ */
window.__OR = {
  GRUPO_URL: 'https://chat.whatsapp.com/BYLH1nkFs9lAy0FTIi39RI', /* "Operação Receita · Fluência Contábil", criado em 24/11/2026 */
  RAIO_X_URL: '',
  LIVE_VIDEO: '',
  VENDA_LIBERADA: false,
  CHECKOUT_URL: 'https://pay.kiwify.com.br/oDn2naU',
  FUNIL_URL: '',
  VIDEO_CONVITE: '',
  NUMEROS: {
    data: '24/11/2026',          /* data da contagem no banco de produção */
    fgv_total: 1222,             /* questões da FGV publicadas */
    questoes_mais_de: '6.300',   /* total publicado no banco (26/11: 6.326) */
    cpc00: 114, cpc25: 111, cpc09: 98, cpc27: 96, cpc01: 86, cpc03: 74,
    vagas_analista: 116, vagas_auditor: 30   /* Portaria MGI nº 5.505/2026 */
  },
  LIVE: '2026-12-09T20:00:00-03:00',
  FIM_LIVE: '2026-12-09T23:00:00-03:00'
};
