// services/cities.js — Seletor inteligente de cidades brasileiras (API IBGE + fallback estático)

// ── Fallback estático: capitais + maiores municípios ─────────────────────────
const _STATIC_CITIES = [
  // Capitais
  {name:"Rio Branco",uf:"AC"},{name:"Maceió",uf:"AL"},{name:"Manaus",uf:"AM"},
  {name:"Macapá",uf:"AP"},{name:"Salvador",uf:"BA"},{name:"Fortaleza",uf:"CE"},
  {name:"Brasília",uf:"DF"},{name:"Vitória",uf:"ES"},{name:"Goiânia",uf:"GO"},
  {name:"São Luís",uf:"MA"},{name:"Belo Horizonte",uf:"MG"},{name:"Campo Grande",uf:"MS"},
  {name:"Cuiabá",uf:"MT"},{name:"Belém",uf:"PA"},{name:"João Pessoa",uf:"PB"},
  {name:"Recife",uf:"PE"},{name:"Teresina",uf:"PI"},{name:"Curitiba",uf:"PR"},
  {name:"Rio de Janeiro",uf:"RJ"},{name:"Natal",uf:"RN"},{name:"Porto Velho",uf:"RO"},
  {name:"Boa Vista",uf:"RR"},{name:"Porto Alegre",uf:"RS"},{name:"Florianópolis",uf:"SC"},
  {name:"Aracaju",uf:"SE"},{name:"São Paulo",uf:"SP"},{name:"Palmas",uf:"TO"},
  // SP - maiores
  {name:"Guarulhos",uf:"SP"},{name:"Campinas",uf:"SP"},{name:"São Bernardo do Campo",uf:"SP"},
  {name:"Santo André",uf:"SP"},{name:"Osasco",uf:"SP"},{name:"Ribeirão Preto",uf:"SP"},
  {name:"Sorocaba",uf:"SP"},{name:"Mauá",uf:"SP"},{name:"São José dos Campos",uf:"SP"},
  {name:"Mogi das Cruzes",uf:"SP"},{name:"Santos",uf:"SP"},{name:"Diadema",uf:"SP"},
  {name:"Carapicuíba",uf:"SP"},{name:"Jundiaí",uf:"SP"},{name:"Piracicaba",uf:"SP"},
  {name:"Bauru",uf:"SP"},{name:"Franca",uf:"SP"},{name:"Limeira",uf:"SP"},
  {name:"Taubaté",uf:"SP"},{name:"Caçapava",uf:"SP"},{name:"Praia Grande",uf:"SP"},
  {name:"São Vicente",uf:"SP"},{name:"Suzano",uf:"SP"},{name:"Itaquaquecetuba",uf:"SP"},
  {name:"Barueri",uf:"SP"},{name:"Taboão da Serra",uf:"SP"},{name:"São Carlos",uf:"SP"},
  {name:"Americana",uf:"SP"},{name:"Araraquara",uf:"SP"},{name:"Marília",uf:"SP"},
  {name:"Presidente Prudente",uf:"SP"},{name:"São José do Rio Preto",uf:"SP"},
  {name:"Jaboticabal",uf:"SP"},{name:"Indaiatuba",uf:"SP"},{name:"Cotia",uf:"SP"},
  {name:"Embu das Artes",uf:"SP"},{name:"Registro",uf:"SP"},{name:"Caraguatatuba",uf:"SP"},
  {name:"Ubatuba",uf:"SP"},{name:"Ilhabela",uf:"SP"},{name:"Campos do Jordão",uf:"SP"},
  {name:"Atibaia",uf:"SP"},{name:"Bragança Paulista",uf:"SP"},{name:"Jaú",uf:"SP"},
  {name:"Araçatuba",uf:"SP"},{name:"Birigui",uf:"SP"},{name:"Votuporanga",uf:"SP"},
  {name:"Catanduva",uf:"SP"},{name:"São Roque",uf:"SP"},{name:"Botucatu",uf:"SP"},
  // RJ - maiores
  {name:"São Gonçalo",uf:"RJ"},{name:"Duque de Caxias",uf:"RJ"},{name:"Nova Iguaçu",uf:"RJ"},
  {name:"Niterói",uf:"RJ"},{name:"Belford Roxo",uf:"RJ"},{name:"São João de Meriti",uf:"RJ"},
  {name:"Campos dos Goytacazes",uf:"RJ"},{name:"Petrópolis",uf:"RJ"},{name:"Volta Redonda",uf:"RJ"},
  {name:"Magé",uf:"RJ"},{name:"Itaboraí",uf:"RJ"},{name:"Mesquita",uf:"RJ"},
  {name:"Nova Friburgo",uf:"RJ"},{name:"Maricá",uf:"RJ"},{name:"Macaé",uf:"RJ"},
  {name:"Angra dos Reis",uf:"RJ"},{name:"Resende",uf:"RJ"},{name:"Cabo Frio",uf:"RJ"},
  {name:"Armação dos Búzios",uf:"RJ"},{name:"Arraial do Cabo",uf:"RJ"},
  {name:"Paraty",uf:"RJ"},{name:"Teresópolis",uf:"RJ"},{name:"Queimados",uf:"RJ"},
  // MG - maiores + históricas
  {name:"Uberlândia",uf:"MG"},{name:"Contagem",uf:"MG"},{name:"Juiz de Fora",uf:"MG"},
  {name:"Betim",uf:"MG"},{name:"Montes Claros",uf:"MG"},{name:"Ribeirão das Neves",uf:"MG"},
  {name:"Uberaba",uf:"MG"},{name:"Governador Valadares",uf:"MG"},{name:"Ipatinga",uf:"MG"},
  {name:"Santa Luzia",uf:"MG"},{name:"Sete Lagoas",uf:"MG"},{name:"Divinópolis",uf:"MG"},
  {name:"Sabará",uf:"MG"},{name:"Poços de Caldas",uf:"MG"},{name:"Patos de Minas",uf:"MG"},
  {name:"Pouso Alegre",uf:"MG"},{name:"Teófilo Otoni",uf:"MG"},{name:"Barbacena",uf:"MG"},
  {name:"Alfenas",uf:"MG"},{name:"Varginha",uf:"MG"},{name:"Lavras",uf:"MG"},
  {name:"Itajubá",uf:"MG"},{name:"Conselheiro Lafaiete",uf:"MG"},{name:"Ouro Preto",uf:"MG"},
  {name:"Mariana",uf:"MG"},{name:"Diamantina",uf:"MG"},{name:"Manhuaçu",uf:"MG"},
  {name:"Tiradentes",uf:"MG"},{name:"São João del-Rei",uf:"MG"},{name:"Congonhas",uf:"MG"},
  {name:"Serro",uf:"MG"},{name:"Catas Altas",uf:"MG"},{name:"Conceição do Mato Dentro",uf:"MG"},
  // RS - maiores + turísticas
  {name:"Caxias do Sul",uf:"RS"},{name:"Canoas",uf:"RS"},{name:"Pelotas",uf:"RS"},
  {name:"Santa Maria",uf:"RS"},{name:"Gravataí",uf:"RS"},{name:"Viamão",uf:"RS"},
  {name:"Novo Hamburgo",uf:"RS"},{name:"São Leopoldo",uf:"RS"},{name:"Passo Fundo",uf:"RS"},
  {name:"Rio Grande",uf:"RS"},{name:"Alvorada",uf:"RS"},{name:"Cachoeirinha",uf:"RS"},
  {name:"Sapucaia do Sul",uf:"RS"},{name:"Uruguaiana",uf:"RS"},{name:"Bagé",uf:"RS"},
  {name:"Bento Gonçalves",uf:"RS"},{name:"Erechim",uf:"RS"},{name:"Lajeado",uf:"RS"},
  {name:"Farroupilha",uf:"RS"},{name:"Gramado",uf:"RS"},{name:"Canela",uf:"RS"},
  {name:"Torres",uf:"RS"},{name:"Tramandaí",uf:"RS"},{name:"Capão da Canoa",uf:"RS"},
  {name:"Xangri-lá",uf:"RS"},{name:"Imbé",uf:"RS"},{name:"Arroio do Sal",uf:"RS"},
  {name:"São Francisco de Paula",uf:"RS"},{name:"Nova Petrópolis",uf:"RS"},
  // PR - maiores
  {name:"Londrina",uf:"PR"},{name:"Maringá",uf:"PR"},{name:"Ponta Grossa",uf:"PR"},
  {name:"Cascavel",uf:"PR"},{name:"São José dos Pinhais",uf:"PR"},{name:"Foz do Iguaçu",uf:"PR"},
  {name:"Colombo",uf:"PR"},{name:"Guarapuava",uf:"PR"},{name:"Paranaguá",uf:"PR"},
  {name:"Araucária",uf:"PR"},{name:"Toledo",uf:"PR"},{name:"Apucarana",uf:"PR"},
  {name:"Pinhais",uf:"PR"},{name:"Campo Largo",uf:"PR"},{name:"Almirante Tamandaré",uf:"PR"},
  {name:"Umuarama",uf:"PR"},{name:"Marechal Cândido Rondon",uf:"PR"},{name:"Sarandi",uf:"PR"},
  {name:"Pato Branco",uf:"PR"},{name:"Francisco Beltrão",uf:"PR"},
  // SC - maiores + turísticas
  {name:"Joinville",uf:"SC"},{name:"Blumenau",uf:"SC"},{name:"São José",uf:"SC"},
  {name:"Chapecó",uf:"SC"},{name:"Itajaí",uf:"SC"},{name:"Criciúma",uf:"SC"},
  {name:"Jaraguá do Sul",uf:"SC"},{name:"Palhoça",uf:"SC"},{name:"Balneário Camboriú",uf:"SC"},
  {name:"Biguaçu",uf:"SC"},{name:"Lages",uf:"SC"},{name:"Camboriú",uf:"SC"},
  {name:"Brusque",uf:"SC"},{name:"Tubarão",uf:"SC"},{name:"Caçador",uf:"SC"},
  {name:"Concórdia",uf:"SC"},{name:"São Bento do Sul",uf:"SC"},{name:"Araranguá",uf:"SC"},
  {name:"Navegantes",uf:"SC"},{name:"Penha",uf:"SC"},
  {name:"Bombinhas",uf:"SC"},{name:"Garopaba",uf:"SC"},{name:"Imbituba",uf:"SC"},
  {name:"Laguna",uf:"SC"},{name:"Governador Celso Ramos",uf:"SC"},{name:"Porto Belo",uf:"SC"},
  {name:"Itapema",uf:"SC"},{name:"Piçarras",uf:"SC"},
  // BA - maiores + turísticas
  {name:"Feira de Santana",uf:"BA"},{name:"Vitória da Conquista",uf:"BA"},{name:"Camaçari",uf:"BA"},
  {name:"Itabuna",uf:"BA"},{name:"Juazeiro",uf:"BA"},{name:"Lauro de Freitas",uf:"BA"},
  {name:"Ilhéus",uf:"BA"},{name:"Jequié",uf:"BA"},{name:"Barreiras",uf:"BA"},
  {name:"Alagoinhas",uf:"BA"},{name:"Porto Seguro",uf:"BA"},{name:"Paulo Afonso",uf:"BA"},
  {name:"Simões Filho",uf:"BA"},{name:"Teixeira de Freitas",uf:"BA"},{name:"Candeias",uf:"BA"},
  {name:"Santo Antônio de Jesus",uf:"BA"},{name:"Valença",uf:"BA"},
  {name:"Itacaré",uf:"BA"},{name:"Cairu",uf:"BA"},{name:"Maraú",uf:"BA"},
  {name:"Belmonte",uf:"BA"},{name:"Mucuri",uf:"BA"},{name:"Santa Cruz Cabrália",uf:"BA"},
  {name:"Lençóis",uf:"BA"},{name:"Cachoeira",uf:"BA"},{name:"Morro de São Paulo",uf:"BA"},
  // CE - maiores + turísticas
  {name:"Caucaia",uf:"CE"},{name:"Juazeiro do Norte",uf:"CE"},{name:"Maracanaú",uf:"CE"},
  {name:"Sobral",uf:"CE"},{name:"Crato",uf:"CE"},{name:"Itapipoca",uf:"CE"},
  {name:"Maranguape",uf:"CE"},{name:"Iguatu",uf:"CE"},{name:"Quixadá",uf:"CE"},
  {name:"Aracati",uf:"CE"},{name:"Jijoca de Jericoacoara",uf:"CE"},{name:"Beberibe",uf:"CE"},
  {name:"Trairi",uf:"CE"},{name:"Aquiraz",uf:"CE"},{name:"Paracuru",uf:"CE"},
  {name:"Fortim",uf:"CE"},{name:"Icapuí",uf:"CE"},
  // PE - maiores + turísticas
  {name:"Caruaru",uf:"PE"},{name:"Olinda",uf:"PE"},{name:"Jaboatão dos Guararapes",uf:"PE"},
  {name:"Paulista",uf:"PE"},{name:"Petrolina",uf:"PE"},
  {name:"Cabo de Santo Agostinho",uf:"PE"},{name:"Camaragibe",uf:"PE"},{name:"Garanhuns",uf:"PE"},
  {name:"Ipojuca",uf:"PE"},{name:"Fernando de Noronha",uf:"PE"},{name:"Sirinhaém",uf:"PE"},
  {name:"Tamandaré",uf:"PE"},
  // PA - maiores
  {name:"Ananindeua",uf:"PA"},{name:"Santarém",uf:"PA"},{name:"Marabá",uf:"PA"},
  {name:"Parauapebas",uf:"PA"},{name:"Castanhal",uf:"PA"},{name:"Altamira",uf:"PA"},
  // MA - maiores
  {name:"Imperatriz",uf:"MA"},{name:"Timon",uf:"MA"},{name:"Caxias",uf:"MA"},
  {name:"Codó",uf:"MA"},{name:"Açailândia",uf:"MA"},
  // GO - maiores + turísticas
  {name:"Aparecida de Goiânia",uf:"GO"},{name:"Anápolis",uf:"GO"},{name:"Rio Verde",uf:"GO"},
  {name:"Luziânia",uf:"GO"},{name:"Águas Lindas de Goiás",uf:"GO"},{name:"Valparaíso de Goiás",uf:"GO"},
  {name:"Trindade",uf:"GO"},{name:"Formosa",uf:"GO"},{name:"Catalão",uf:"GO"},
  {name:"Caldas Novas",uf:"GO"},{name:"Itumbiara",uf:"GO"},
  {name:"Pirenópolis",uf:"GO"},{name:"Alto Paraíso de Goiás",uf:"GO"},{name:"Cavalcante",uf:"GO"},
  {name:"São Jorge",uf:"GO"},
  // AM - maiores
  {name:"Parintins",uf:"AM"},{name:"Itacoatiara",uf:"AM"},{name:"Tefé",uf:"AM"},
  // ES - maiores
  {name:"Serra",uf:"ES"},{name:"Vila Velha",uf:"ES"},{name:"Cariacica",uf:"ES"},
  {name:"Cachoeiro de Itapemirim",uf:"ES"},{name:"Linhares",uf:"ES"},{name:"Colatina",uf:"ES"},
  {name:"Guarapari",uf:"ES"},{name:"São Mateus",uf:"ES"},
  // MT - maiores
  {name:"Várzea Grande",uf:"MT"},{name:"Rondonópolis",uf:"MT"},{name:"Sinop",uf:"MT"},
  {name:"Tangará da Serra",uf:"MT"},{name:"Cáceres",uf:"MT"},
  // MS - maiores
  {name:"Dourados",uf:"MS"},{name:"Três Lagoas",uf:"MS"},{name:"Corumbá",uf:"MS"},
  {name:"Grande Dourados",uf:"MS"},{name:"Ponta Porã",uf:"MS"},
  // RN - maiores + turísticas
  {name:"Mossoró",uf:"RN"},{name:"Parnamirim",uf:"RN"},{name:"Caicó",uf:"RN"},
  {name:"Açu",uf:"RN"},{name:"Macaíba",uf:"RN"},
  {name:"Tibau do Sul",uf:"RN"},{name:"Galinhos",uf:"RN"},{name:"São Miguel do Gostoso",uf:"RN"},
  {name:"Nísia Floresta",uf:"RN"},{name:"Areia Branca",uf:"RN"},
  // AL - maiores + turísticas
  {name:"Arapiraca",uf:"AL"},{name:"Palmeira dos Índios",uf:"AL"},{name:"União dos Palmares",uf:"AL"},
  {name:"Maragogi",uf:"AL"},{name:"São Miguel dos Milagres",uf:"AL"},{name:"Barra de Santo Antônio",uf:"AL"},
  {name:"Porto Calvo",uf:"AL"},{name:"Coruripe",uf:"AL"},{name:"Jequiá da Praia",uf:"AL"},
  // PI - maiores + litorâneas
  {name:"Parnaíba",uf:"PI"},{name:"Picos",uf:"PI"},{name:"Floriano",uf:"PI"},
  {name:"Luís Correia",uf:"PI"},{name:"Cajueiro da Praia",uf:"PI"},{name:"Ilha Grande",uf:"PI"},
  {name:"Buriti dos Lopes",uf:"PI"},
  // PB - maiores
  {name:"Campina Grande",uf:"PB"},{name:"Santa Rita",uf:"PB"},{name:"Patos",uf:"PB"},
  // RO - maiores
  {name:"Ji-Paraná",uf:"RO"},{name:"Ariquemes",uf:"RO"},{name:"Vilhena",uf:"RO"},
  // TO - maiores
  {name:"Araguaína",uf:"TO"},{name:"Gurupi",uf:"TO"},
  // AC - maiores
  {name:"Cruzeiro do Sul",uf:"AC"},{name:"Sena Madureira",uf:"AC"},
  // AP - maiores
  {name:"Santana",uf:"AP"},{name:"Laranjal do Jari",uf:"AP"},
  // SE - maiores
  {name:"Lagarto",uf:"SE"},{name:"Itabaiana",uf:"SE"},{name:"Nossa Senhora do Socorro",uf:"SE"},
].map(c => ({ label: `${c.name}, ${c.uf}`, name: c.name, uf: c.uf }))

// ── Cache em memória e promise de carregamento ────────────────────────────────
let _citiesCache = null
let _loadPromise = null

const _LS_KEY = 'ibge_cities_v3'
const _LS_TTL = 7 * 24 * 60 * 60 * 1000 // 7 dias

async function ibgeCities() {
  if (_citiesCache) return _citiesCache

  // 1. Tenta localStorage (evita re-fetch desnecessário)
  try {
    const raw = localStorage.getItem(_LS_KEY)
    if (raw) {
      const { ts, data } = JSON.parse(raw)
      if (Date.now() - ts < _LS_TTL && Array.isArray(data) && data.length > 100) {
        _citiesCache = data
        return _citiesCache
      }
    }
  } catch (_) {}

  // 2. Já tem uma fetch em voo
  if (_loadPromise) return _loadPromise

  // 3. Inicia fetch da API IBGE
  _loadPromise = fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
    .then(r => { if (!r.ok) throw new Error('ibge ' + r.status); return r.json() })
    .then(data => {
      _citiesCache = data.map(m => ({
        label: `${m.nome}, ${m.microrregiao.mesorregiao.UF.sigla}`,
        name:  m.nome,
        uf:    m.microrregiao.mesorregiao.UF.sigla,
      }))
      // Salva no localStorage para próximas visitas
      try {
        localStorage.setItem(_LS_KEY, JSON.stringify({ ts: Date.now(), data: _citiesCache }))
      } catch (_) {}
      return _citiesCache
    })
    .catch(() => {
      // Fallback: usa lista estática
      _citiesCache = _STATIC_CITIES
      return _citiesCache
    })

  return _loadPromise
}

// Pré-carrega em background para as sugestões saírem instantâneas
;(function () {
  const start = () => ibgeCities()
  if ('requestIdleCallback' in window) {
    requestIdleCallback(start, { timeout: 4000 })
  } else {
    setTimeout(start, 1500)
  }
})()

// ── CSS injetado uma vez ──────────────────────────────────────────────────────
;(function () {
  if (document.getElementById('cac-style')) return
  const s = document.createElement('style')
  s.id = 'cac-style'
  s.textContent = `
    /* Wrapper do campo */
    .cac-wrap {
      position: relative;
      display: block;
      width: 100%;
    }

    /* Input com ícone de busca */
    .cac-wrap .cac-icon {
      position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
      font-size: 14px; pointer-events: none; opacity: .45; line-height: 1;
    }
    .cac-wrap input { padding-left: 32px !important; }

    /* Destaque laranja quando aberto */
    .cac-wrap.cac-open input {
      border-color: var(--accent, #F97316) !important;
      box-shadow: 0 0 0 3px rgba(249,115,22,.15) !important;
      outline: none;
    }

    /* Dropdown */
    .cac-list {
      position: absolute; top: calc(100% + 5px); left: 0; right: 0;
      background: #fff; border: 1.5px solid var(--border2, rgba(27,42,74,.15));
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.06);
      overflow: hidden; z-index: 9999;
      animation: cacDrop .14s ease;
    }
    @keyframes cacDrop { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }

    /* Cabeçalho do dropdown */
    .cac-header {
      padding: 8px 13px 6px;
      font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: var(--txt3, #8A9AB8);
      border-bottom: 1px solid var(--border, rgba(27,42,74,.08));
      font-family: var(--sans, sans-serif);
    }

    /* Lista de resultados */
    .cac-results {
      list-style: none; margin: 0; padding: 4px 0;
      max-height: 228px; overflow-y: auto;
    }
    .cac-results::-webkit-scrollbar { width: 4px; }
    .cac-results::-webkit-scrollbar-thumb { background: #d0d0cc; border-radius: 99px; }

    /* Cada item */
    .cac-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 13px; cursor: pointer;
      transition: background .09s; border-left: 3px solid transparent;
      font-family: var(--sans, sans-serif);
    }
    .cac-item:hover {
      background: var(--bg3, #F5F0E6);
      border-left-color: rgba(249,115,22,.3);
    }
    .cac-item.cac-active {
      background: rgba(249,115,22,.08);
      border-left-color: var(--accent, #F97316);
    }
    .cac-item-name {
      flex: 1; min-width: 0; font-size: 13px;
      color: var(--txt, #1B2A4A); font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cac-item-uf {
      font-size: 11px; font-weight: 700;
      color: var(--accent, #F97316);
      background: rgba(249,115,22,.1); padding: 2px 7px;
      border-radius: 5px; flex-shrink: 0;
      font-family: var(--mono, monospace);
    }
    .cac-item-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--border2, rgba(27,42,74,.15)); flex-shrink: 0;
    }
    .cac-item.cac-active .cac-item-dot { background: var(--accent, #F97316); }

    /* Mensagem de loading / sem resultados */
    .cac-msg {
      padding: 12px 14px; font-size: 13px;
      color: var(--txt3, #8A9AB8); font-family: var(--sans, sans-serif);
      display: flex; align-items: center; gap: 8px;
    }
  `
  document.head.appendChild(s)
})()

// ── Helpers ───────────────────────────────────────────────────────────────────

function _cacEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function _norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── initCityAutocomplete ──────────────────────────────────────────────────────

/**
 * Transforma um <input> num seletor inteligente de cidades brasileiras.
 * Chame a função a qualquer momento — se já inicializado, ignora.
 */
function initCityAutocomplete(input) {
  if (!input || input._cacInit) return
  input._cacInit = true

  // Cria wrapper somente ao redor do <input>, não do container pai (que inclui label)
  const wrapper = document.createElement('div')
  wrapper.className = 'cac-wrap'
  input.parentElement.insertBefore(wrapper, input)
  wrapper.appendChild(input)

  // Ícone de busca
  const icon = document.createElement('span')
  icon.className = 'cac-icon'
  icon.textContent = '🔍'
  wrapper.insertBefore(icon, input)

  let dropdown  = null
  let resultUl  = null
  let activeIdx = -1
  let debounce  = null
  let _chosen   = false   // evita re-busca após seleção

  // ── Fechar ──────────────────────────────────────────────────────────────────
  function closeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; resultUl = null }
    activeIdx = -1
    wrapper.classList.remove('cac-open')
  }

  // ── Selecionar cidade ────────────────────────────────────────────────────────
  function choose(label) {
    _chosen = true
    input.value = label
    input.dispatchEvent(new Event('input', { bubbles: true }))
    closeDropdown()
  }

  // ── Renderizar lista ─────────────────────────────────────────────────────────
  function renderDropdown(matches, headerText) {
    if (dropdown) dropdown.remove()
    activeIdx = -1

    dropdown = document.createElement('div')
    dropdown.className = 'cac-list'

    const hdr = document.createElement('div')
    hdr.className = 'cac-header'
    hdr.textContent = headerText
    dropdown.appendChild(hdr)

    resultUl = document.createElement('ul')
    resultUl.className = 'cac-results'

    if (!matches.length) {
      const msg = document.createElement('div')
      msg.className = 'cac-msg'
      msg.textContent = 'Nenhuma cidade encontrada.'
      dropdown.appendChild(msg)
    } else {
      matches.forEach(city => {
        const li = document.createElement('li')
        li.className = 'cac-item'
        li.dataset.label = city.label
        li.innerHTML = `
          <span class="cac-item-dot"></span>
          <span class="cac-item-name">${_cacEsc(city.name)}</span>
          <span class="cac-item-uf">${_cacEsc(city.uf)}</span>
        `
        li.addEventListener('mousedown', e => { e.preventDefault(); choose(city.label) })
        resultUl.appendChild(li)
      })
      dropdown.appendChild(resultUl)
    }

    wrapper.appendChild(dropdown)
    wrapper.classList.add('cac-open')
  }

  // ── Busca ────────────────────────────────────────────────────────────────────
  function search(query) {
    closeDropdown()
    if (!query || query.length < 2) return

    // Enquanto a API ainda não carregou, mostra lista estática imediatamente
    const immediate = _citiesCache || _STATIC_CITIES
    const q = _norm(query)
    const runFilter = cities => {
      const sw = cities.filter(c => _norm(c.name).startsWith(q))
      const cn = cities.filter(c => !_norm(c.name).startsWith(q) && _norm(c.name).includes(q))
      return [...sw, ...cn].slice(0, 12)
    }

    const immediateMatches = runFilter(immediate)
    renderDropdown(immediateMatches, immediateMatches.length
      ? `${immediateMatches.length} cidade${immediateMatches.length > 1 ? 's' : ''} encontrada${immediateMatches.length > 1 ? 's' : ''}`
      : 'Resultado')

    // Se o cache completo ainda está carregando, atualiza quando chegar
    if (!_citiesCache) {
      ibgeCities().then(cities => {
        const cur = input.value.trim()
        if (cur.length < 2) { closeDropdown(); return }
        const matches = runFilter(cities)
        renderDropdown(matches, matches.length
          ? `${matches.length} cidade${matches.length > 1 ? 's' : ''} encontrada${matches.length > 1 ? 's' : ''}`
          : 'Resultado')
      })
    }
  }

  // ── Eventos ──────────────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    if (_chosen) { _chosen = false; return }
    clearTimeout(debounce)
    debounce = setTimeout(() => search(input.value.trim()), 130)
  })

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) search(input.value.trim())
  })

  input.addEventListener('keydown', e => {
    if (!resultUl) return
    const items = resultUl.querySelectorAll('.cac-item')
    if (!items.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIdx = Math.min(activeIdx + 1, items.length - 1)
      items.forEach((el, i) => el.classList.toggle('cac-active', i === activeIdx))
      items[activeIdx]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIdx = Math.max(activeIdx - 1, -1)
      items.forEach((el, i) => el.classList.toggle('cac-active', i === activeIdx))
      if (activeIdx >= 0) items[activeIdx]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0) {
        e.preventDefault()
        choose(items[activeIdx].dataset.label)
      }
    } else if (e.key === 'Escape') {
      closeDropdown()
    }
  })

  input.addEventListener('blur', () => setTimeout(closeDropdown, 200))
}

