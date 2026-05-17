#!/usr/bin/env python3
"""
Gera os 8 emails da Sequência E enxuta (operacional das lives).

Substitui a antiga sequência de 25 emails (E1-E5 × 5 lives, agora ARQUIVADA).

Cada live recebe 2 emails:
  - VESPERA (disparo 18h da véspera): "Amanhã 20h: Live N · tema"
  - AOVIVO  (disparo 19h55 do dia):   "🔴 Live N começando agora"

Trigger no MailerLite: lead entrou no group da live correspondente.

Output:
  email-templates/sequencia-e/
    live-1-vespera.html · live-1-aovivo.html
    live-2-vespera.html · live-2-aovivo.html
    live-3-vespera.html · live-3-aovivo.html
    live-4-vespera.html · live-4-aovivo.html
"""
from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

OUTPUT_DIR = Path("email-templates/sequencia-e")

# ─── Dados das 4 lives ───
LIVES = [
    {
        "num": 1,
        "tema": "Débito e Crédito",
        "tema_lower": "débito e crédito",
        "tagline": "Onde tudo começa.",
        "dia_semana": "segunda",
        "dia_semana_cap": "Segunda",
        "data_curta": "29/06",
        "data_extenso": "29 de junho",
        "preview_extra": "A base de todo o resto.",
        "destaque_cor": "#C8A84B",   # dourado (padrão)
        "is_lancamento": False,
    },
    {
        "num": 2,
        "tema": "CPC 51",
        "tema_lower": "CPC 51",
        "tagline": "A palavra mais cobrada da contabilidade.",
        "dia_semana": "terça",
        "dia_semana_cap": "Terça",
        "data_curta": "30/06",
        "data_extenso": "30 de junho",
        "preview_extra": "Onde mais gente perde ponto.",
        "destaque_cor": "#C8A84B",
        "is_lancamento": False,
    },
    {
        "num": 3,
        "tema": "Lançamento Oficial",
        "tema_lower": "lançamento oficial",
        "tagline": "A casa abre, ao vivo.",
        "dia_semana": "quarta",
        "dia_semana_cap": "Quarta",
        "data_curta": "01/07",
        "data_extenso": "1º de julho",
        "preview_extra": "As vagas do Fluência Contábil entram no ar.",
        "destaque_cor": "#C0392B",   # vermelho (destaque do lançamento)
        "is_lancamento": True,
    },
    {
        "num": 4,
        "tema": "Tour pela Plataforma",
        "tema_lower": "tour pela plataforma",
        "tagline": "A casa por dentro.",
        "dia_semana": "quinta",
        "dia_semana_cap": "Quinta",
        "data_curta": "02/07",
        "data_extenso": "2 de julho",
        "preview_extra": "Tour ao vivo · última noite da série.",
        "destaque_cor": "#C8A84B",
        "is_lancamento": False,
    },
]

# ─── Template VESPERA (lembrete 18h) ───
VESPERA = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Amanhã 20h: Live {num} — {tema}</title>
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
  <div style="display:none; font-size:1px; color:#FBF6E9; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    Amanhã, {dia_semana} {data_curta}, 20h. {preview_extra}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FFFFFF; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(27,42,74,0.08);">

        <!-- Header -->
        <tr><td align="center" style="background-color:#1B2A4A; padding:32px 24px 28px 24px;">
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:24px; font-weight:700; color:#FFFFFF; letter-spacing:1px; line-height:1.2;">FLUÊNCIA <span style="color:#C8A84B;">CONTÁBIL</span></div>
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:12px; font-weight:400; color:#FBF6E9; letter-spacing:0.5px; margin-top:6px; text-transform:uppercase;">Contabilidade para quem quer ser fluente</div>
          <div style="width:60px; height:3px; background-color:#C8A84B; margin:16px auto 0;"></div>
        </td></tr>

        <!-- Banner -->
        <tr><td style="background-color:{destaque_cor}; padding:18px 24px; text-align:center;">
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:14px; font-weight:700; color:#FFFFFF; letter-spacing:1.5px; text-transform:uppercase;">📅 AMANHÃ · 20h · LIVE {num}</div>
        </td></tr>

        <!-- Corpo -->
        <tr><td class="padded" style="padding:40px 48px 32px 48px; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.7; color:#1A1A1A;">

          <h1 class="h1" style="font-family:'Montserrat', Arial, sans-serif; font-size:26px; font-weight:700; color:#1B2A4A; line-height:1.3; margin:0 0 24px 0;">
            Amanhã, 20h.<br>{tema} ao vivo.
          </h1>

          <p style="margin:0 0 18px 0;">Oi,</p>

          <p style="margin:0 0 28px 0;">Pequeno lembrete: <strong style="color:#1B2A4A;">amanhã, {dia_semana} {data_curta}, às 20h</strong>, acontece a <strong style="color:#1B2A4A;">Live {num} — {tema}</strong>. Você se inscreveu, tá tudo certo.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0; background-color:#1B2A4A; border-radius:8px;">
            <tr><td style="padding:24px 28px; color:#FFFFFF;">
              <div style="font-family:'Montserrat', Arial, sans-serif; font-size:11px; font-weight:700; color:#C8A84B; letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">🔴 LIVE {num} · {tema_upper}</div>
              <div style="font-family:'Source Serif 4',Georgia,serif; font-size:15px; color:#C8A84B; font-style:italic; margin-bottom:14px;">"{tagline}"</div>
              <div style="height:1px; background-color:#2A3F6F; margin:12px 0;"></div>
              <div style="font-family:'Source Serif 4', Georgia, serif; font-size:15px; color:#FBF6E9; line-height:1.8;">
                <span style="color:#C8A84B; font-weight:700;">📅</span>  {dia_semana_cap}, <strong style="color:#FFFFFF;">{data_extenso}</strong>, às <strong style="color:#FFFFFF;">20h</strong><br>
                <span style="color:#C8A84B; font-weight:700;">🎬</span>  Ao vivo no YouTube
              </div>
            </td></tr>
          </table>

          <p style="margin:0 0 16px 0;"><strong style="color:#1B2A4A;">Pra aproveitar ao máximo:</strong></p>
          <ul style="margin:0 0 28px 0; padding-left:22px; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.7; color:#1A1A1A;">
            <li style="margin-bottom:8px;">Caderno e caneta do lado — Vinícius desenha no quadro</li>
            <li style="margin-bottom:8px;">YouTube já no ar 5 minutinhos antes pra carregar</li>
            <li>Se não puder ao vivo, <strong style="color:#1B2A4A;">replay fica permanente no YouTube</strong></li>
          </ul>

          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 28px;">
            <tr><td align="center" bgcolor="#1B2A4A" style="border-radius:6px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://fluenciacontabil.com.br/lives.html" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="#0F1A30" fillcolor="#1B2A4A"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">VER A AGENDA COMPLETA →</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-- -->
              <a href="https://fluenciacontabil.com.br/lives.html" class="cta-btn" style="display:inline-block; padding:14px 28px; font-family:'Montserrat', Arial, sans-serif; font-size:14px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:6px; background-color:#1B2A4A; border:1px solid #0F1A30; letter-spacing:0.3px;">VER A AGENDA COMPLETA →</a>
              <!--<![endif]-->
            </td></tr>
          </table>

          <div style="border-top:1px solid #E8E2D0; margin:32px 0 24px 0;"></div>
          <p style="margin:0; font-family:'Source Serif 4', Georgia, serif; font-size:16px; color:#1A1A1A;">Até amanhã,<br><strong style="color:#1B2A4A;">— Equipe Fluência Contábil</strong></p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#1B2A4A; padding:28px 48px; font-family:'Montserrat', Arial, sans-serif; font-size:12px; color:#FBF6E9; line-height:1.6; text-align:center;">
          <div style="margin-bottom:12px;"><a href="https://fluenciacontabil.com.br" style="color:#C8A84B; text-decoration:none; font-weight:600;">fluenciacontabil.com.br</a></div>
          <div style="margin-bottom:12px;">
            <a href="https://fluenciacontabil.com.br/blog.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Blog</a><span style="color:#C8A84B;">·</span>
            <a href="https://fluenciacontabil.com.br/cursos.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Curso</a><span style="color:#C8A84B;">·</span>
            <a href="https://fluenciacontabil.com.br/contato.html" style="color:#FBF6E9; text-decoration:underline; margin:0 8px;">Contato</a>
          </div>
          <div style="color:#8B97B3; font-size:11px; line-height:1.5; margin-top:16px;">Você está recebendo este email porque se inscreveu na Live {num} do Fluência Contábil.<br>Não quer mais receber? <a href="{{$unsubscribe}}" style="color:#C8A84B; text-decoration:underline;">Descadastrar</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

# ─── Template AO VIVO (19h55) ───
AOVIVO = """<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>🔴 Live {num} começando agora: {tema}</title>
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
      .h1 {{ font-size: 28px !important; line-height: 1.2 !important; }}
      .cta-btn {{ display: block !important; width: 100% !important; box-sizing: border-box !important; }}
    }}
  </style>
</head>
<body style="margin:0; padding:0; background-color:#FBF6E9; font-family:'Montserrat', Arial, Helvetica, sans-serif;">
  <div style="display:none; font-size:1px; color:#FBF6E9; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    Tá no ar a Live {num}. Entra antes do bicho pegar.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF6E9;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FFFFFF; border-radius:8px; overflow:hidden; box-shadow:0 8px 32px rgba(192,57,43,0.18);">

        <tr><td align="center" style="background-color:#C0392B; padding:32px 24px;">
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:32px; font-weight:900; color:#FFFFFF; letter-spacing:3px; line-height:1;">🔴 AO VIVO</div>
          <div style="font-family:'Montserrat', Arial, sans-serif; font-size:14px; font-weight:700; color:#FFFFFF; margin-top:10px; letter-spacing:1.5px;">LIVE {num} · {tema_upper}</div>
        </td></tr>

        <tr><td class="padded" style="padding:48px 48px 36px 48px; text-align:center; font-family:'Source Serif 4', Georgia, serif; font-size:16px; line-height:1.7; color:#1A1A1A;">

          <h1 class="h1" style="font-family:'Montserrat', Arial, sans-serif; font-size:32px; font-weight:800; color:#1B2A4A; line-height:1.15; margin:0 0 18px 0;">
            Tá começando.<br>Entra agora.
          </h1>

          <p style="margin:0 0 32px 0; font-size:17px;">A <strong style="color:#1B2A4A;">Live {num}</strong> sobre <strong style="color:#1B2A4A;">{tema}</strong> começou neste instante no YouTube. <em style="color:#6B7280;">"{tagline}"</em></p>

          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 24px;">
            <tr><td align="center" bgcolor="#C0392B" style="border-radius:8px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://fluenciacontabil.com.br/lives.html" style="height:60px;v-text-anchor:middle;width:340px;" arcsize="12%" strokecolor="#8B2819" fillcolor="#C0392B"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:18px;font-weight:800;">▶ ENTRAR NA LIVE AGORA</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-- -->
              <a href="https://fluenciacontabil.com.br/lives.html" class="cta-btn" style="display:inline-block; padding:20px 44px; font-family:'Montserrat', Arial, sans-serif; font-size:18px; font-weight:800; color:#FFFFFF; text-decoration:none; border-radius:8px; background-color:#C0392B; border:2px solid #8B2819; letter-spacing:1px;">▶ ENTRAR NA LIVE AGORA</a>
              <!--<![endif]-->
            </td></tr>
          </table>

          <p style="margin:0; font-size:13px; color:#6B7280;">Replay fica permanente no YouTube depois.</p>

        </td></tr>

        <tr><td style="background-color:#1B2A4A; padding:24px 48px; font-family:'Montserrat', Arial, sans-serif; font-size:12px; color:#FBF6E9; line-height:1.6; text-align:center;">
          <div style="color:#8B97B3; font-size:11px; line-height:1.5;">FLUÊNCIA CONTÁBIL · <a href="{{$unsubscribe}}" style="color:#C8A84B; text-decoration:underline;">Descadastrar</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for live in LIVES:
        ctx = {
            **live,
            "tema_upper": live["tema"].upper(),
        }
        # VESPERA
        path_v = OUTPUT_DIR / f"live-{live['num']}-vespera.html"
        with open(path_v, "w", encoding="utf-8", newline="\n") as f:
            f.write(VESPERA.format(**ctx))
        print(f"  ok {path_v}")
        count += 1

        # AOVIVO
        path_a = OUTPUT_DIR / f"live-{live['num']}-aovivo.html"
        with open(path_a, "w", encoding="utf-8", newline="\n") as f:
            f.write(AOVIVO.format(**ctx))
        print(f"  ok {path_a}")
        count += 1

    print(f"\nPronto. Total: {count} emails da Sequência E enxuta gerados ({len(LIVES)} lives × 2).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
