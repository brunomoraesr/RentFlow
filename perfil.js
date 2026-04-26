/**
 * perfil.js — Dashboard Analítico RentFlow
 *
 * Fluxo:  Supabase → JavaScript (cálculo) → ApexCharts (gráficos)
 *
 * Gráficos:
 *  1. Linha/Área  — Evolução Financeira (receita mês a mês)
 *  2. Rosca       — Status dos Imóveis (ocupados vs disponíveis)
 *  3. Barras      — Hóspedes por Reserva (frequência)
 *  4. Radial      — Taxa de Cancelamento
 *  5. Barras horiz— Tempo Vago por Imóvel
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────────────────────────────────────
let allBookings   = [];
let allProperties = [];
let cleaning      = [];

let filterYear   = new Date().getFullYear();
let filterMonth  = new Date().getMonth();   // -1 = ano todo
let filterPropId = '';

// Instâncias ApexCharts — criadas uma vez, atualizadas a cada filtro/evento
let lineChart   = null;
let donutChart  = null;
let guestsChart = null;
let cancelChart = null;
let vacantChart = null;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────
const fmtBR  = v  => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const setEl  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
const setCol = (id, col) => { const el = document.getElementById(id); if (el) el.style.color = col; };

function mapBooking(row) {
  return {
    id:           row.id,
    property_id:  row.property_id,
    checkin:      row.checkin,
    checkout:     row.checkout,
    source:       row.source,            // 'airbnb'|'booking'|'whatsapp'|'manual'|'blocked'|'cancelled'
    ical_source:  row.ical_source || null,
    value:        Number(row.value) || 0,
    guests_count: row.guests_count || 1,
  };
}

// Bloqueio manual = source 'blocked' SEM ical_source. Importações iCal com valor devem contar como receita.
const isManualBlock = b => b.source === 'blocked' && !b.ical_source;

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const userId = session.user.id;
  const [{ data: propsRaw }, { data: bkRaw }] = await Promise.all([
    db.from('properties').select('*').eq('user_id', userId),
    db.from('bookings').select('*').eq('user_id', userId).order('checkin'),
  ]);

  allProperties = propsRaw || [];
  allBookings   = (bkRaw  || []).map(mapBooking);

  try { cleaning = JSON.parse(localStorage.getItem('rental_cleaning_expenses') || '[]'); }
  catch { cleaning = []; }
  const validPropIds = new Set(allProperties.map(p => p.id));
  cleaning = cleaning.filter(c => validPropIds.has(c.property_id));

  buildYearSelect();
  buildPropSelect();
  document.getElementById('selYear').value  = filterYear;
  document.getElementById('selMonth').value = filterMonth;

  initCharts();
  updateDashboard();
  subscribeRealtime();

  // Mudanças de limpeza vindas de outra aba
  window.addEventListener('storage', e => {
    if (e.key !== 'rental_cleaning_expenses') return;
    try { cleaning = JSON.parse(e.newValue || '[]'); } catch { cleaning = []; }
    const validIds = new Set(allProperties.map(p => p.id));
    cleaning = cleaning.filter(c => validIds.has(c.property_id));
    updateDashboard();
  });

  // Ao voltar para esta aba, re-busca dados frescos do Supabase
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshData();
  });

  document.getElementById('loadingOverlay').style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH — re-busca dados do Supabase (usado ao voltar para a aba)
// ─────────────────────────────────────────────────────────────────────────────
async function refreshData() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  const [{ data: propsRaw }, { data: bkRaw }] = await Promise.all([
    db.from('properties').select('*').eq('user_id', userId),
    db.from('bookings').select('*').eq('user_id', userId).order('checkin'),
  ]);
  allProperties = propsRaw || [];
  allBookings   = (bkRaw  || []).map(mapBooking);
  try { cleaning = JSON.parse(localStorage.getItem('rental_cleaning_expenses') || '[]'); } catch { cleaning = []; }
  const validIds = new Set(allProperties.map(p => p.id));
  cleaning = cleaning.filter(c => validIds.has(c.property_id));
  buildYearSelect();
  buildPropSelect();
  updateDashboard();
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTS DE FILTRO
// ─────────────────────────────────────────────────────────────────────────────
function buildYearSelect() {
  const years = new Set(allBookings.map(b => new Date(b.checkin).getFullYear()));
  years.add(new Date().getFullYear());
  const sel = document.getElementById('selYear');
  sel.innerHTML = [...years].sort((a, b) => b - a)
    .map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = filterYear;
}

function buildPropSelect() {
  document.getElementById('selProp').innerHTML =
    '<option value="">Todos os imóveis</option>' +
    allProperties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function onFilterChange() {
  filterYear   = Number(document.getElementById('selYear').value);
  filterMonth  = Number(document.getElementById('selMonth').value);
  filterPropId = document.getElementById('selProp').value;
  updateDashboard();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FILTRO
// ─────────────────────────────────────────────────────────────────────────────

/** Reservas ATIVAS (exclui bloqueios e cancelamentos) no período/imóvel */
function getFilteredBookings() {
  return allBookings.filter(b => {
    const d = new Date(b.checkin);
    return !isManualBlock(b)
        && b.source !== 'cancelled'
        && d.getFullYear() === filterYear
        && (filterMonth === -1 || d.getMonth() === filterMonth)
        && (!filterPropId || b.property_id === filterPropId);
  });
}

/** Todas as reservas não-bloqueio (inclui canceladas) — para taxa de cancelamento */
function getAllNonBlockedInPeriod() {
  return allBookings.filter(b => {
    const d = new Date(b.checkin);
    return !isManualBlock(b)
        && d.getFullYear() === filterYear
        && (filterMonth === -1 || d.getMonth() === filterMonth)
        && (!filterPropId || b.property_id === filterPropId);
  });
}

/** Gastos de limpeza no período/imóvel */
function getFilteredCleaning() {
  return cleaning.filter(c => {
    const d = new Date(c.date + 'T00:00:00');
    return d.getFullYear() === filterYear
        && (filterMonth === -1 || d.getMonth() === filterMonth)
        && (!filterPropId || c.property_id === filterPropId);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULOS
// ─────────────────────────────────────────────────────────────────────────────

/** Receita por mês para o ano selecionado (gráfico de linha — sempre 12 pontos) */
function calcMonthlyRevenue() {
  const data = new Array(12).fill(0);
  allBookings
    .filter(b => {
      const d = new Date(b.checkin);
      return !isManualBlock(b)
          && b.source !== 'cancelled'
          && d.getFullYear() === filterYear
          && (!filterPropId || b.property_id === filterPropId);
    })
    .forEach(b => { data[new Date(b.checkin).getMonth()] += b.value; });
  return data;
}

/**
 * Dias ocupados vs disponíveis no período.
 * Usa Set por imóvel para evitar dupla contagem.
 * Cancelamentos NÃO contam como ocupação.
 */
function calcOccupancy() {
  const props = filterPropId
    ? allProperties.filter(p => p.id === filterPropId)
    : allProperties;
  if (!props.length) return { occupied: 0, available: 0, rate: 0, total: 0 };

  const pStart = filterMonth === -1 ? new Date(filterYear, 0, 1)  : new Date(filterYear, filterMonth, 1);
  const pEnd   = filterMonth === -1 ? new Date(filterYear, 11, 31) : new Date(filterYear, filterMonth + 1, 0);
  const totalDays = (Math.round((pEnd - pStart) / 86400000) + 1) * props.length;

  const pool = allBookings.filter(b =>
    !isManualBlock(b) && b.source !== 'cancelled' &&
    (!filterPropId || b.property_id === filterPropId)
  );

  let occupiedCount = 0;
  props.forEach(prop => {
    const occupied = new Set();
    pool.filter(b => b.property_id === prop.id).forEach(b => {
      const s = new Date(Math.max(+new Date(b.checkin  + 'T00:00:00'), +pStart));
      const e = new Date(Math.min(+new Date(b.checkout + 'T00:00:00'), +pEnd + 86400000));
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1))
        occupied.add(d.toISOString().slice(0, 10));
    });
    occupiedCount += occupied.size;
  });

  const available = Math.max(0, totalDays - occupiedCount);
  const rate      = totalDays ? Math.round(occupiedCount / totalDays * 100) : 0;
  return { occupied: occupiedCount, available, rate, total: totalDays };
}

/**
 * Frequência de hóspedes por reserva ativa.
 * @returns {{ '1':n, '2':n, '3':n, '4':n, '5+':n }}
 */
function calcGuestsFrequency() {
  const freq = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
  getFilteredBookings().forEach(b => {
    const g = b.guests_count || 1;
    freq[g >= 5 ? '5+' : String(g)]++;
  });
  return freq;
}

/**
 * Estatísticas de cancelamento no período.
 * @returns {{ cancelled:n, active:n, total:n, rate:n }}
 */
function calcCancellationStats() {
  const all       = getAllNonBlockedInPeriod();
  const cancelled = all.filter(b => b.source === 'cancelled').length;
  const total     = all.length;
  const rate      = total ? Math.round(cancelled / total * 100) : 0;
  return { cancelled, active: total - cancelled, total, rate };
}

/**
 * Dias vagos (sem reserva ativa) por imóvel no período.
 * @returns {Array<{ name:string, vacantDays:n, totalDays:n }>}
 */
function calcVacantByProperty() {
  const props = filterPropId
    ? allProperties.filter(p => p.id === filterPropId)
    : allProperties;

  const pStart = filterMonth === -1 ? new Date(filterYear, 0, 1)  : new Date(filterYear, filterMonth, 1);
  const pEnd   = filterMonth === -1 ? new Date(filterYear, 11, 31) : new Date(filterYear, filterMonth + 1, 0);
  const totalDays = Math.round((pEnd - pStart) / 86400000) + 1;

  const activeBooks = allBookings.filter(b =>
    !isManualBlock(b) && b.source !== 'cancelled'
  );

  return props.map(prop => {
    const occupied = new Set();
    activeBooks.filter(b => b.property_id === prop.id).forEach(b => {
      const s = new Date(Math.max(+new Date(b.checkin  + 'T00:00:00'), +pStart));
      const e = new Date(Math.min(+new Date(b.checkout + 'T00:00:00'), +pEnd + 86400000));
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1))
        occupied.add(d.toISOString().slice(0, 10));
    });
    return { name: prop.name, vacantDays: totalDays - occupied.size, totalDays };
  }).sort((a, b) => b.vacantDays - a.vacantDays);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE DASHBOARD ← chamado a cada filtro ou evento realtime
// ─────────────────────────────────────────────────────────────────────────────
function updateDashboard() {
  const books     = getFilteredBookings();
  const occ       = calcOccupancy();
  const revenue   = books.reduce((s, b) => s + b.value, 0);
  const cleanCost = getFilteredCleaning().reduce((s, c) => s + (Number(c.value) || 0), 0);
  const profit    = revenue - cleanCost;
  const cancel    = calcCancellationStats();
  const period    = filterMonth === -1
    ? String(filterYear)
    : `${MONTHS_FULL[filterMonth]} ${filterYear}`;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  setEl('kpiReceitaLbl', 'Receita de ' + period);
  setEl('kpiLucroLbl',   'Lucro de '   + period);

  setEl('kpiReservas',    books.length);
  setEl('kpiReservasSub', period);

  setEl('kpiOcupacao',    occ.rate + '%');
  setEl('kpiOcupacaoSub', `${occ.occupied} de ${occ.total} dias`);

  setEl('kpiReceita',    'R$ ' + fmtBR(revenue));
  setEl('kpiReceitaSub', `${books.length} reserva${books.length !== 1 ? 's' : ''}`);

  const lucroEl = document.getElementById('kpiLucro');
  if (lucroEl) {
    lucroEl.textContent = 'R$ ' + fmtBR(profit);
    lucroEl.style.color = profit < 0 ? 'var(--danger)' : profit > 0 ? 'var(--success)' : 'var(--txt)';
  }
  setEl('kpiLucroSub', `R$${fmtBR(revenue)} receita − R$${fmtBR(cleanCost)} limpeza`);

  // ── Sidebar resumo ───────────────────────────────────────────────────────
  setEl('sbReservas', books.length);
  setEl('sbReceita',  'R$' + fmtBR(revenue));
  setEl('sbOcupacao', occ.rate + '%');
  setEl('sbCancel',   cancel.cancelled + ' (' + cancel.rate + '%)');

  // ── Gráfico de linha: série + anotação do mês selecionado ───────────────
  lineChart.updateSeries([{ name: 'Receita', data: calcMonthlyRevenue() }]);
  lineChart.updateOptions({
    annotations: filterMonth >= 0 ? {
      xaxis: [{
        x: MONTHS_PT[filterMonth],
        borderColor: 'rgba(124,109,250,.4)',
        fillColor:   'rgba(124,109,250,.06)',
        label: {
          borderColor: '#7c6dfa',
          style: {
            color: '#fff', background: '#7c6dfa',
            fontSize: '11px', fontFamily: "'Figtree', sans-serif",
            padding: { top: 3, bottom: 3, left: 7, right: 7 },
          },
          text: MONTHS_PT[filterMonth],
          orientation: 'horizontal',
        },
      }],
    } : { xaxis: [] },
  }, false, false);

  // ── Gráfico de rosca ─────────────────────────────────────────────────────
  const donutSeries = occ.total > 0 ? [occ.occupied, occ.available] : [0, 100];
  donutChart.updateOptions({
    labels: [`Ocupados (${occ.occupied}d)`, `Disponíveis (${occ.available}d)`],
  }, false, false);
  donutChart.updateSeries(donutSeries);

  // ── Hóspedes por reserva ─────────────────────────────────────────────────
  const freq = calcGuestsFrequency();
  guestsChart.updateSeries([{ name: 'Reservas', data: Object.values(freq) }]);

  // ── Taxa de cancelamento ─────────────────────────────────────────────────
  cancelChart.updateSeries([cancel.rate]);
  setEl('cancelChartDesc', `${cancel.cancelled} cancelada${cancel.cancelled !== 1 ? 's' : ''} de ${cancel.total} reserva${cancel.total !== 1 ? 's' : ''}`);

  // ── Tempo vago por imóvel ─────────────────────────────────────────────────
  const vacant = calcVacantByProperty();
  const vacantMax = vacant.length ? vacant[0].totalDays : 31;
  vacantChart.updateOptions({
    xaxis: {
      categories: vacant.map(p => p.name),
      max: vacantMax,
      labels: {
        formatter: v => (Number.isFinite(+v) && v !== '' ? Math.round(+v) + 'd' : v),
        style: { colors: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" },
      },
    },
  }, false, false);
  vacantChart.updateSeries([{ name: 'Dias vagos', data: vacant.map(p => p.vacantDays) }]);
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT CHARTS
// ─────────────────────────────────────────────────────────────────────────────
function initCharts() {
  lineChart   = buildLineChart();
  donutChart  = buildDonutChart();
  guestsChart = buildGuestsChart();
  cancelChart = buildCancelChart();
  vacantChart = buildVacantChart();

  lineChart.render();
  donutChart.render();
  guestsChart.render();
  cancelChart.render();
  vacantChart.render();
}

// ── 1. Gráfico de linha — Evolução Financeira ─────────────────────────────
function buildLineChart() {
  return new ApexCharts(document.getElementById('lineChartEl'), {
    chart: {
      type: 'area', height: 240,
      fontFamily: "'Figtree', sans-serif",
      toolbar: { show: false }, zoom: { enabled: false },
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
      background: 'transparent',
    },
    series: [{ name: 'Receita', data: new Array(12).fill(0) }],
    xaxis: {
      categories: MONTHS_PT,
      labels: { style: { colors: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: v => 'R$' + Number(v).toLocaleString('pt-BR'),
        style: { colors: '#a0a0ad', fontSize: '10px', fontFamily: "'Figtree', sans-serif" },
      },
    },
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, type: 'vertical', opacityFrom: 0.18, opacityTo: 0.01 } },
    colors:  ['#7c6dfa'],
    markers: { size: 3, colors: ['#7c6dfa'], strokeColors: '#fff', strokeWidth: 2, hover: { size: 5 } },
    tooltip: {
      y: { formatter: v => 'R$ ' + fmtBR(v) },
      theme: 'light', style: { fontFamily: "'Figtree', sans-serif" },
    },
    grid: { borderColor: 'rgba(0,0,0,.06)', strokeDashArray: 4, padding: { left: 4, right: 4, bottom: 0 } },
    dataLabels: { enabled: false },
  });
}

// ── 2. Gráfico de rosca — Status dos Imóveis ─────────────────────────────
function buildDonutChart() {
  return new ApexCharts(document.getElementById('donutChartEl'), {
    chart: {
      type: 'donut', height: 240,
      fontFamily: "'Figtree', sans-serif",
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
      background: 'transparent',
      events: {},
    },
    series: [0, 100],
    labels: ['Ocupados', 'Disponíveis'],
    colors: ['#7c6dfa', '#e8e8e4'],
    states: {
      hover:  { filter: { type: 'none' } },
      active: { filter: { type: 'none' } },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '64%',
          labels: {
            show: true,
            name: { fontSize: '11px', color: '#a0a0ad', fontFamily: "'Figtree', sans-serif", offsetY: -4 },
            value: { fontSize: '22px', fontWeight: 700, color: '#1a1a1f', fontFamily: "'Figtree', sans-serif", formatter: v => v + 'd' },
            total: {
              show: true, label: 'Ocupação', color: '#a0a0ad',
              fontSize: '11px', fontFamily: "'Figtree', sans-serif",
              formatter: w => {
                const t = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return t ? Math.round(w.globals.seriesTotals[0] / t * 100) + '%' : '0%';
              },
            },
          },
        },
      },
    },
    legend: {
      position: 'bottom', fontSize: '11px', fontFamily: "'Figtree', sans-serif",
      labels: { colors: '#6b6a78' }, markers: { width: 9, height: 9, radius: 3 },
    },
    dataLabels: { enabled: false },
    tooltip: { enabled: false },
  });
}

// ── 3. Gráfico de barras — Hóspedes por Reserva ──────────────────────────
function buildGuestsChart() {
  return new ApexCharts(document.getElementById('guestsChartEl'), {
    chart: {
      type: 'bar', height: 210,
      fontFamily: "'Figtree', sans-serif",
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
      background: 'transparent',
    },
    series: [{ name: 'Reservas', data: [0, 0, 0, 0, 0] }],
    xaxis: {
      categories: ['1', '2', '3', '4', '5+'],
      labels: { style: { colors: '#a0a0ad', fontSize: '12px', fontFamily: "'Figtree', sans-serif" } },
      title: { text: 'Nº de hóspedes', style: { color: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: v => Math.round(v),
        style: { colors: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" },
      },
      tickAmount: 4,
    },
    plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
    colors: ['#34c97e'],
    dataLabels: { enabled: false },
    tooltip: {
      y: { formatter: v => `${v} reserva${v !== 1 ? 's' : ''}` },
      theme: 'light', style: { fontFamily: "'Figtree', sans-serif" },
    },
    grid: { borderColor: 'rgba(0,0,0,.06)', strokeDashArray: 4, padding: { left: 4, right: 4 } },
  });
}

// ── 4. Gráfico radial — Taxa de Cancelamento ─────────────────────────────
function buildCancelChart() {
  return new ApexCharts(document.getElementById('cancelChartEl'), {
    chart: {
      type: 'radialBar', height: 210,
      fontFamily: "'Figtree', sans-serif",
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
      background: 'transparent',
    },
    series: [0],
    colors: ['#d97706'],
    plotOptions: {
      radialBar: {
        hollow: { size: '58%', background: 'transparent' },
        track: { background: 'rgba(0,0,0,.06)', strokeWidth: '100%' },
        dataLabels: {
          name: {
            show: true, offsetY: -8,
            fontSize: '11px', color: '#a0a0ad',
            fontFamily: "'Figtree', sans-serif",
          },
          value: {
            show: true, offsetY: 4,
            fontSize: '26px', fontWeight: 700, color: '#1a1a1f',
            fontFamily: "'Figtree', sans-serif",
            formatter: v => v + '%',
          },
        },
      },
    },
    labels: ['Cancelamentos'],
    stroke: { lineCap: 'round' },
  });
}

// ── 5. Barras horizontais — Tempo Vago por Imóvel ────────────────────────
function buildVacantChart() {
  return new ApexCharts(document.getElementById('vacantChartEl'), {
    chart: {
      type: 'bar', height: 210,
      fontFamily: "'Figtree', sans-serif",
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
      background: 'transparent',
    },
    series: [{ name: 'Dias vagos', data: [] }],
    xaxis: {
      categories: [],
      labels: {
        // Eixo inferior mostra os valores numéricos (dias)
        formatter: v => (Number.isFinite(+v) && v !== '' ? Math.round(+v) + 'd' : v),
        style: { colors: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" },
      },
      min: 0,
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      // Eixo esquerdo exibe os nomes dos imóveis — sem formatter numérico
      labels: {
        style: { colors: '#a0a0ad', fontSize: '11px', fontFamily: "'Figtree', sans-serif" },
        maxWidth: 120,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '55%',
        distributed: true,
      },
    },
    colors: ['#4a90d9', '#7c6dfa', '#34c97e', '#f5a623', '#ff5a5f'],
    legend: { show: false },
    dataLabels: {
      enabled: true,
      formatter: v => v + 'd',
      style: { fontSize: '11px', fontFamily: "'Figtree', sans-serif", colors: ['#fff'] },
    },
    tooltip: {
      y: { formatter: v => `${v} dia${v !== 1 ? 's' : ''} vago${v !== 1 ? 's' : ''}` },
      theme: 'light', style: { fontFamily: "'Figtree', sans-serif" },
    },
    grid: { borderColor: 'rgba(0,0,0,.06)', strokeDashArray: 4, padding: { left: 4, right: 8 } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME — Supabase Postgres Changes
// INSERT / UPDATE / DELETE → atualiza array local → updateDashboard()
// ─────────────────────────────────────────────────────────────────────────────
function subscribeRealtime() {
  const dot  = document.getElementById('liveDot');
  const text = document.getElementById('liveText');

  db.channel('dash-live')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'bookings' },
      payload => {
        if (payload.eventType === 'INSERT') {
          allBookings.push(mapBooking(payload.new));
        } else if (payload.eventType === 'DELETE') {
          allBookings = allBookings.filter(b => b.id !== payload.old.id);
        } else if (payload.eventType === 'UPDATE') {
          allBookings = allBookings.filter(b => b.id !== payload.new.id);
          allBookings.push(mapBooking(payload.new));
        }
        buildYearSelect();
        updateDashboard();
      }
    )
    .subscribe(status => {
      const connected = status === 'SUBSCRIBED';
      dot.classList.toggle('on', connected);
      text.textContent = connected                    ? 'Ao vivo'
                       : status === 'CHANNEL_ERROR'  ? 'Erro na conexão'
                       : 'Reconectando...';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER — Toggle da sidebar de filtros (mobile/tablet)
// ─────────────────────────────────────────────────────────────────────────────
function toggleDashSidebar() {
  const sidebar  = document.querySelector('.dash-sidebar');
  const backdrop = document.getElementById('dashSidebarBackdrop');
  const btn      = document.getElementById('btnDashToggle');
  const opening  = !sidebar.classList.contains('is-open');

  sidebar.classList.toggle('is-open', opening);
  backdrop.classList.toggle('open',   opening);
  if (btn) btn.classList.toggle('active', opening);
}

function closeDashSidebar() {
  const sidebar  = document.querySelector('.dash-sidebar');
  const backdrop = document.getElementById('dashSidebarBackdrop');
  const btn      = document.getElementById('btnDashToggle');

  sidebar.classList.remove('is-open');
  backdrop.classList.remove('open');
  if (btn) btn.classList.remove('active');
}

// Fechar com Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDashSidebar(); });

// Ao aplicar um filtro no mobile, fecha o drawer automaticamente
function onFilterChange() {
  filterYear   = Number(document.getElementById('selYear').value);
  filterMonth  = Number(document.getElementById('selMonth').value);
  filterPropId = document.getElementById('selProp').value;
  closeDashSidebar();
  updateDashboard();
}

// ─────────────────────────────────────────────────────────────────────────────
init();
//
