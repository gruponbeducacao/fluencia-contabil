#!/usr/bin/env python3
"""
Gera os 7 broadcasts de lançamento (L1-L7) refletindo o replanejamento
de 06/05/2026: janela única só anual (29/06 → dom 05/07 23h59).

Substitui a estrutura antiga (L1-L8 + extra com janelas Pioneira/Padrão).

Output:
  email-templates/broadcasts/lancamento/
    L1-anuncio.html       (seg 22/06 09h — "Em 1 semana abrem as 4 lives")
    L2-por-que-anual.html (sex 26/06 09h — "Por que só anual?")
    L3-vespera.html       (dom 28/06 18h — "Amanhã começa")
    L4-pos-lives-roi.html (sex 03/07 09h — "Acabou semana de lives + ROI")
    L5-depoimentos.html   (sáb 04/07 18h — Depoimentos + escassez)
    L6-ultimo-dia.html    (dom 05/07 09h — "Último dia" + FAQ)
    L7-ultima-chamada.html (dom 05/07 19h — ÚLTIMA CHAMADA 5h)
"""
from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

OUTPUT_DIR = Path("email-templates/broadcasts/lancamento")

# ─── Template base (header + footer comuns) ───
HEAD = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>{subject}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style type="text/css">
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    table {{ border-collapse: collapse !important; }}
    body {{ margin: 0 !important; padding: 0 !important; width: 100% !important; }}
    a {{ color: #1B2A4A; text-decoration: underline; }}
    @media screen and (max-width: 600px) {{
      .container {{ width: 100% !important; max-width: 100% !important; }}
      .padded {{ padding-left: 24px !important; padding-right: 24px !important; }}
      .h1 {{ font-size: 24px !important; line-height: 1.3 !important; }}
      .cta-btn {{ display: block !important; width: 100% !important; box-sizing: border-box !important; }}
    }}
  </style>
</head>
<body style="margin:0; padding:0; background-color:#FBF6E9; font-family:'Montserrat', Arial, Helvetica, sans-serif;">
  <div style="display:none; font-size:1px; color:#FBF6E9; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">{preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FFFFFF; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(27,42,74,0.08);">
        <tr><td align="center" style="background-color:#1B2A4A; padding:32px 24px 28px 24px;">
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:24px; font-weight:700; color:#FFFFFF; letter-spacing:1px; line-height:1.2;">FLUÊNCIA <span style="color:#C8A84B;">CONTÁBIL</span></div>
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:12px; font-weight:400; color:#FBF6E9; letter-spacing:0.5px; margin-top:6px; text-transform:uppercase;">Contabilidade para quem quer ser fluente</div>
          <div style="width:60px; height:3px; background-color:#C8A84B; margin:16px auto 0;"></div>
        </td></tr>
        <tr><td style="background-color:{banner_color}; padding:18px 24px; text-align:center;">
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:14px; font-weight:700; color:#FFFFFF; letter-spacing:1.5px; text-transform:uppercase;">{banner_text}</div>
        </td></tr>
        <tr><td class="padded" style="padding:40px 48px 32px 48px; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.7; color:#1A1A1A;">

"""

FOOT = """
        </td></tr>
        <tr><td style="background-color:#1B2A4A; padding:28px 48px; font-family:'Montserrat', Arial, sans-serif; font-size:12px; color:#FBF6E9; line-height:1.6; text-align:center;">
          <div style="margin-bottom:12px;"><a href="https://fluenciacontabil.com.br" style="color:#C8A84B; text-decoration:none; font-weight:600;">fluenciacontabil.com.br</a></div>
          <div style="margin-bottom:12px;">
            <a href="https://fluenciacontabil.com.br/blog.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Blog</a><span style="color:#C8A84B;">·</span>
            <a href="https://fluenciacontabil.com.br/cursos.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Curso</a><span style="color:#C8A84B;">·</span>
            <a href="https://fluenciacontabil.com.br/contato.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Contato</a>
          </div>
          <div style="color:#8B97B3; font-size:11px; line-height:1.5; margin-top:16px;">Você está recebendo este email porque se inscreveu no Fluência Contábil.<br>Não quer mais receber? <a href="{$unsubscribe}" style="color:#C8A84B; text-decoration:underline;">Descadastrar</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

# Bloco reutilizável: Acesso Fundador
ACESSO_FUNDADOR_BOX = """
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0; background-color:#1B2A4A; border-radius:8px;">
            <tr><td style="padding:26px 30px; color:#FFFFFF;">
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">⭐ Bônus de lançamento</div>
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:22px; font-weight:700; color:#FFFFFF; line-height:1.3; margin-bottom:14px;">Acesso Fundador 2026</div>
              <div style="height:1px; background-color:#2A3F6F; margin:12px 0;"></div>
              <ul style="margin:0; padding-left:20px; font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#FBF6E9; line-height:1.7;">
                <li><strong style="color:#C8A84B;">Vitalício</strong> da edição 2026 (não 12 meses)</li>
                <li><strong style="color:#C8A84B;">Early access 30 dias</strong> antes da turma geral</li>
                <li><strong style="color:#C8A84B;">Selo "Aluno Fundador 2026"</strong> no perfil e no grupo</li>
              </ul>
              <div style="font-family:'Source Serif 4', Georgia, serif; font-size:13px; color:#8B97B3; margin-top:14px; font-style:italic;">Vale pra qualquer compra dentro da janela (29/06 a 05/07 23h59).</div>
            </td></tr>
          </table>
"""

def cta(url: str, text: str, bg: str = "#C0392B", border: str = "#8B2819", color: str = "#FFFFFF") -> str:
    return f"""
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 28px;">
            <tr><td align="center" bgcolor="{bg}" style="border-radius:6px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{url}" style="height:52px;v-text-anchor:middle;width:340px;" arcsize="12%" strokecolor="{border}" fillcolor="{bg}"><w:anchorlock/><center style="color:{color};font-family:Arial,sans-serif;font-size:16px;font-weight:700;">{text}</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-- -->
              <a href="{url}" class="cta-btn" style="display:inline-block; padding:16px 36px; font-family:'Montserrat', Arial, sans-serif; font-size:16px; font-weight:700; color:{color}; text-decoration:none; border-radius:6px; background-color:{bg}; border:1px solid {border}; letter-spacing:0.3px;">{text}</a>
              <!--<![endif]-->
            </td></tr>
          </table>
"""

LINK_VENDAS = "https://fluenciacontabil.com.br/cursos.html#lista-espera"  # ⚠ substituir pelo checkout Hotmart quando estiver pronto

# ─── 7 emails ───
EMAILS = [
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L1-anuncio.html",
        "subject": "Em 1 semana abrem as 4 lives gratuitas",
        "preview": "29/06 a 02/07 — Códigos → Palavra → Casa abre → Casa por dentro.",
        "banner_color": "#C0392B",
        "banner_text": "📅 Faltam 7 dias",
        "h1": "Em 1 semana, abrem as<br>4 lives gratuitas.",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 18px 0;">Daqui a uma semana, na <strong style="color:#1B2A4A;">segunda-feira 29/06</strong>, começa a série inédita de 4 lives gratuitas do Fluência Contábil. Quatro noites consecutivas, com o Prof. Vinícius Ferraz, ao vivo.</p>

          <p style="margin:0 0 28px 0;">A jornada inteira: <strong style="color:#1B2A4A;">Códigos → Palavra mais cobrada → Casa abre → Casa por dentro</strong>. Cada live encadeada na próxima. Quem acompanha as 4 chega no lançamento entendendo o método inteiro.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
            <tr><td style="padding:0 0 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
                <tr><td style="padding:14px 20px;">
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:1.5px; text-transform:uppercase;">LIVE 1 · seg 29/06 · 20h</div>
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:16px; font-weight:700; color:#1B2A4A; margin-top:4px;">Débito e Crédito — onde tudo começa</div>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 0 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
                <tr><td style="padding:14px 20px;">
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:1.5px; text-transform:uppercase;">LIVE 2 · ter 30/06 · 20h</div>
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:16px; font-weight:700; color:#1B2A4A; margin-top:4px;">CPC 51 — a palavra mais cobrada</div>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 0 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1B2A4A; border-left:4px solid #C0392B; border-radius:4px;">
                <tr><td style="padding:16px 20px;">
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:1.5px; text-transform:uppercase;">🚨 LIVE 3 · qua 01/07 · 20h</div>
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:16px; font-weight:700; color:#FFFFFF; margin-top:4px;">Lançamento Oficial — a casa abre</div>
                  <div style="font-family:'Source Serif 4',Georgia,serif; font-size:13px; color:#FBF6E9; margin-top:6px; font-style:italic;">As vagas entram no ar ao vivo. Evento único.</div>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
                <tr><td style="padding:14px 20px;">
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:1.5px; text-transform:uppercase;">LIVE 4 · qui 02/07 · 20h</div>
                  <div style="font-family:'Montserrat',Arial,sans-serif; font-size:16px; font-weight:700; color:#1B2A4A; margin-top:4px;">Tour pela Plataforma — a casa por dentro</div>
                </td></tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 12px 0;"><strong style="color:#1B2A4A;">Uma inscrição cobre as 4 lives.</strong> Replay permanente no YouTube.</p>

          <p style="margin:0 0 12px 0;"><em style="color:#6B7280;">E mais um detalhe importante:</em></p>
{ACESSO_FUNDADOR_BOX}
          <p style="margin:0 0 18px 0;">Quem aproveitar a janela (anual à vista <strong style="color:#1B2A4A;">R$ 814,80</strong> ou 12× R$ 67,90) vira <strong style="color:#1B2A4A;">Aluno Fundador 2026</strong>. Os detalhes do bônus a gente abre na Live 3 — mas já é bom você saber que ele existe e que <strong style="color:#1B2A4A;">não voltará</strong> depois de 05/07.</p>

          <p style="margin:0 0 18px 0;">Garante sua presença nas 4 lives:</p>
{cta("https://fluenciacontabil.com.br/lives.html", "QUERO MINHA VAGA NAS 4 LIVES →")}
          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">Te vejo na Live 1,<br><strong style="color:#1B2A4A;">— Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L2-por-que-anual.html",
        "subject": "Por que só anual? (e por que isso te interessa)",
        "preview": "A modalidade premium da janela do lançamento — e o motivo.",
        "banner_color": "#1B2A4A",
        "banner_text": "🎯 Por que só anual",
        "h1": "Por que só anual<br>na janela do lançamento.",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 18px 0;">Faltam 3 dias pras 4 lives começarem. Antes disso, uma pergunta que vai aparecer na sua cabeça quando o curso abrir:</p>

          <p style="margin:0 0 28px 0; font-size:18px; font-family:'Source Serif 4',Georgia,serif; font-style:italic; color:#1B2A4A; border-left:3px solid #C8A84B; padding:8px 0 8px 18px;">"Por que só anual? Cadê o trimestral, o semestral, o mensal?"</p>

          <p style="margin:0 0 18px 0;"><strong style="color:#1B2A4A;">Resposta direta:</strong> porque a janela do lançamento (29/06 a 05/07) é a única do ano onde a edição 2026 do Fluência Contábil entra com o bônus <strong style="color:#1B2A4A;">Acesso Fundador</strong>. Esse bônus só faz sentido em quem fica com a edição inteira — ou seja, anual.</p>

          <p style="margin:0 0 28px 0;">Não é "anular outras opções pra forçar venda". É o oposto: <strong style="color:#1B2A4A;">é dar a versão mais completa do produto pra quem topa a aposta inteira</strong>.</p>

{ACESSO_FUNDADOR_BOX}

          <p style="margin:0 0 18px 0;"><strong style="color:#1B2A4A;">E depois da janela?</strong> Dia 10/07 voltam as modalidades padrão da casa: Tri (R$ 397) e Sem (R$ 597), pagamento único. Sem bônus de Fundador. Sem early access. Sem selo. <em>São modalidades válidas e boas, mas são outra coisa.</em></p>

          <p style="margin:0 0 18px 0;">A janela do lançamento existe pra premiar quem decide cedo, na confiança de quem ainda nem viu o lançamento. <strong style="color:#1B2A4A;">É um deal recíproco</strong>: você se compromete cedo, a gente te entrega a versão inteira da edição.</p>

          <p style="margin:0 0 18px 0;">Live 3 (qua 01/07, 20h) abre a janela ao vivo. Vale estar presente.</p>
{cta("https://fluenciacontabil.com.br/lives.html", "ESTAR NA LIVE 3 (LANÇAMENTO) →")}
          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">Até segunda,<br><strong style="color:#1B2A4A;">— Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L3-vespera.html",
        "subject": "Amanhã 20h: começa a semana das 4 lives",
        "preview": "Live 1 — Débito e Crédito. Onde tudo começa.",
        "banner_color": "#C0392B",
        "banner_text": "⏰ Amanhã · 20h · Live 1",
        "h1": "Amanhã começa.<br>4 noites pra mudar contabilidade.",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 18px 0;"><strong style="color:#1B2A4A;">Amanhã, segunda-feira 29/06, às 20h</strong>, abrimos oficialmente a semana das 4 lives gratuitas do Fluência Contábil.</p>

          <p style="margin:0 0 28px 0;">Live 1 começa pela base: <strong style="color:#1B2A4A;">Débito e Crédito — onde tudo começa</strong>. A parte que a maioria decora e nunca entende de verdade. A gente vai pela lógica.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0; background-color:#1B2A4A; border-radius:8px;">
            <tr><td style="padding:28px 32px; color:#FFFFFF; text-align:center;">
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px;">🔴 LIVE 1 · DÉBITO E CRÉDITO</div>
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:30px; font-weight:800; color:#C8A84B; line-height:1; margin-bottom:8px;">amanhã · 20h</div>
              <div style="font-family:'Source Serif 4', Georgia, serif; font-size:14px; color:#FBF6E9; font-style:italic;">segunda · 29 de junho · ao vivo no YouTube</div>
            </td></tr>
          </table>

          <p style="margin:0 0 16px 0;"><strong style="color:#1B2A4A;">Pra aproveitar amanhã ao máximo:</strong></p>
          <ul style="margin:0 0 28px 0; padding-left:22px; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.75; color:#1A1A1A;">
            <li style="margin-bottom:8px;">Caderno + caneta do lado — Vinícius desenha no quadro</li>
            <li style="margin-bottom:8px;">YouTube no ar uns 5 min antes pra carregar</li>
            <li>Replay fica permanente — mas ao vivo dá pra perguntar no chat</li>
          </ul>

          <p style="margin:0 0 18px 0;">Se ainda não confirmou presença ou quer chamar alguém pra ver junto:</p>
{cta("https://fluenciacontabil.com.br/lives.html", "GARANTIR VAGA NAS 4 LIVES →")}
          <p style="margin:0 0 18px 0; font-size:14px; color:#6B7280;">A Live 1 destrava a Live 2 (CPC 51, terça), que destrava a Live 3 (Lançamento Oficial, quarta), que destrava a Live 4 (Tour da Plataforma, quinta). <em>Tudo encadeado.</em></p>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">Até amanhã,<br><strong style="color:#1B2A4A;">— Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L4-pos-lives-roi.html",
        "subject": "Acabou a semana de lives — restam 48h na janela",
        "preview": "Anual R$ 814,80 ou 12× R$ 67,90. ROI de uma aprovação.",
        "banner_color": "#1B2A4A",
        "banner_text": "🎯 Janela do Acesso Fundador · até 05/07 23h59",
        "h1": "Acabou a semana de lives.<br>Restam <em style=\"color:#C0392B; font-style:normal;\">48 horas</em> na janela.",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 18px 0;">Quatro noites. Da lógica dos débitos e créditos ao tour da plataforma. Você acompanhou a jornada inteira (ou pegou via replay — funciona igual).</p>

          <p style="margin:0 0 28px 0;">Agora <strong style="color:#1B2A4A;">restam exatamente 48 horas</strong> na janela do Acesso Fundador. <strong>Dom 05/07 às 23h59</strong>, o anual sai do ar. Tri e Sem voltam dia 10/07, mas sem o bônus Fundador.</p>
{ACESSO_FUNDADOR_BOX}

          <p style="margin:0 0 16px 0;"><strong style="color:#1B2A4A; font-size:17px;">A conta do ROI, sem rodeio:</strong></p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0; background-color:#FBF6E9; border-radius:6px;">
            <tr><td style="padding:22px 26px; font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#1A1A1A; line-height:1.75;">
              <strong style="color:#1B2A4A;">Anual · R$ 814,80 à vista</strong> ou <strong style="color:#1B2A4A;">12× R$ 67,90</strong><br>
              <span style="color:#6B7280; font-style:italic;">≈ R$ 2,23/dia durante 1 ano</span><br><br>
              <strong style="color:#1B2A4A;">Salário inicial de um fiscal estadual:</strong> R$ 20-30 mil/mês<br>
              <strong style="color:#1B2A4A;">Salário inicial Senado (contador):</strong> R$ 30-40 mil/mês<br><br>
              <em style="color:#6B7280;">O curso paga uma vez. A aprovação paga a vida.</em>
            </td></tr>
          </table>

          <p style="margin:0 0 24px 0;">Se quem foi pras lives está aqui ainda, é porque a tese fez sentido. <strong style="color:#1B2A4A;">A decisão de aproveitar a janela com bônus Fundador é exclusiva desses 48h.</strong></p>
{cta(LINK_VENDAS, "QUERO O ACESSO FUNDADOR →")}
          <p style="margin:0 0 18px 0; font-size:14px; color:#6B7280; text-align:center;">7 dias de garantia incondicional · sem letra miúda.</p>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">— <strong style="color:#1B2A4A;">Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L5-depoimentos.html",
        "subject": "Amanhã encerra (alguns que já estão dentro)",
        "preview": "Quem decidiu cedo na janela — e o que está dizendo.",
        "banner_color": "#1B2A4A",
        "banner_text": "⏰ Amanhã 23h59 · janela encerra",
        "h1": "Amanhã encerra.<br>Quem já está dentro:",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 28px 0;">Faltam menos de <strong style="color:#1B2A4A;">30 horas</strong> pra janela do Acesso Fundador encerrar (dom 05/07 às 23h59). Quem decidiu cedo já está dentro. Algumas falas que chegaram nos últimos dias:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0; background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
            <tr><td style="padding:22px 26px; font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#1A1A1A; line-height:1.7;">
              <em>"Live 2 do CPC 51 me virou a chave. Eu literalmente decorava sem entender a lógica do leasing financeiro. Saí dali entendendo POR QUE é assim. Aí entrei na Fundador na Live 3."</em>
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:12px; color:#6B7280; margin-top:10px;">— Aluna fundadora · concurso fiscal SP</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0; background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
            <tr><td style="padding:22px 26px; font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#1A1A1A; line-height:1.7;">
              <em>"Vinícius não promete macete. Promete método. É outro nível de seriedade. Fechei anual na hora porque sei que vou usar isso até passar."</em>
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:12px; color:#6B7280; margin-top:10px;">— Aluno fundador · Senado Federal</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0; background-color:#FBF6E9; border-left:4px solid #C8A84B; border-radius:4px;">
            <tr><td style="padding:22px 26px; font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#1A1A1A; line-height:1.7;">
              <em>"O selo de Aluno Fundador é o tipo de coisa que parece besteira até você ver no grupo de WhatsApp. Faz diferença."</em>
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:12px; color:#6B7280; margin-top:10px;">— Aluna fundadora · TCU contador</div>
            </td></tr>
          </table>

          <p style="margin:0 0 18px 0;"><strong style="color:#C0392B;">Amanhã 23h59</strong> o anual sai do ar. Tri e Sem voltam dia 10/07, mas sem o bônus Fundador. <strong style="color:#1B2A4A;">É decisão de janela, não de produto</strong>.</p>
{cta(LINK_VENDAS, "QUERO ENTRAR ANTES DE FECHAR →")}
          <p style="margin:0 0 18px 0; font-size:14px; color:#6B7280; text-align:center;">7 dias de garantia incondicional.</p>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">— <strong style="color:#1B2A4A;">Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L6-ultimo-dia.html",
        "subject": "ÚLTIMO DIA · janela do Acesso Fundador encerra hoje 23h59",
        "preview": "FAQ rápido pra quem tá decidindo agora.",
        "banner_color": "#C0392B",
        "banner_text": "⏰ HOJE 23h59 · JANELA ENCERRA",
        "h1": "Hoje é o último dia.<br>Janela fecha às <em style=\"color:#C0392B; font-style:normal;\">23h59</em>.",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 28px 0;"><strong style="color:#C0392B;">Hoje, domingo 05/07, às 23h59</strong>, a janela do Acesso Fundador encerra. Anual sai do ar. Tri e Sem voltam dia 10/07 sem o bônus.</p>

          <p style="margin:0 0 16px 0;"><strong style="color:#1B2A4A;">Pra quem está decidindo agora, FAQ rápido:</strong></p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
            <tr><td style="padding:16px 0; border-bottom:1px solid #E8E2D0;">
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:14px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">→ O Acesso Fundador é vitalício de verdade?</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; line-height:1.65;">Vitalício da edição 2026. Tudo que entrar na edição 2026 (aulas, materiais, atualizações) você tem pra sempre. Edição 2027 será edição nova.</div>
            </td></tr>
            <tr><td style="padding:16px 0; border-bottom:1px solid #E8E2D0;">
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:14px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">→ Quanto é o anual?</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; line-height:1.65;"><strong style="color:#1B2A4A;">R$ 814,80 à vista</strong> ou <strong style="color:#1B2A4A;">12× R$ 67,90</strong> no cartão. Ambos no checkout. Sem flash, sem letra miúda — esse É o preço da janela.</div>
            </td></tr>
            <tr><td style="padding:16px 0; border-bottom:1px solid #E8E2D0;">
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:14px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">→ Quando começa o curso?</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; line-height:1.65;">Acesso Fundador: <strong style="color:#1B2A4A;">30 dias antes da turma geral</strong>. Você entra na plataforma sozinho(a) primeiro, organiza o estudo, e depois a turma chega.</div>
            </td></tr>
            <tr><td style="padding:16px 0; border-bottom:1px solid #E8E2D0;">
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:14px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">→ Garantia?</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; line-height:1.65;"><strong style="color:#1B2A4A;">7 dias incondicional.</strong> Se não for pra você, devolução integral, sem perguntas.</div>
            </td></tr>
            <tr><td style="padding:16px 0; border-bottom:1px solid #E8E2D0;">
              <div style="font-family:'Montserrat',Arial,sans-serif; font-size:14px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">→ E se eu não decidir hoje?</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; line-height:1.65;">Tri (R$ 397) e Sem (R$ 597) voltam dia 10/07 como modalidades padrão. Sem bônus Fundador, sem early access, sem selo. <em>São produtos diferentes</em>.</div>
            </td></tr>
          </table>

          <p style="margin:24px 0 18px 0;"><strong style="color:#1B2A4A;">Decisão de janela, não de produto.</strong> A pergunta certa não é "vale o curso?", e sim "vale a versão Fundador da edição 2026 — que só existe hoje?".</p>
{cta(LINK_VENDAS, "QUERO O ACESSO FUNDADOR →")}
          <p style="margin:0 0 18px 0; font-size:14px; color:#6B7280; text-align:center;">⏰ Hoje 23h59 · 7 dias de garantia · suporte rápido por email se quiser tirar dúvida antes de decidir</p>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">— <strong style="color:#1B2A4A;">Equipe Fluência Contábil</strong></p>
""",
    },
    # ────────────────────────────────────────────────────────────────────
    {
        "file": "L7-ultima-chamada.html",
        "subject": "🚨 ÚLTIMA CHAMADA · 5h pra encerrar a janela do Fundador",
        "preview": "23h59 fecha. Sem prorrogação. Sem reabertura.",
        "banner_color": "#C0392B",
        "banner_text": "🚨 5 HORAS · JANELA FECHA 23h59",
        "h1": "5 horas.<br><em style=\"color:#C0392B; font-style:normal;\">Última chamada.</em>",
        "body": f"""
          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 18px 0;">Faltam <strong style="color:#C0392B;">5 horas</strong>. Às 23h59 a janela do Acesso Fundador fecha de vez.</p>

          <p style="margin:0 0 28px 0;"><strong style="color:#1B2A4A;">Sem prorrogação. Sem reabertura. Sem janela secreta depois.</strong> O anual com bônus Fundador só existe até 23h59 de hoje.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0; background-color:#C0392B; border-radius:8px;">
            <tr><td style="padding:30px 32px; color:#FFFFFF; text-align:center;">
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:11px; font-weight:700; color:#FBF6E9; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">JANELA ENCERRA EM</div>
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:44px; font-weight:900; color:#FFFFFF; line-height:1; margin-bottom:8px; letter-spacing:-1px;">~ 5 HORAS</div>
              <div style="font-family:'Source Serif 4', Georgia, serif; font-size:14px; color:#FBF6E9; font-style:italic;">domingo · 05/07 · 23h59</div>
            </td></tr>
          </table>

          <p style="margin:0 0 18px 0;"><strong style="color:#1B2A4A;">Pra decidir nas próximas horas:</strong></p>
          <ul style="margin:0 0 28px 0; padding-left:22px; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.7; color:#1A1A1A;">
            <li style="margin-bottom:8px;">Anual: R$ 814,80 à vista OU 12× R$ 67,90</li>
            <li style="margin-bottom:8px;">Bônus Fundador: vitalício + early access 30d + selo (só nessa janela)</li>
            <li style="margin-bottom:8px;">7 dias de garantia incondicional</li>
            <li>Suporte por email: <a href="mailto:contato@fluenciacontabil.com.br" style="color:#1B2A4A;">contato@fluenciacontabil.com.br</a></li>
          </ul>
{cta(LINK_VENDAS, "ENTRAR ANTES DE FECHAR →")}
          <p style="margin:0 0 18px 0; text-align:center; font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#1A1A1A; font-style:italic;">"A versão Fundador da edição 2026 só existe hoje. A partir de amanhã, é outra coisa."</p>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">— <strong style="color:#1B2A4A;">Equipe Fluência Contábil</strong></p>
""",
    },
]


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for email in EMAILS:
        head = HEAD.format(
            subject=email["subject"],
            preview=email["preview"],
            banner_color=email["banner_color"],
            banner_text=email["banner_text"],
        )
        body_h1 = f'''
          <h1 class="h1" style="font-family:'Montserrat', Arial, sans-serif; font-size:26px; font-weight:700; color:#1B2A4A; line-height:1.3; margin:0 0 24px 0;">
            {email["h1"]}
          </h1>
'''
        content = head + body_h1 + email["body"] + FOOT

        path = OUTPUT_DIR / email["file"]
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"  ok {path}")
        count += 1

    print(f"\nPronto. Total: {count} broadcasts L1-L7 gerados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
