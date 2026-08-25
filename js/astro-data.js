/* ============================================================
   ASTRO-DATA — static astrological reference tables
   Signs, bodies, dignities, aspects, houses, sect, lots.
   Attached to globalThis so it works in browser and Node tests.
   ============================================================ */
(function (g) {
  'use strict';

  // ---------------- ELEMENTS & MODALITIES ----------------
  const ELEMENTS = {
    Fire:  { color: '#ff7a59', soft: 'rgba(255,122,89,0.16)',  desc: 'Fire signs act on instinct and inspiration — energetic, direct, identity-driven.' },
    Earth: { color: '#7ec97e', soft: 'rgba(126,201,126,0.16)', desc: 'Earth signs build and stabilize — practical, sensory, resource-minded.' },
    Air:   { color: '#f2d06b', soft: 'rgba(242,208,107,0.16)', desc: 'Air signs connect and conceptualize — social, verbal, idea-driven.' },
    Water: { color: '#5bb8e8', soft: 'rgba(91,184,232,0.16)',  desc: 'Water signs feel and merge — emotional, intuitive, memory-rich.' },
  };

  const MODALITIES = {
    Cardinal: 'Cardinal signs initiate — they begin each season and start things.',
    Fixed:    'Fixed signs sustain — they hold the middle of each season and stabilize.',
    Mutable:  'Mutable signs adapt — they end each season and negotiate transitions.',
  };

  // ---------------- SIGNS ----------------
  // rulerTrad = Hellenistic/traditional domicile lord, rulerMod = modern ruler
  const SIGNS = [
    { name:'Aries',       glyph:'♈', element:'Fire',  modality:'Cardinal', rulerTrad:'Mars',    rulerMod:'Mars',
      keywords:['bold','pioneering','impulsive','competitive','direct'],
      blurb:'The Ram: raw initiative. Aries placements act first and reflect later — courageous, self-starting, quick to anger and quick to forgive.' },
    { name:'Taurus',      glyph:'♉', element:'Earth', modality:'Fixed',    rulerTrad:'Venus',   rulerMod:'Venus',
      keywords:['steady','sensual','patient','possessive','enduring'],
      blurb:'The Bull: embodied stability. Taurus placements value comfort, beauty, and what lasts — slow to move, hard to shake.' },
    { name:'Gemini',      glyph:'♊', element:'Air',   modality:'Mutable',  rulerTrad:'Mercury', rulerMod:'Mercury',
      keywords:['curious','verbal','versatile','restless','clever'],
      blurb:'The Twins: the mind in motion. Gemini placements collect information, make connections, and speak in pairs of possibilities.' },
    { name:'Cancer',      glyph:'♋', element:'Water', modality:'Cardinal', rulerTrad:'Moon',    rulerMod:'Moon',
      keywords:['protective','nurturing','moody','tenacious','rooted'],
      blurb:'The Crab: the shell around the soft center. Cancer placements guard what they love, remember everything, and lead through care.' },
    { name:'Leo',         glyph:'♌', element:'Fire',  modality:'Fixed',    rulerTrad:'Sun',     rulerMod:'Sun',
      keywords:['radiant','proud','generous','dramatic','loyal'],
      blurb:'The Lion: the heart on display. Leo placements need to shine and to be seen shining — warm, theatrical, fiercely loyal.' },
    { name:'Virgo',       glyph:'♍', element:'Earth', modality:'Mutable',  rulerTrad:'Mercury', rulerMod:'Mercury',
      keywords:['precise','analytical','helpful','critical','skilled'],
      blurb:'The Maiden: craft and discernment. Virgo placements refine, fix, and serve — nothing escapes their notice, including flaws.' },
    { name:'Libra',       glyph:'♎', element:'Air',   modality:'Cardinal', rulerTrad:'Venus',   rulerMod:'Venus',
      keywords:['diplomatic','aesthetic','fair','indecisive','relational'],
      blurb:'The Scales: balance through the other. Libra placements weigh, harmonize, and beautify — allergic to conflict, drawn to partnership.' },
    { name:'Scorpio',     glyph:'♏', element:'Water', modality:'Fixed',    rulerTrad:'Mars',    rulerMod:'Pluto',
      keywords:['intense','private','probing','strategic','transformative'],
      blurb:'The Scorpion: depth and control. Scorpio placements feel everything, show little, and transform through crisis.' },
    { name:'Sagittarius', glyph:'♐', element:'Fire',  modality:'Mutable',  rulerTrad:'Jupiter', rulerMod:'Jupiter',
      keywords:['adventurous','philosophical','blunt','optimistic','expansive'],
      blurb:'The Archer: aim beyond the horizon. Sagittarius placements seek meaning, freedom, and the biggest possible picture.' },
    { name:'Capricorn',   glyph:'♑', element:'Earth', modality:'Cardinal', rulerTrad:'Saturn',  rulerMod:'Saturn',
      keywords:['ambitious','disciplined','pragmatic','reserved','enduring'],
      blurb:'The Sea-Goat: the long climb. Capricorn placements build structures that outlive them — patient, strategic, allergic to wasted effort.' },
    { name:'Aquarius',    glyph:'♒', element:'Air',   modality:'Fixed',    rulerTrad:'Saturn',  rulerMod:'Uranus',
      keywords:['independent','inventive','detached','idealistic','contrary'],
      blurb:'The Water-Bearer: the view from outside. Aquarius placements think in systems and futures — loyal to ideas, wary of crowds they belong to.' },
    { name:'Pisces',      glyph:'♓', element:'Water', modality:'Mutable',  rulerTrad:'Jupiter', rulerMod:'Neptune',
      keywords:['imaginative','compassionate','porous','elusive','mystical'],
      blurb:'The Fishes: dissolution of boundaries. Pisces placements dream, empathize, and merge — at home in what cannot be measured.' },
  ];

  // ---------------- BODIES ----------------
  // classic7: the traditional Hellenistic set. sect: 'diurnal' | 'nocturnal' | 'neutral'
  const BODIES = [
    { id:'Sun',     glyph:'☉', color:'#f4c430', classic7:true,  sect:'diurnal',   type:'luminary',
      keywords:['identity','vitality','purpose','leadership'],
      helln:'The heart and the king: life-force, honor, father, rulers, the soul’s purpose.',
      modern:'Core identity, ego, creative will — what you are becoming.' },
    { id:'Moon',    glyph:'☽', color:'#dfe4ee', classic7:true,  sect:'nocturnal', type:'luminary',
      keywords:['emotion','instinct','body','habit'],
      helln:'The queen of incarnation: the body, mother, the people, daily fortune, travel.',
      modern:'Emotional nature, needs, memory, the inner child, home.' },
    { id:'Mercury', glyph:'☿', color:'#8fc3dd', classic7:true,  sect:'neutral',   type:'personal',
      keywords:['mind','speech','trade','skill'],
      helln:'The messenger: speech, writing, commerce, calculation, siblings, divination.',
      modern:'Communication style, thinking, learning, wit, connection.' },
    { id:'Venus',   glyph:'♀', color:'#6fcf97', classic7:true,  sect:'nocturnal', type:'personal',
      keywords:['love','beauty','pleasure','harmony'],
      helln:'The lesser benefic: love, marriage, art, adornment, reconciliation, delight.',
      modern:'How you love and attract, taste, values, money, pleasure.' },
    { id:'Mars',    glyph:'♂', color:'#e0584f', classic7:true,  sect:'nocturnal', type:'personal',
      keywords:['drive','conflict','courage','desire'],
      helln:'The lesser malefic: war, severance, fevers, boldness, iron, surgery.',
      modern:'Drive, anger, sexuality, how you fight and pursue.' },
    { id:'Jupiter', glyph:'♃', color:'#8f7ae5', classic7:true,  sect:'diurnal',   type:'social',
      keywords:['growth','wisdom','luck','abundance'],
      helln:'The greater benefic: fortune, children, wealth, law, honors, deliverance.',
      modern:'Expansion, faith, opportunity, philosophy, excess.' },
    { id:'Saturn',  glyph:'♄', color:'#c2a878', classic7:true,  sect:'diurnal',   type:'social',
      keywords:['structure','limits','time','mastery'],
      helln:'The greater malefic: time, old age, labor, exile, foundations, endings.',
      modern:'Discipline, fear, responsibility, the lessons that mature you.' },
    { id:'Uranus',  glyph:'♅', color:'#45c6d6', classic7:false, sect:'neutral',   type:'outer',
      keywords:['disruption','freedom','innovation','awakening'],
      helln:'(Unknown to the ancients — a modern planet.)',
      modern:'Sudden change, rebellion, genius, technology, liberation.' },
    { id:'Neptune', glyph:'♆', color:'#5f8fe8', classic7:false, sect:'neutral',   type:'outer',
      keywords:['dreams','dissolution','compassion','illusion'],
      helln:'(Unknown to the ancients — a modern planet.)',
      modern:'Imagination, spirituality, escapism, the collective dream.' },
    { id:'Pluto',   glyph:'♇', color:'#b0526b', classic7:false, sect:'neutral',   type:'outer',
      keywords:['power','death-rebirth','depth','compulsion'],
      helln:'(Unknown to the ancients — a modern planet.)',
      modern:'Transformation, power dynamics, the underworld of the psyche.' },
    { id:'Node',    glyph:'☊', color:'#c9ced9', classic7:false, sect:'neutral',   type:'point',
      keywords:['destiny','increase','eclipse-point','direction'],
      helln:'The Dragon’s Head: point of increase; where eclipses occur.',
      modern:'North Node: the direction of growth; the South Node opposite is the familiar past.' },
    { id:'Lilith',  glyph:'⚸', color:'#9d84c9', classic7:false, sect:'neutral',   type:'point',
      keywords:['wildness','taboo','refusal','shadow-feminine'],
      helln:'(A modern point — the Moon’s mean apogee.)',
      modern:'Black Moon Lilith: the untamed, what refuses to submit or please.' },
  ];

  const BODY = Object.fromEntries(BODIES.map(b => [b.id, b]));

  // ---------------- ESSENTIAL DIGNITIES ----------------
  const DOMICILE = { // sign -> traditional ruler; and body -> signs ruled
    Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon', Leo:'Sun', Virgo:'Mercury',
    Libra:'Venus', Scorpio:'Mars', Sagittarius:'Jupiter', Capricorn:'Saturn', Aquarius:'Saturn', Pisces:'Jupiter',
  };
  const EXALTATION = { // body -> {sign, degree (traditional exact degree, 1-based)}
    Sun:{sign:'Aries',degree:19}, Moon:{sign:'Taurus',degree:3}, Mercury:{sign:'Virgo',degree:15},
    Venus:{sign:'Pisces',degree:27}, Mars:{sign:'Capricorn',degree:28}, Jupiter:{sign:'Cancer',degree:15},
    Saturn:{sign:'Libra',degree:21}, Node:{sign:'Gemini',degree:3},
  };
  // Detriment = sign opposite domicile; Fall = sign opposite exaltation (derived in code).

  // Dorothean triplicity rulers: element -> [day, night, participating]
  const TRIPLICITY = {
    Fire:  ['Sun','Jupiter','Saturn'],
    Earth: ['Venus','Moon','Mars'],
    Air:   ['Saturn','Mercury','Jupiter'],
    Water: ['Venus','Mars','Moon'],
  };

  // Egyptian bounds (terms): sign -> [[endDegree, ruler], ...] in order from 0°
  const BOUNDS = {
    Aries:       [[6,'Jupiter'],[12,'Venus'],[20,'Mercury'],[25,'Mars'],[30,'Saturn']],
    Taurus:      [[8,'Venus'],[14,'Mercury'],[22,'Jupiter'],[27,'Saturn'],[30,'Mars']],
    Gemini:      [[6,'Mercury'],[12,'Jupiter'],[17,'Venus'],[24,'Mars'],[30,'Saturn']],
    Cancer:      [[7,'Mars'],[13,'Venus'],[19,'Mercury'],[26,'Jupiter'],[30,'Saturn']],
    Leo:         [[6,'Jupiter'],[11,'Venus'],[18,'Saturn'],[24,'Mercury'],[30,'Mars']],
    Virgo:       [[7,'Mercury'],[17,'Venus'],[21,'Jupiter'],[28,'Mars'],[30,'Saturn']],
    Libra:       [[6,'Saturn'],[14,'Mercury'],[21,'Jupiter'],[28,'Venus'],[30,'Mars']],
    Scorpio:     [[7,'Mars'],[11,'Venus'],[19,'Mercury'],[24,'Jupiter'],[30,'Saturn']],
    Sagittarius: [[12,'Jupiter'],[17,'Venus'],[21,'Mercury'],[26,'Saturn'],[30,'Mars']],
    Capricorn:   [[7,'Mercury'],[14,'Jupiter'],[22,'Venus'],[26,'Saturn'],[30,'Mars']],
    Aquarius:    [[7,'Mercury'],[13,'Venus'],[20,'Jupiter'],[25,'Mars'],[30,'Saturn']],
    Pisces:      [[12,'Venus'],[16,'Jupiter'],[19,'Mercury'],[28,'Mars'],[30,'Saturn']],
  };

  // Decans (faces), Chaldean order starting with Mars at 0° Aries
  const CHALDEAN = ['Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter'];

  // ---------------- ASPECTS ----------------
  // orbMajor is scaled by user orb setting; luminaries get a bonus.
  const ASPECT_TYPES = [
    { id:'conjunction',   angle:0,   glyph:'☌', color:'#e8c96a', major:true,  harmony:'neutral',
      name:'Conjunction',
      blurb:'Two bodies fused at the same degree: their agendas merge. Powerful for better or worse — the nature of the planets involved decides whether it blesses or burns.' },
    { id:'sextile',       angle:60,  glyph:'⚹', color:'#4fc9a4', major:true,  harmony:'soft',
      name:'Sextile',
      blurb:'A friendly 60° link between compatible elements. Opportunity that must be acted on — a door left ajar rather than thrown open.' },
    { id:'square',        angle:90,  glyph:'□', color:'#e0714e', major:true,  harmony:'hard',
      name:'Square',
      blurb:'A 90° clash between signs that share modality but not element. Friction, urgency, productive tension — the aspect that forces action and builds strength.' },
    { id:'trine',         angle:120, glyph:'△', color:'#4f9ce0', major:true,  harmony:'soft',
      name:'Trine',
      blurb:'A 120° flow between signs of the same element. Ease, talent, natural agreement — gifts so effortless they can be taken for granted.' },
    { id:'opposition',    angle:180, glyph:'☍', color:'#e05555', major:true,  harmony:'hard',
      name:'Opposition',
      blurb:'Two bodies facing off across the wheel. Polarity, projection, seesawing extremes — and the possibility of balance once both ends are owned.' },
    { id:'semisextile',   angle:30,  glyph:'⚺', color:'#8b93a7', major:false, harmony:'minor',
      name:'Semi-sextile',
      blurb:'A 30° link between neighboring signs that share nothing. Mild friction of adjacency — growth through small adjustments.' },
    { id:'semisquare',    angle:45,  glyph:'∠', color:'#a78b8b', major:false, harmony:'minor',
      name:'Semi-square',
      blurb:'Half a square: low-grade irritation that accumulates. Minor but persistent internal friction.' },
    { id:'quintile',      angle:72,  glyph:'Q', color:'#b8a04f', major:false, harmony:'minor',
      name:'Quintile',
      blurb:'A fifth of the circle: associated with creative pattern-making, talent, and the signature style of a person’s gifts.' },
    { id:'sesquiquadrate',angle:135, glyph:'⚼', color:'#a78b8b', major:false, harmony:'minor',
      name:'Sesquiquadrate',
      blurb:'A square and a half: crisis of adjustment, agitation that erupts after being ignored.' },
    { id:'quincunx',      angle:150, glyph:'⚻', color:'#b08fd8', major:false, harmony:'minor',
      name:'Quincunx (Inconjunct)',
      blurb:'150°: signs with no shared element, modality, or polarity. A blind spot demanding constant recalibration — in Hellenistic terms, aversion.' },
  ];
  const ASPECT = Object.fromEntries(ASPECT_TYPES.map(a => [a.id, a]));

  // ---------------- HOUSES ----------------
  const HOUSES = [
    { n:1,  helln:'Helm (Horoskopos)',      topics:'Self, body, appearance, vitality, the life itself',    angular:true },
    { n:2,  helln:'Gate of Hades',          topics:'Money, possessions, livelihood, resources',            angular:false },
    { n:3,  helln:'Goddess',                topics:'Siblings, short travel, communication, daily rituals', angular:false },
    { n:4,  helln:'Subterraneous',          topics:'Home, family, parents, land, endings, roots',          angular:true },
    { n:5,  helln:'Good Fortune',           topics:'Children, pleasure, creativity, romance, play',        angular:false },
    { n:6,  helln:'Bad Fortune',            topics:'Illness, work, service, routines, animals',            angular:false },
    { n:7,  helln:'Setting (Descendant)',   topics:'Marriage, partners, open rivals, the other',           angular:true },
    { n:8,  helln:'Idle (Death)',           topics:'Death, shared resources, debts, inheritance, fear',    angular:false },
    { n:9,  helln:'God',                    topics:'Travel, philosophy, religion, higher learning, divination', angular:false },
    { n:10, helln:'Midheaven (Praxis)',     topics:'Career, reputation, public life, authority, action',   angular:true },
    { n:11, helln:'Good Spirit',            topics:'Friends, allies, hopes, patronage, gifts',             angular:false },
    { n:12, helln:'Bad Spirit',             topics:'Isolation, hidden enemies, undoing, retreat, the unconscious', angular:false },
  ];

  // ---------------- LOTS (Hellenistic) ----------------
  const LOTS = [
    { id:'Fortune', glyph:'⊗', color:'#e8c96a', name:'Lot of Fortune',
      blurb:'The Moon’s lot: the body, health, livelihood, circumstantial luck — what happens to you.' },
    { id:'Spirit',  glyph:'⊙', color:'#c9a2e0', name:'Lot of Spirit',
      blurb:'The Sun’s lot: action, career, intention, what you do deliberately with your fate.' },
  ];

  // ---------------- CHART POINTS (angles) ----------------
  const ANGLES = {
    Asc: { glyph:'Asc', name:'Ascendant',  color:'#eae2c8', blurb:'The rising degree: the helm of the chart. Body, appearance, temperament — the lens the whole life is steered through.' },
    MC:  { glyph:'MC',  name:'Midheaven',  color:'#eae2c8', blurb:'The culminating degree: career, reputation, what you are known for doing in the world.' },
    Dsc: { glyph:'Dsc', name:'Descendant', color:'#9aa1b3', blurb:'The setting degree: partners, the other, what you meet through relationship.' },
    IC:  { glyph:'IC',  name:'Imum Coeli', color:'#9aa1b3', blurb:'The anti-culminating degree: home, roots, private foundations of the life.' },
  };

  const SECT_INFO = {
    day:   'A day chart (Sun above the horizon). The Sun leads; Jupiter is the friendly benefic, Saturn the more constructive malefic, while Mars runs hotter.',
    night: 'A night chart (Sun below the horizon). The Moon leads; Venus is the friendly benefic, Mars the more constructive malefic, while Saturn bites colder.',
  };

  g.AstroData = { ELEMENTS, MODALITIES, SIGNS, BODIES, BODY, DOMICILE, EXALTATION,
                  TRIPLICITY, BOUNDS, CHALDEAN, ASPECT_TYPES, ASPECT, HOUSES, LOTS, ANGLES, SECT_INFO };
})(typeof window !== 'undefined' ? window : globalThis);
