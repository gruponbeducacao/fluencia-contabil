#!/usr/bin/env python3
"""
Fluência Contábil — Gerador da página pública de Editais (Estágio 2.5).

Lê scripts/data/catalogo-editais.json (emitido pela plataforma por
`apps/api/scripts/export-catalogo-publico.ts`) e escreve editais.html na raiz
do site.

Por que gerar HTML em vez de buscar por fetch: o site é estático e o crawler do
Google não roda JS. Conteúdo montado no navegador não indexa — e indexar é o
motivo desta página existir. Mesmo padrão do generate_rss.py.

REGRA DE COMUNICAÇÃO (decisão do Vinícius, 17/08 — custou duas correções no
mock): a cobertura é comunicada SEMPRE por disciplina específica ("93% de
Contabilidade Geral"), NUNCA como um total que pareça cobrir o edital inteiro.
O JSON de entrada nem traz o agregado, e este gerador não o calcula.

Uso:
    python scripts/generate_catalogo_editais.py
    python scripts/generate_catalogo_editais.py --check   # falha se desatualizado

Sem dependências externas — só a stdlib. Idempotente: com o mesmo JSON, a saída
é byte a byte igual (o `geradoEm` vem do JSON, não do relógio desta execução).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from html import escape

# ========== Config ==========
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_ENTRADA = os.path.join(RAIZ, "scripts", "data", "catalogo-editais.json")
HTML_SAIDA = os.path.join(RAIZ, "editais.html")

SITE_URL = "https://fluenciacontabil.com.br"
GTM_ID = "GTM-WB2NTFXL"  # container do site principal (CLAUDE.md, decisão 10)
TITULO = "Editais mapeados: quanto de Contabilidade o curso cobre"
DESCRICAO = (
    "Veja, edital por edital, quanto do conteúdo de Contabilidade de cada concurso "
    "o curso da Fluência Contábil cobre — disciplina por disciplina."
)

ESFERA_ROTULO = {"FEDERAL": "Federal", "ESTADUAL": "Estadual", "MUNICIPAL": "Municipal"}
AREA_ROTULO = {
    "FISCAL": "Fiscal",
    "CONTROLE": "Controle Interno",
    "TRIBUNAIS_DE_CONTAS": "Tribunais de Contas",
    "JUDICIARIO": "Judiciário",
    "LEGISLATIVO": "Legislativo",
    "MINISTERIO_PUBLICO": "Ministério Público",
    "BANCOS_PUBLICOS": "Bancos Públicos",
    "REGULADORAS": "Agências Reguladoras",
    "EMPRESAS_PUBLICAS": "Empresas Públicas",
    "POLICIAL": "Policial",
    "MILITAR": "Militar",
    "PREVIDENCIARIO": "Previdenciário",
    "SUFICIENCIA": "Exame de Suficiência (CFC)",
    "GERAL": "Concursos para contadores",
}

# Aprofundamento editorial que já existe no blog. O catálogo é o HUB; o post é a
# análise. Linkar evita que as duas peças disputem a mesma busca.
POSTS_POR_CONCURSO = {
    "prefeitura-de-manaus": "blog/iss-manaus-2026-contabilidade.html",
    "prefeitura-municipal-de-santos": "blog/iss-santos-2026-contabilidade.html",
}


PAGINA_MODELO = os.path.join(RAIZ, "cursos.html")


def _fatia(texto: str, inicio: str, fim: str, rotulo: str) -> str:
    """Recorta um bloco do HTML modelo. Falha DURO se o marcador mudou — é o
    que impede a página nova de nascer sem nav ou sem rodapé em silêncio."""
    i = texto.find(inicio)
    if i < 0:
        raise SystemExit(f"[catalogo] não achei o início de {rotulo} ({inicio!r}) em cursos.html")
    j = texto.find(fim, i)
    if j < 0:
        raise SystemExit(f"[catalogo] não achei o fim de {rotulo} ({fim!r}) em cursos.html")
    return texto[i : j + len(fim)]


def casca_do_site() -> tuple[str, str, str]:
    """(nav, footer, script de scroll) extraídos de cursos.html.

    O site não tem include: cada página duplica nav e rodapé à mão. Extrair do
    modelo em vez de copiar para dentro deste script é o que garante que mudar o
    menu em cursos.html e regenerar já atualiza esta página — sem uma segunda
    cópia do menu vivendo aqui e envelhecendo calada.
    """
    with open(PAGINA_MODELO, encoding="utf-8") as f:
        modelo = f.read()

    nav = _fatia(modelo, '<div id="topbar">', '</div>\n\n<section', "o nav")
    nav = nav[: nav.rfind("<section")].rstrip()
    # o modelo marca a própria página como ativa; aqui nenhum item do menu é
    nav = nav.replace('class="active"', "").replace(' class="active"', "")

    footer = _fatia(modelo, "<footer>", "</footer>", "o rodapé")
    script = _fatia(modelo, "<script>\nvar nav=document.getElementById('mainNav')", "</script>", "o script de scroll")
    return nav, footer, script


def post_do_edital(ed: dict) -> str | None:
    """Casa o edital com um post do blog pelo início do concursoSlug."""
    slug = (ed.get("concursoSlug") or "").lower()
    for chave, caminho in POSTS_POR_CONCURSO.items():
        if slug.startswith(chave):
            return caminho
    return None


def data_br(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return None


def status_da_prova(iso: str | None, hoje: datetime) -> tuple[str, str]:
    """(classe, rótulo). Mesma régua da plataforma: sem data conta como à vista."""
    d = None
    if iso:
        try:
            d = datetime.strptime(iso, "%Y-%m-%d")
        except ValueError:
            d = None
    if d and d < hoje:
        return ("passado", "Referência de estudo")
    return ("avista", "Prova à vista")


def card(ed: dict, hoje: datetime) -> str:
    orgao = escape(ed["orgao"])
    cargo = escape(ed.get("cargo") or "")
    banca = ed.get("banca")
    uf = ed.get("uf")
    esfera = ed.get("esfera")
    area = ed.get("area")
    cls_status, rot_status = status_da_prova(ed.get("dataProva"), hoje)
    data = data_br(ed.get("dataProva"))

    pills = []
    if banca:
        pills.append(f'<span class="ed-pill">{escape(banca)}</span>')
    if esfera:
        rot = ESFERA_ROTULO.get(esfera, esfera)
        pills.append(f'<span class="ed-pill">{escape(rot)}{" · " + escape(uf) if uf else ""}</span>')
    elif uf:
        pills.append(f'<span class="ed-pill">{escape(uf)}</span>')
    if area:
        pills.append(f'<span class="ed-pill">{escape(AREA_ROTULO.get(area, area))}</span>')

    linhas = []
    for d in ed["disciplinas"]:
        rotulo = escape(d["rotulo"])
        pct = int(d["pct"])
        linhas.append(
            f'          <li class="ed-disc">\n'
            f'            <span class="ed-disc-nome">{rotulo}</span>\n'
            f'            <span class="ed-disc-pct">{pct}%</span>\n'
            f'            <span class="ed-bar"><i style="width:{pct}%"></i></span>\n'
            f"          </li>"
        )

    extras = []
    post = post_do_edital(ed)
    if post:
        extras.append(f'<a class="ed-link" href="{post}">Análise completa deste edital</a>')
    if ed.get("linkOficial"):
        extras.append(
            f'<a class="ed-link" href="{escape(ed["linkOficial"])}" '
            f'target="_blank" rel="noopener">Edital oficial</a>'
        )

    # data-* alimentam a busca e os filtros client-side (padrão do blog.html):
    # o conteúdo já está no HTML, o JS só alterna a classe .hidden
    busca = " ".join(
        filter(None, [ed["orgao"], ed.get("cargo"), banca, uf, ESFERA_ROTULO.get(esfera or "", "")])
    ).lower()

    return f"""      <article class="ed-card card-bold" data-banca="{escape(banca or '')}" data-esfera="{escape(esfera or '')}" data-uf="{escape(uf or '')}" data-area="{escape(area or '')}" data-busca="{escape(busca)}">
        <div class="ed-card-top">
          <span class="ed-status ed-status-{cls_status}">{rot_status}</span>
          {f'<span class="ed-data">Prova: {data}</span>' if data else ''}
        </div>
        <h3 class="ed-orgao">{orgao}</h3>
        {f'<p class="ed-cargo">{cargo}</p>' if cargo else ''}
        <div class="ed-pills">{''.join(pills)}</div>
        <ul class="ed-discs">
{chr(10).join(linhas)}
        </ul>
        <p class="ed-legenda">% dos tópicos de cada disciplina cobertos pelo curso</p>
        {f'<div class="ed-links">{"".join(extras)}</div>' if extras else ''}
      </article>"""


def opcoes_filtro(editais: list[dict], campo: str, rotulos: dict | None = None) -> list[tuple[str, str]]:
    """Valores distintos de uma dimensão, ordenados pelo RÓTULO exibido."""
    vals = {e.get(campo) for e in editais if e.get(campo)}
    pares = [(v, (rotulos or {}).get(v, v)) for v in vals]
    return sorted(pares, key=lambda p: p[1].lower())


def gerar(doc: dict) -> str:
    nav, footer, script_scroll = casca_do_site()
    editais = doc["editais"]
    hoje = datetime.strptime(doc["geradoEm"][:10], "%Y-%m-%d")
    gerado_br = hoje.strftime("%d/%m/%Y")

    cards = "\n".join(card(e, hoje) for e in editais)

    def bloco_filtro(nome: str, campo: str, rotulos: dict | None = None) -> str:
        opts = opcoes_filtro(editais, campo, rotulos)
        if len(opts) < 2:  # dimensão com um valor só não refina nada
            return ""
        botoes = "".join(
            f'<button type="button" class="ed-chip" data-filtro="{campo}" data-valor="{escape(v)}">{escape(r)}</button>'
            for v, r in opts
        )
        return f'<div class="ed-filtro"><span class="ed-filtro-lbl">{nome}</span>{botoes}</div>'

    filtros = "\n      ".join(
        filter(
            None,
            [
                bloco_filtro("Área", "area", AREA_ROTULO),
                bloco_filtro("Esfera", "esfera", ESFERA_ROTULO),
                bloco_filtro("Banca", "banca"),
                bloco_filtro("UF", "uf"),
            ],
        )
    )

    itens_ld = [
        {
            "@type": "ListItem",
            "position": i + 1,
            "name": f"{e['orgao']}{' — ' + e['cargo'] if e.get('cargo') else ''}",
        }
        for i, e in enumerate(editais)
    ]
    ld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": TITULO,
        "description": DESCRICAO,
        "url": f"{SITE_URL}/editais.html",
        "inLanguage": "pt-BR",
        "isPartOf": {"@type": "WebSite", "name": "Fluência Contábil", "url": SITE_URL},
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": len(editais),
            "itemListElement": itens_ld,
        },
    }

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
}})(window,document,'script','dataLayer','{GTM_ID}');</script>
<!-- End Google Tag Manager -->
<meta charset="UTF-8"><link rel="icon" type="image/png" href="assets/favicon.png"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{escape(DESCRICAO)}">
<link rel="canonical" href="{SITE_URL}/editais.html">
<meta property="og:title" content="{escape(TITULO)} | Fluência Contábil">
<meta property="og:description" content="{escape(DESCRICAO)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE_URL}/editais.html">
<meta property="og:site_name" content="Fluência Contábil">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(TITULO)} | Fluência Contábil">
<meta name="twitter:description" content="{escape(DESCRICAO)}">
<title>{escape(TITULO)} | Fluência Contábil</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<style>
.ed-toolbar{{margin-bottom:var(--space-8)}}
.ed-busca{{position:relative;max-width:520px;margin-bottom:var(--space-5)}}
.ed-busca input{{width:100%;padding:14px 18px;border:1px solid #DDD;border-radius:var(--radius-md);font-family:inherit;font-size:var(--fs-base);color:var(--texto)}}
.ed-busca input:focus{{outline:none;border-color:var(--azul-med);box-shadow:0 0 0 3px rgba(42,63,111,.12)}}
.ed-filtro{{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}}
.ed-filtro-lbl{{font-size:var(--fs-xs);font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--azul-med);min-width:64px}}
.ed-chip{{font-family:inherit;font-size:var(--fs-sm);font-weight:600;padding:6px 14px;border:1px solid #DDD;background:#FFF;color:var(--texto);border-radius:var(--radius-lg);cursor:pointer;transition:all var(--t-fast)}}
.ed-chip:hover{{border-color:var(--azul-med)}}
.ed-chip.on{{background:var(--azul);border-color:var(--azul);color:#FFF}}
.ed-conta{{font-size:var(--fs-sm);color:#666;margin:var(--space-4) 0}}
.ed-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-6)}}
.ed-card{{background:#FFF;border:1px solid #E8E8E8;border-radius:var(--radius-md);padding:var(--space-6);display:flex;flex-direction:column}}
.ed-card.hidden{{display:none}}
.ed-card-top{{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:var(--space-3)}}
.ed-status{{font-size:var(--fs-xs);font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:var(--radius-lg)}}
.ed-status-avista{{background:rgba(200,168,75,.16);color:var(--dourado-esc)}}
.ed-status-passado{{background:#F0F0F0;color:#777}}
.ed-data{{font-size:var(--fs-xs);color:#666;font-weight:600}}
.ed-orgao{{font-size:var(--fs-lg);font-weight:700;color:var(--azul);line-height:1.3;margin:0 0 4px}}
.ed-cargo{{font-size:var(--fs-sm);color:#555;margin:0 0 var(--space-3);line-height:1.4}}
.ed-pills{{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--space-5)}}
.ed-pill{{font-size:var(--fs-xs);font-weight:600;padding:3px 10px;background:var(--cream);color:var(--azul-med);border-radius:var(--radius-lg)}}
.ed-discs{{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-direction:column;gap:10px}}
.ed-disc{{display:grid;grid-template-columns:1fr auto;gap:2px 10px}}
.ed-disc-nome{{font-size:var(--fs-sm);font-weight:600;color:var(--texto)}}
.ed-disc-pct{{font-size:var(--fs-sm);font-weight:800;color:var(--azul);font-variant-numeric:tabular-nums}}
.ed-bar{{grid-column:1/-1;height:6px;background:#EEE;border-radius:3px;overflow:hidden}}
.ed-bar i{{display:block;height:100%;background:linear-gradient(90deg,var(--dourado),var(--dourado-esc))}}
.ed-legenda{{font-size:var(--fs-xs);color:#777;margin:0 0 var(--space-4);line-height:1.35}}
.ed-links{{margin-top:auto;display:flex;flex-wrap:wrap;gap:14px;padding-top:var(--space-4);border-top:1px solid #EEE}}
.ed-link{{font-size:var(--fs-sm);font-weight:700;color:var(--azul-med);text-decoration:none}}
.ed-link:hover{{text-decoration:underline}}
.ed-vazio{{padding:var(--space-10) 0;text-align:center;color:#666}}
.ed-nota{{margin-top:var(--space-10);padding-top:var(--space-6);border-top:1px solid #E8E8E8;font-size:var(--fs-sm);color:#666;line-height:1.6;max-width:var(--max-prose)}}
@media(max-width:768px){{.ed-grid{{grid-template-columns:1fr}}.ed-filtro-lbl{{min-width:100%}}}}
</style>
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
</script>
<link rel="stylesheet" href="assets/email-capture.css?v=20260728">
<script src="assets/email-capture.js?v=20260728" defer></script>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager -->

{nav}

<section class="page-hero">
  <div class="page-hero-inner inner">
    <span class="lbl">Editais mapeados</span>
    <div class="bar"></div>
    <h1>Quanto da <em>Contabilidade</em> do seu concurso o curso cobre</h1>
    <p class="body-t">Mapeamos o conteúdo programático de Contabilidade de cada edital e comparamos com o material do curso, disciplina por disciplina. Sem estimativa: o que está aqui é a conta dos tópicos.</p>
  </div>
</section>

<section style="padding:var(--space-12) 0">
  <div class="inner">
    <div class="ed-toolbar">
      <div class="ed-busca">
        <input type="search" id="edBusca" placeholder="Busque por órgão, cargo ou banca — ex.: sefaz, iss, receita federal" aria-label="Buscar edital" autocomplete="off">
      </div>
      {filtros}
    </div>

    <p class="ed-conta" id="edConta">{len(editais)} {'edital' if len(editais) == 1 else 'editais'} {'mapeado' if len(editais) == 1 else 'mapeados'}</p>

    <div class="ed-grid" id="edGrid">
{cards}
    </div>

    <p class="ed-vazio hidden" id="edVazio">Nenhum edital encontrado para essa combinação. Seu concurso ainda não está aqui? <a href="contato.html">Fale com a gente</a> que a gente mapeia.</p>

    <p class="ed-nota">Dados de {gerado_br}. A cobertura é sempre a de <strong>cada disciplina</strong> — nunca do edital inteiro, que traz também matérias fora da Contabilidade. Editais mudam: confira sempre o documento oficial da banca.</p>
  </div>
</section>

{footer}
{script_scroll}

<script>
(function(){{
  var busca = document.getElementById('edBusca');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.ed-card'));
  var conta = document.getElementById('edConta');
  var vazio = document.getElementById('edVazio');
  var sel = {{}};

  function aplicar(){{
    var q = (busca.value || '').toLowerCase().trim();
    var n = 0;
    cards.forEach(function(c){{
      var ok = true;
      for (var dim in sel) {{ if (sel[dim] && c.getAttribute('data-' + dim) !== sel[dim]) ok = false; }}
      if (ok && q && c.getAttribute('data-busca').indexOf(q) === -1) ok = false;
      c.classList.toggle('hidden', !ok);
      if (ok) n++;
    }});
    conta.textContent = n + (n === 1 ? ' edital encontrado' : ' editais encontrados');
    vazio.classList.toggle('hidden', n > 0);
  }}

  busca.addEventListener('input', aplicar);
  document.querySelectorAll('.ed-chip').forEach(function(b){{
    b.addEventListener('click', function(){{
      var dim = b.getAttribute('data-filtro'), val = b.getAttribute('data-valor');
      var ligar = sel[dim] !== val;
      document.querySelectorAll('.ed-chip[data-filtro="' + dim + '"]').forEach(function(o){{ o.classList.remove('on'); }});
      sel[dim] = ligar ? val : null;
      if (ligar) b.classList.add('on');
      aplicar();
    }});
  }});
}})();
</script>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Gera editais.html a partir do JSON do catálogo.")
    ap.add_argument("--check", action="store_true", help="não escreve; falha se o arquivo estiver desatualizado")
    args = ap.parse_args()

    if not os.path.exists(JSON_ENTRADA):
        print(f"[catalogo] {JSON_ENTRADA} não existe.", file=sys.stderr)
        print("[catalogo] gere com: corepack pnpm tsx apps/api/scripts/export-catalogo-publico.ts --out <este caminho>", file=sys.stderr)
        return 1

    with open(JSON_ENTRADA, encoding="utf-8") as f:
        doc = json.load(f)

    if not doc.get("editais"):
        print("[catalogo] JSON sem editais — abortando pra não publicar página vazia.", file=sys.stderr)
        return 1

    html = gerar(doc)

    if args.check:
        atual = open(HTML_SAIDA, encoding="utf-8").read() if os.path.exists(HTML_SAIDA) else None
        if atual != html:
            print("[catalogo] editais.html está DESATUALIZADO em relação ao JSON.", file=sys.stderr)
            return 1
        print("[catalogo] editais.html em dia.")
        return 0

    with open(HTML_SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print(f"[catalogo] {HTML_SAIDA} gerado — {len(doc['editais'])} editais, dados de {doc['geradoEm'][:10]}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
