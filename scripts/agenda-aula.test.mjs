import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/* Os dois botões de agenda da LP (tela "inscrição feita") leem o destino pronto da
   agenda.json, gerada pelo kit da live (_LIVES/_semanal/publicar_semana_lp.py).
   Aqui se confere o que está publicado, do jeito que o visitante vai receber:
   arquivo que agenda nenhuma recusa, e os dois botões marcando a mesma hora. */
const agenda = JSON.parse(readFileSync(new URL('../assets/aulas/agenda.json', import.meta.url), 'utf8'));
const comAgenda = agenda.aulas.filter((a) => a.ics || a.agenda_google);
const INSTANTE = /^\d{8}T\d{6}Z$/;
const semEscape = (v) => v.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

// Lê o iCalendar como um cliente de agenda: confere as linhas físicas, desfaz a
// dobra e devolve as propriedades de cada componente.
function lerIcs(texto, nome) {
  assert.ok(texto.endsWith('\r\n'), `${nome}: não termina em CRLF`);
  assert.equal(/[^\r]\n|\r(?!\n)/.test(texto), false, `${nome}: quebra de linha que não é CRLF`);
  const fisicas = texto.slice(0, -2).split('\r\n');
  const logicas = [];
  for (const linha of fisicas) {
    assert.notEqual(linha.trim(), '', `${nome}: linha em branco`);
    assert.ok(Buffer.byteLength(linha, 'utf8') <= 75, `${nome}: linha com mais de 75 octetos`);
    if (/^[ \t]/.test(linha)) {
      assert.ok(logicas.length > 0, `${nome}: continuação sem linha anterior`);
      logicas[logicas.length - 1] += linha.slice(1);
    } else logicas.push(linha);
  }
  const componentes = {}, pilha = [];
  for (const linha of logicas) {
    const i = linha.indexOf(':');
    assert.ok(i > 0, `${nome}: linha sem "nome:valor" (${linha})`);
    const chave = linha.slice(0, i), valor = linha.slice(i + 1);
    if (chave === 'BEGIN') {
      assert.equal(valor in componentes, false, `${nome}: ${valor} repetido`);
      componentes[valor] = {};
      pilha.push(valor);
    } else if (chave === 'END') {
      assert.equal(pilha.pop(), valor, `${nome}: END:${valor} fora de ordem`);
    } else {
      assert.ok(pilha.length > 0, `${nome}: propriedade fora de componente`);
      const dono = componentes[pilha[pilha.length - 1]];
      assert.equal(chave in dono, false, `${nome}: ${chave} repetido`);
      dono[chave] = valor;
    }
  }
  assert.deepEqual(pilha, [], `${nome}: componente sem END`);
  assert.deepEqual(Object.keys(componentes), ['VCALENDAR', 'VEVENT', 'VALARM'], `${nome}: componentes`);
  return componentes;
}

test('há semana publicada com agenda, e quem tem um destino tem os dois', () => {
  assert.ok(comAgenda.length >= 1, 'nenhuma semana com agenda');
  for (const a of comAgenda) {
    assert.ok(a.youtube, `${a.data}: agenda sem link da transmissão`);
    assert.ok(a.ics && a.agenda_google, `${a.data}: falta um dos dois destinos`);
  }
});

test('o .ics publicado é um iCalendar completo, da aula certa', () => {
  for (const a of comAgenda) {
    assert.match(a.ics, /^assets\/aulas\/aula-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.ics$/);
    const { VCALENDAR, VEVENT, VALARM } = lerIcs(readFileSync(new URL('../' + a.ics, import.meta.url), 'utf8'), a.ics);
    assert.equal(VCALENDAR.VERSION, '2.0');
    assert.ok(VCALENDAR.PRODID);
    assert.equal(VEVENT.UID, `${a.origem}@fluenciacontabil.com.br`);   // pela origem: não muda na remarcação
    for (const campo of ['DTSTAMP', 'DTSTART', 'DTEND']) assert.match(VEVENT[campo] || '', INSTANTE, campo);
    assert.ok(VEVENT.DTEND > VEVENT.DTSTART, 'fim antes do início');
    // o dia do evento, no horário de Brasília (UTC−3), é o dia da aula
    const inicio = VEVENT.DTSTART.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z');
    assert.equal(new Date(Date.parse(inicio) - 3 * 3600 * 1000).toISOString().slice(0, 10), a.data);
    assert.equal(semEscape(VEVENT.SUMMARY), `Aula ao vivo: ${a.tema}`);
    assert.equal(semEscape(VEVENT.URL), a.youtube);
    assert.equal(semEscape(VEVENT.LOCATION), a.youtube);
    assert.ok(semEscape(VEVENT.DESCRIPTION).includes(a.youtube));
    assert.equal(VALARM.ACTION, 'DISPLAY');
    assert.match(VALARM.TRIGGER || '', /^-PT\d+M$/);
    assert.ok(VALARM.DESCRIPTION);
  }
});

test('o link do Google Agenda marca a mesma aula e a mesma hora do .ics', () => {
  for (const a of comAgenda) {
    const u = new URL(a.agenda_google);
    assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
    assert.equal(u.searchParams.get('action'), 'TEMPLATE');
    assert.equal(u.searchParams.get('text'), `Aula ao vivo: ${a.tema}`);
    assert.equal(u.searchParams.get('location'), a.youtube);
    assert.ok(u.searchParams.get('details').includes(a.youtube));
    const { VEVENT } = lerIcs(readFileSync(new URL('../' + a.ics, import.meta.url), 'utf8'), a.ics);
    assert.equal(u.searchParams.get('dates'), `${VEVENT.DTSTART}/${VEVENT.DTEND}`);
  }
});
