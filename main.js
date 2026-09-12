/* LifeTracker v0.2 · plain JS · офлайн */
const { Plugin, Modal, Notice, debounce } = require('obsidian');

/* ---------- даты ---------- */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/* ---------- словари метрик ---------- */
const STATS = [['intelligence','ИНТ'],['strength','СИЛ'],['endurance','ВЫН'],['charisma','ХАР'],['health','ЗД'],['energy','ЭН']];
const STATES = [['friction','Трение'],['focus','Фокус'],['attention','Внимание'],['thinkingSpeed','Скорость'],['energyState','Энергия'],['mood','Настроение']];
const MEALS = [['breakfast','З'],['lunch','О'],['dinner','У'],['snack','П']];
const zeroStats = () => Object.fromEntries(STATS.map(([k]) => [k, 0]));
const fmtStats = e => STATS.filter(([k]) => (e || {})[k]).map(([k, l]) => `${l}${e[k] > 0 ? '+' : ''}${e[k]}`).join(' ') || '—';
const fmtH = h => (Math.round(h * 100) / 100) + ' ч';

/* ---------- уровни навыков (0 → 10000 ч) ---------- */
function skillLevel(h) {
  if (h < 10)    return { name: 'Новичок',      from: 0,     to: 10 };
  if (h < 100)   return { name: 'Начинающий',   from: 10,    to: 100 };
  if (h < 500)   return { name: 'Практик',      from: 100,   to: 500 };
  if (h < 1000)  return { name: 'Опытный',      from: 500,   to: 1000 };
  if (h < 2500)  return { name: 'Профессионал', from: 1000,  to: 2500 };
  if (h < 5000)  return { name: 'Эксперт',      from: 2500,  to: 5000 };
  if (h < 10000) return { name: 'Мастер',       from: 5000,  to: 10000 };
  return                 { name: 'Легенда',      from: 10000, to: 10000 };
}
function skillProgress(h) {
  const lv = skillLevel(h);
  if (lv.to === lv.from) return 100;
  return Math.min(100, Math.round(((h - lv.from) / (lv.to - lv.from)) * 100));
}

/* ---------- Уровни игрока (50 уровней, самурайская тематика) ---------- */
const PLAYER_LEVELS = [
  { level: 0,  name: 'Неофит' },
  { level: 1,  name: 'Искатель' },
  { level: 2,  name: 'Ученик' },
  { level: 3,  name: 'Подмастерье' },
  { level: 4,  name: 'Кэнси' },           // Ученик самурая
  { level: 5,  name: 'Адепт' },
  { level: 6,  name: 'Сталкер' },
  { level: 7,  name: 'Следопыт' },
  { level: 8,  name: 'Охотник' },
  { level: 9,  name: 'Мечник' },
  { level: 10, name: 'Воин' },
  { level: 11, name: 'Боец' },
  { level: 12, name: 'Самурай' },         // Воин благородного сословия
  { level: 13, name: 'Специалист' },
  { level: 14, name: 'Эксперт' },
  { level: 15, name: 'Профи' },
  { level: 16, name: 'Мастер' },
  { level: 17, name: 'Виртуоз' },
  { level: 18, name: 'Ветеран' },
  { level: 19, name: 'Страж' },
  { level: 20, name: 'Защитник' },
  { level: 21, name: 'Герой' },
  { level: 22, name: 'Чемпион' },
  { level: 23, name: 'Витязь' },
  { level: 24, name: 'Паладин' },
  { level: 25, name: 'Рыцарь' },
  { level: 26, name: 'Командор' },
  { level: 27, name: 'Генерал' },
  { level: 28, name: 'Тактик' },
  { level: 29, name: 'Стратег' },
  { level: 30, name: 'Лидер' },
  { level: 31, name: 'Наставник' },
  { level: 32, name: 'Учитель' },
  { level: 33, name: 'Гуру' },
  { level: 34, name: 'Легенда' },
  { level: 35, name: 'Архитектор' },
  { level: 36, name: 'Творец' },
  { level: 37, name: 'Зодчий' },
  { level: 38, name: 'Мудрец' },
  { level: 39, name: 'Философ' },
  { level: 40, name: 'Дзен-мастер' },     // Мастер дзен-буддизма
  { level: 41, name: 'Оракул' },
  { level: 42, name: 'Провидец' },
  { level: 43, name: 'Ясновидец' },
  { level: 44, name: 'Маг' },
  { level: 45, name: 'Чародей' },
  { level: 46, name: 'Волшебник' },
  { level: 47, name: 'Вершитель' },
  { level: 48, name: 'Повелитель' },
  { level: 49, name: 'Суверен' },
  { level: 50, name: 'Император' }        // Высший титул
];

/* ---------- Титулы характеристик (50 уровней для каждой характеристики) ---------- */
// ИНТ (Интеллект) — путь мудреца и ученого
const INT_TITLES = [
  'Наблюдатель', 'Любопытный', 'Читающий', 'Изучающий', 'Познающий',
  'Мыслитель', 'Аналитик', 'Исследователь', 'Учёный', 'Философ',
  'Логик', 'Стратег', 'Тактик', 'Расчётливый', 'Мудрый',
  'Проницательный', 'Глубокий', 'Озарённый', 'Вдохновлённый', 'Гениальный',
  'Визионер', 'Провидец', 'Мудрец', 'Наставник', 'Учитель',
  'Гуру', 'Архитектор знаний', 'Хранитель мудрости', 'Вершитель идей', 'Творец концепций',
  'Демиург мысли', 'Оракул', 'Ясновидец разума', 'Маг интеллекта', 'Чародей логики',
  'Волшебник познания', 'Повелитель истин', 'Суверен мысли', 'Монарх разума', 'Владыка мудрости',
  'Император интеллекта', 'Абсолют понимания', 'Божество знания', 'Первоисточник', 'Альфа разум',
  'Омега мысль', 'Сингулярность', 'Вселенский ум', 'Космическое сознание', 'Бесконечный разум', 'Абсолютная мудрость'
];

// СИЛ (Сила) — путь воина и бойца
const STR_TITLES = [
  'Слабый', 'Хрупкий', 'Тонкий', 'Неокрепший', 'Начинающий',
  'Крепнущий', 'Сильный', 'Мощный', 'Крепкий', 'Железный',
  'Стальной', 'Титановый', 'Алмазный', 'Несокрушимый', 'Громоподобный',
  'Сокрушитель', 'Разрушитель', 'Сокрушающий', 'Дробящий', 'Молот',
  'Таран', 'Бастион', 'Цитадель', 'Крепость', 'Гора',
  'Вулкан', 'Землетрясение', 'Ураган', 'Шторм', 'Буря',
  'Левиафан', 'Кракен', 'Голиаф', 'Атлант', 'Геркулес',
  'Самсон', 'Богатырь', 'Витязь', 'Паладин', 'Рыцарь силы',
  'Генерал битвы', 'Владыка мощи', 'Суверен силы', 'Монарх мышц', 'Император мощи',
  'Абсолют силы', 'Божество войны', 'Первоисточник ярости', 'Альфа хищник', 'Омега разрушения',
  'Сингулярность мощи', 'Вселенская сила', 'Космическая энергия', 'Бесконечная мощь', 'Абсолютное превосходство'
];

// ВЫН (Выносливость) — путь атлета и сталкера
const END_TITLES = [
  'Истощённый', 'Утомлённый', 'Слабый', 'Неустойчивый', 'Начинающий',
  'Терпящий', 'Выдерживающий', 'Стоический', 'Упорный', 'Настойчивый',
  'Твёрдый', 'Крепкий', 'Жилы стальные', 'Непробиваемый', 'Бессмертный',
  'Феникс', 'Возрождающийся', 'Неутомимый', 'Неостановимый', 'Вечный двигатель',
  'Марафонец', 'Ультрамарафонец', 'Железный человек', 'Титан выносливости', 'Атлант持久',
  'Сpartan', 'Легионер', 'Centurion', 'Gladiator', 'Champion',
  'Legend', 'Myth', 'Eternal', 'Immortal', 'Divine',
  'Celestial', 'Cosmic', 'Infinite', 'Absolute', 'Supreme',
  'Transcendent', 'Omnipotent', 'Omnipresent', 'Omniscient', 'Alpha Endurance',
  'Omega Persistence', 'Singularity Stamina', 'Universal Vigor', 'Quantum Resilience', 'Absolute Immortality'
];

// ХАР (Харизма) — путь лидера и дипломата
const CHA_TITLES = [
  'Незаметный', 'Тихий', 'Скромный', 'Застенчивый', 'Нерешительный',
  'Общительный', 'Дружелюбный', 'Привлекательный', 'Очаровательный', 'Харизматичный',
  'Влиятельный', 'Авторитетный', 'Убеждающий', 'Вдохновляющий', 'Лидер',
  'Оратор', 'Дипломат', 'Переговорщик', 'Посол', 'Представитель',
  'Магнетический', 'Гипнотический', 'Неотразимый', 'Блистательный', 'Сияющий',
  'Звезда', 'Икона', 'Символ', 'Легенда', 'Идол',
  'Кумир', 'Божество', 'Пророк', 'Мессия', 'Спаситель',
  'Владыка сердец', 'Суверен душ', 'Монарх влияния', 'Император харизмы', 'Абсолют обаяния',
  'Божество красоты', 'Первоисточник вдохновения', 'Альфа лидер', 'Омега влияние', 'Сингулярность притяжения',
  'Вселенская любовь', 'Космическая гармония', 'Бесконечное очарование', 'Абсолютная харизма', 'Всемогущество влияния'
];

// ЗД (Здоровье) — путь целителя и долгожителя
const HLT_TITLES = [
  'Болезненный', 'Слабый', 'Хрупкий', 'Уязвимый', 'Нежный',
  'Выздоравливающий', 'Крепнущий', 'Здоровый', 'Крепкий', 'Сильный',
  'Бодрый', 'Энергичный', 'Жизнестойкий', 'Иммунный', 'Невосприимчивый',
  'Целитель', 'Врачеватель', 'Лекарь', 'Доктор', 'Медик',
  'Санитар', 'Фельдшер', 'Хирург', 'Терапевт', 'Диагност',
  'Биохакер', 'Нутрициолог', 'Диетолог', 'Фитнес-гуру', 'Йог',
  'Дзен-мастер тела', 'Целитель души', 'Хранитель здоровья', 'Вершитель жизни', 'Творец долголетия',
  'Архитектор бессмертия', 'Оракул здоровья', 'Провидец жизни', 'Маг исцеления', 'Чародей восстановления',
  'Волшебник регенерации', 'Повелитель жизненной силы', 'Суверен здоровья', 'Монарх долголетия', 'Император бессмертия',
  'Абсолют жизнестойкости', 'Божество исцеления', 'Первоисточник жизни', 'Альфа здоровье', 'Омега восстановление',
  'Сингулярность регенерации', 'Вселенская жизненная сила', 'Космическая энергия здоровья', 'Бесконечное долголетие', 'Абсолютное бессмертие'
];

// ЭН (Энергия) — источник силы и мотивации
const ENR_TITLES = [
  'Истощённый', 'Пустой', 'Слабый', 'Вялый', 'Апатичный',
  'Пробуждающийся', 'Бодрящийся', 'Энергичный', 'Активный', 'Динамичный',
  'Мотивированный', 'Вдохновлённый', 'Страстный', 'Огненный', 'Пламенный',
  'Искрящийся', 'Светящийся', 'Сияющий', 'Блестящий', 'Ослепительный',
  'Молниеносный', 'Стремительный', 'Быстрый', 'Скоростной', 'Реактивный',
  'Турбо', 'Гипер', 'Ультра', 'Мега', 'Макси',
  'Экстремальный', 'Феноменальный', 'Невероятный', 'Фантастический', 'Космический',
  'Квантовый', 'Ядерный', 'Термоядерный', 'Звёздный', 'Галактический',
  'Вселенский', 'Бесконечный', 'Абсолютный', 'Божественный', 'Священный',
  'Первоисточник энергии', 'Альфа импульс', 'Омега мощность', 'Сингулярность силы', 'Квантовый скачок',
  'Вселенский взрыв', 'Космический поток', 'Бесконечный потенциал', 'Абсолютная энергия', 'Всемогущество мотивации'
];

const STAT_TITLES = {
  intelligence: INT_TITLES,
  strength: STR_TITLES,
  endurance: END_TITLES,
  charisma: CHA_TITLES,
  health: HLT_TITLES,
  energy: ENR_TITLES
};

/* ---------- Награды и типы ---------- */
const REWARD_TYPES = {
  ACCESSORY: 'accessory', // Реальный аксессуар (часы, кольцо, браслет)
  DECOR: 'decor',         // Декор для дома (статуэтка, картина, грамота)
  TITLE: 'title',         // Титул/Эпитет
  ACCESS: 'access'        // Доступ к испытаниям
};

/* ---------- Конфигурация прогрессии по умолчанию ---------- */
const DEFAULT_LEVELING_CONFIG = {
  baseXP: 150,          // Базовый опыт для уровня 1 (тяжелее)
  growthFactor: 2.0,    // Коэффициент роста (2.0 = очень тяжелая прогрессия)
  formula: 'quadratic', // 'linear', 'quadratic', 'exponential'
  gloryPerLevel: 50     // Очки славы за каждый уровень
};

/* ---------- Структура наград по умолчанию ---------- */
const DEFAULT_REWARDS_DATA = {
  currency: 0,          // Очки славы (валюта за уровни)
  inventory: [],        // Разблокированные награды [{id, type, name, unlockedAt}]
  slots: {
    accessory: null,    // Текущий носимый аксессуар {id, name}
    decor: null         // Текущий декор {id, name}
  },
  titles: [],           // Разблокированные титулы характеристик [{stat, level, title}]
  accesses: [],         // Разблокированные доступы к испытаниям [{id, name}]
  lastProcessedLevel: 0 // Последний обработанный уровень для начисления наград
};

/* ---------- XP за действия ---------- */
const XP_REWARDS = {
  habit: 10,            // За выполнение привычки
  task: 20,             // За выполнение задачи
  idea: 20,             // За реализацию идеи
  goalBase: 40          // За цель (умножается на дни)
};

/* ---------- Расчет требуемого опыта для уровня (настраиваемая прогрессия) ---------- */
function xpRequiredForLevel(level, config = {}) {
  const cfg = { ...DEFAULT_LEVELING_CONFIG, ...config };
  const baseXP = cfg.baseXP;
  const growthFactor = cfg.growthFactor;
  const formula = cfg.formula;
  
  if (level <= 0) return 0;
  
  switch (formula) {
    case 'linear':
      return Math.floor(baseXP * level);
    case 'exponential':
      return Math.floor(baseXP * Math.pow(growthFactor, level - 1));
    case 'quadratic':
    default:
      // Квадратичная прогрессия с коэффициентом: baseXP * level^growthFactor
      return Math.floor(baseXP * Math.pow(level, growthFactor));
  }
}

/* ---------- Получить текущий уровень по опыту ---------- */
function getPlayerLevel(totalXP, config = {}) {
  const cfg = { ...DEFAULT_LEVELING_CONFIG, ...config };
  for (let i = PLAYER_LEVELS.length - 1; i >= 0; i--) {
    const required = xpRequiredForLevel(i, cfg);
    if (totalXP >= required) {
      const nextRequired = xpRequiredForLevel(i + 1, cfg);
      return { 
        level: i, 
        name: PLAYER_LEVELS[i].name, 
        required: required, 
        next: nextRequired || totalXP,
        progress: totalXP - required,
        remaining: nextRequired - totalXP
      };
    }
  }
  return { 
    level: 0, 
    name: PLAYER_LEVELS[0].name, 
    required: 0, 
    next: xpRequiredForLevel(1, cfg),
    progress: totalXP,
    remaining: xpRequiredForLevel(1, cfg) - totalXP
  };
}

/* ---------- Получить титул характеристики ---------- */
function getStatTitle(statKey, statValue) {
  const titles = STAT_TITLES[statKey];
  if (!titles || titles.length === 0) return '';
  // statValue от 0 до ~100+, индекс от 0 до 49
  const index = Math.min(Math.floor(statValue), titles.length - 1);
  return titles[Math.max(0, index)];
}

/* ---------- Расчет общего XP игрока ---------- */
function calculateTotalXP(store, journalData) {
  let totalXP = 0;
  
  // XP за привычки
  Object.values(journalData).forEach(day => {
    if (day.habitLogs) {
      day.habitLogs.forEach(log => {
        if (log.done) {
          totalXP += XP_REWARDS.habit;
        }
      });
    }
    
    // XP за задачи и идеи
    if (day.completedWorkItems) {
      day.completedWorkItems.forEach(item => {
        if (item.kind === 'task') {
          totalXP += XP_REWARDS.task;
        } else if (item.kind === 'idea') {
          totalXP += XP_REWARDS.idea;
        }
      });
    }
  });
  
  // XP за цели
  if (store.ref && store.ref.goals) {
    store.ref.goals.forEach(goal => {
      if (goal.status === 'completed' && goal.completedAt) {
        const startDate = parseISO(goal.start);
        const endDate = parseISO(goal.completedAt);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        totalXP += XP_REWARDS.goalBase * Math.max(1, days);
      }
    });
  }
  
  return totalXP;
}

/* ---------- стартовые данные ---------- */
function seedReference() {
  return {
    schemaVersion: 2,
    habits: [
      { id: 'h1', name: 'Бег утром', baseEffects: { endurance: 2, health: 1, energy: -1 } },
      { id: 'h2', name: 'Чтение',    baseEffects: { intelligence: 2 } }
    ],
    activities: [{ id: 'a1', name: 'Пробежка', kcalPerUnit: 60 }],
    substances: [{ id: 's1', name: 'Омега-3' }],
    skills: [{ id: 'sk1', name: 'Бег', habitRefs: [{ habitId: 'h1', weight: 1 }] }],
    synergyRules: [{ id: 'r1', source: { type: 'habit', id: 'h1' }, target: { type: 'substance', id: 's1' }, bonus: { health: 1, endurance: 1 } }],
    goals: [{ id: 'g1', name: '100 км за июнь', targetType: 'activity', targetId: 'a1', metric: 'km', targetValue: 100, start: iso(new Date()), status: 'active' }],
    finCategories: [
      { id: 'fc1', name: 'Зарплата',  type: 'income' },
      { id: 'fc2', name: 'Продукты',  type: 'expense' },
      { id: 'fc3', name: 'Транспорт', type: 'expense' }
    ],
    achievements: []
  };
}

function seedWorkItems() {
  return {
    schemaVersion: 1,
    items: [
      { id: 'wi1', kind: 'task', name: 'Сделать отчёт', description: '', effects: zeroStats(), status: 'backlog', createdAt: iso(new Date()) },
      { id: 'wi2', kind: 'idea', name: 'Приложение для трекинга сна', description: '', effects: zeroStats(), status: 'backlog', createdAt: iso(new Date()) }
    ]
  };
}

/* ---------- Store ---------- */
class Store {
  constructor(app) { 
    this.app = app; 
    this.a = app.vault.adapter; 
    this.base = 'LifeTracker'; 
    this.ref = null; 
    this.work = null; 
    this.cache = {};
    this.rewardsData = null;
  }
  async init() {
    await this.a.mkdir(this.base).catch(() => {});
    await this.a.mkdir(this.base + '/journal').catch(() => {});
    const p = this.base + '/reference.json';
    this.ref = await this.a.exists(p) ? JSON.parse(await this.a.read(p)) : seedReference();
    if (!this.ref.finCategories) this.ref.finCategories = seedReference().finCategories;
    if (!this.ref.achievements) this.ref.achievements = [];
    if (!this.ref.schemaVersion || this.ref.schemaVersion < 2) { this.ref.schemaVersion = 2; await this.saveRef(); }
    else if (!await this.a.exists(p)) await this.saveRef();
    const wp = this.base + '/workItems.json';
    this.work = await this.a.exists(wp) ? JSON.parse(await this.a.read(wp)) : seedWorkItems();
    if (!await this.a.exists(wp)) await this.saveWorkItems();
    
    // Инициализация данных наград
    const rp = this.base + '/rewards.json';
    let rawData = await this.a.exists(rp) ? JSON.parse(await this.a.read(rp)) : { ...DEFAULT_REWARDS_DATA };
    // Миграция: добавляем lastProcessedLevel если нет
    if (rawData.lastProcessedLevel === undefined) {
      rawData.lastProcessedLevel = 0;
    }
    // Миграция: слоты теперь объекты {id, name}
    if (typeof rawData.slots.accessory === 'string') {
      rawData.slots.accessory = rawData.slots.accessory ? { id: rawData.slots.accessory, name: rawData.slots.accessory } : null;
    }
    if (typeof rawData.slots.decor === 'string') {
      rawData.slots.decor = rawData.slots.decor ? { id: rawData.slots.decor, name: rawData.slots.decor } : null;
    }
    this.rewardsData = rawData;
    if (!await this.a.exists(rp)) await this.saveRewards();
  }
  dayPath(d) { return this.base + '/journal/' + d + '.json'; }
  workPath() { return this.base + '/workItems.json'; }
  rewardsPath() { return this.base + '/rewards.json'; }
  emptyDay(date) {
    return {
      schemaVersion: 1,
      date,
      state: Object.fromEntries(STATES.map(([k]) => [k, 5])),
      comment: '',
      habitLogs: this.ref.habits.map(h => ({ habitId: h.id, done: false, hours: 0 })),
      activityLogs: this.ref.activities.map(a => ({ activityId: a.id, amount: 0 })),
      substanceLogs: this.ref.substances.map(s => ({ substanceId: s.id, taken: false })),
      meals: MEALS.map(([slot]) => ({ slot, kcal: 0 })),
      financeLogs: []
    };
  }
  async loadDay(date) {
    if (this.cache[date]) return this.cache[date];
    const day = await this.a.exists(this.dayPath(date)) ? JSON.parse(await this.a.read(this.dayPath(date))) : this.emptyDay(date);
    for (const h of this.ref.habits) if (!day.habitLogs.find(l => l.habitId === h.id)) day.habitLogs.push({ habitId: h.id, done: false, hours: 0 });
    for (const a of this.ref.activities) if (!day.activityLogs.find(l => l.activityId === a.id)) day.activityLogs.push({ activityId: a.id, amount: 0 });
    for (const s of this.ref.substances) if (!day.substanceLogs.find(l => l.substanceId === s.id)) day.substanceLogs.push({ substanceId: s.id, taken: false });
    for (const [slot] of MEALS) if (!day.meals.find(m => m.slot === slot)) day.meals.push({ slot, kcal: 0 });
    if (!day.financeLogs) day.financeLogs = [];
    this.cache[date] = day; return day;
  }
  async saveDay(date) { if (this.cache[date]) await this.a.write(this.dayPath(date), JSON.stringify(this.cache[date], null, 2)); }
  async saveRef() { await this.a.write(this.base + '/reference.json', JSON.stringify(this.ref, null, 2)); this.cache = {}; }
  async saveWorkItems() { await this.a.write(this.workPath(), JSON.stringify(this.work, null, 2)); }
  async saveRewards() { await this.a.write(this.rewardsPath(), JSON.stringify(this.rewardsData, null, 2)); }
  async loadRewards() {
    const rp = this.rewardsPath();
    if (await this.a.exists(rp)) {
      const rawData = JSON.parse(await this.a.read(rp));
      // Миграция: добавляем lastProcessedLevel если нет
      if (rawData.lastProcessedLevel === undefined) {
        rawData.lastProcessedLevel = 0;
      }
      // Миграция: слоты теперь объекты {id, name}
      if (typeof rawData.slots.accessory === 'string') {
        rawData.slots.accessory = rawData.slots.accessory ? { id: rawData.slots.accessory, name: rawData.slots.accessory } : null;
      }
      if (typeof rawData.slots.decor === 'string') {
        rawData.slots.decor = rawData.slots.decor ? { id: rawData.slots.decor, name: rawData.slots.decor } : null;
      }
      this.rewardsData = rawData;
    }
  }
  async listDays() { try { const { files } = await this.a.list(this.base + '/journal'); return files.map(f => f.split('/').pop().replace('.json', '')).sort(); } catch (e) { return []; } }
}

/* ---------- Compute ---------- */
function epDone(day, ep) {
  if (ep.type === 'habit')     { const l = day.habitLogs.find(x => x.habitId === ep.id); return !!(l && l.done); }
  if (ep.type === 'substance') { const l = day.substanceLogs.find(x => x.substanceId === ep.id); return !!(l && l.taken); }
  if (ep.type === 'activity')  { const l = day.activityLogs.find(x => x.activityId === ep.id); return !!(l && l.amount > 0); }
  return false;
}
function computeDayStats(ref, day) {
  const stats = zeroStats(), syn = [];
  for (const h of ref.habits) { const l = day.habitLogs.find(x => x.habitId === h.id); if (l && l.done) for (const [k] of STATS) stats[k] += (h.baseEffects || {})[k] || 0; }
  for (const r of ref.synergyRules) if (epDone(day, r.source) && epDone(day, r.target)) { syn.push(r); for (const [k] of STATS) stats[k] += (r.bonus || {})[k] || 0; }
  return { stats, syn };
}
function dayKcal(ref, day) {
  const eaten = day.meals.reduce((a, m) => a + (+m.kcal || 0), 0);
  const burned = day.activityLogs.reduce((a, l) => { const act = ref.activities.find(x => x.id === l.activityId); return a + (act ? act.kcalPerUnit * (+l.amount || 0) : 0); }, 0);
  return { eaten, burned, balance: eaten - burned };
}
function dayFinance(ref, day) {
  const inc = day.financeLogs.filter(f => { const c = ref.finCategories.find(x => x.id === f.categoryId); return c && c.type === 'income'; }).reduce((a, f) => a + (+f.amount || 0), 0);
  const exp = day.financeLogs.filter(f => { const c = ref.finCategories.find(x => x.id === f.categoryId); return c && c.type === 'expense'; }).reduce((a, f) => a + (+f.amount || 0), 0);
  return { income: inc, expense: exp, balance: inc - exp };
}
function dayCompletion(ref, day) {
  const total = ref.habits.length;
  if (total === 0) return { done: 0, total: 0, pct: 0 };
  const done = day.habitLogs.filter(l => { const h = ref.habits.find(x => x.id === l.habitId); return h && l.done; }).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}
function skillHoursFor(ref, days) {
  const out = {};
  for (const sk of ref.skills) { let t = 0; for (const hr of sk.habitRefs || []) for (const d of days) { const l = d.habitLogs.find(x => x.habitId === hr.habitId); if (l && l.hours) t += l.hours * (hr.weight ?? 1); } out[sk.id] = t; }
  return out;
}
async function habitStreak(store, habitId, date) {
  let d = parseISO(date);
  const t = (await store.loadDay(iso(d))).habitLogs.find(x => x.habitId === habitId);
  if (!(t && t.done)) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 365; i++) {
    const key = iso(d);
    if (!await store.a.exists(store.dayPath(key))) break;
    const l = (await store.loadDay(key)).habitLogs.find(x => x.habitId === habitId);
    if (l && l.done) { n++; d = addDays(d, -1); } else break;
  }
  return n;
}
async function goalProgress(store, g, today) {
  const from = g.start || '0000-01-01', to = (g.end && g.end < today) ? g.end : today;
  let sum = 0;
  for (const d of (await store.listDays()).filter(x => x >= from && x <= to)) {
    const day = await store.loadDay(d);
    if (g.metric === 'hours') {
      const sk = store.ref.skills.find(s => s.id === g.targetId);
      if (sk) for (const hr of sk.habitRefs || []) { const l = day.habitLogs.find(x => x.habitId === hr.habitId); if (l && l.hours) sum += l.hours * (hr.weight ?? 1); }
    } else for (const l of day.activityLogs) if (l.activityId === g.targetId) sum += +l.amount || 0;
  }
  return sum;
}
async function weekCompletion(store, ref, today) {
  const mon = mondayOf(parseISO(today));
  let done = 0, total = 0;
  for (let i = 0; i < 7; i++) {
    const d = iso(addDays(mon, i));
    if (d > today) break;
    const day = await store.loadDay(d);
    const r = dayCompletion(ref, day);
    done += r.done; total += r.total;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ---------- Compute: Опыт игрока ---------- */
// XP за выполнение привычки (базовое значение) - синхронизировано с XP_REWARDS.habit
const XP_HABIT = XP_REWARDS.habit;
// XP за задачу/идею (в 2 раза больше привычки) - синхронизировано с XP_REWARDS.task/idea
const XP_TASK_IDEA = XP_REWARDS.task;
// XP за цель (в 2 раза больше задачи, умноженное на дни) - синхронизировано с XP_REWARDS.goalBase
const XP_GOAL_BASE = XP_REWARDS.goalBase;

// Расчет опыта за один день
function computeDayXP(ref, day, workItems = []) {
  let xp = 0;
  
  // Опыт за привычки
  for (const h of ref.habits) {
    const l = day.habitLogs.find(x => x.habitId === h.id);
    if (l && l.done) xp += XP_HABIT;
  }
  
  // Опыт за вещества (как привычки)
  for (const s of ref.substances) {
    const l = day.substanceLogs.find(x => x.substanceId === s.id);
    if (l && l.taken) xp += XP_HABIT;
  }
  
  // Опыт за активности (если выполнены)
  for (const a of ref.activities) {
    const l = day.activityLogs.find(x => x.activityId === a.id);
    if (l && l.amount > 0) xp += XP_HABIT;
  }
  
  // Опыт за задачи и идеи из workItems
  for (const item of workItems) {
    if (item.status === 'done' && item.completedDate === day.date) {
      if (item.kind === 'task' || item.kind === 'idea') {
        xp += XP_TASK_IDEA;
      }
    }
  }
  
  // Опыт за цели (проверяем завершение целей в этот день)
  for (const g of ref.goals || []) {
    if (g.status === 'completed' && g.completedDate === day.date) {
      const daysCount = g.start && g.end 
        ? Math.max(1, Math.ceil((parseISO(g.end) - parseISO(g.start)) / (1000 * 60 * 60 * 24)))
        : 1;
      xp += XP_GOAL_BASE * daysCount;
    }
  }
  
  return xp;
}

// Подсчет общего опыта за все дни
async function computeTotalXP(store) {
  let totalXP = 0;
  const days = await store.listDays();
  const workItems = store.work?.items || [];
  
  for (const date of days) {
    const day = await store.loadDay(date);
    totalXP += computeDayXP(store.ref, day, workItems);
  }
  
  return totalXP;
}

// Получить текущий уровень и прогресс игрока
async function getPlayerProgress(store) {
  const totalXP = await computeTotalXP(store);
  return { ...getPlayerLevel(totalXP), totalXP };
}

/* ---------- Проверка и начисление наград за уровни ---------- */
async function checkAndGrantLevelRewards(store) {
  const progress = await getPlayerProgress(store);
  const rewardsData = store.rewardsData;
  const cfg = DEFAULT_LEVELING_CONFIG;
  
  // Проверяем все уровни от lastProcessedLevel до текущего
  let grantedGlory = 0;
  for (let lvl = rewardsData.lastProcessedLevel + 1; lvl <= progress.level; lvl++) {
    // Начисляем очки славы за уровень
    grantedGlory += cfg.gloryPerLevel;
    
    // Создаем универсальную награду за уровень
    const rewardId = `level_${lvl}`;
    if (!rewardsData.inventory.find(r => r.id === rewardId)) {
      rewardsData.inventory.push({
        id: rewardId,
        type: REWARD_TYPES.DECOR,
        name: `Награда за уровень ${lvl}`,
        unlockedAt: iso(new Date())
      });
    }
  }
  
  // Начисляем очки славы
  if (grantedGlory > 0) {
    rewardsData.currency += grantedGlory;
    rewardsData.lastProcessedLevel = progress.level;
    await store.saveRewards();
    return { grantedGlory, newLevel: progress.level };
  }
  
  return null;
}

/* ---------- Проверка порога характеристики для задачи/идеи ---------- */
function checkStatRequirement(item, currentStats) {
  if (!item || !item.minStatRequirement) return true;
  
  const req = item.minStatRequirement;
  const statValue = currentStats[req.stat] || 0;
  
  return statValue >= req.threshold;
}

/* ---------- UI: ДЕНЬ ---------- */
class DayModal extends Modal {
  constructor(app, store, date) { super(app); this.store = store; this.date = date; }
  async onOpen() {
    const { store, date } = this, ref = store.ref, day = await store.loadDay(date);
    const el = this.contentEl; el.addClass('lt');
    el.createEl('h2', { text: `День · ${date} · ${WD[(parseISO(date).getDay() + 6) % 7]}` });
    const footer = el.createDiv({ cls: 'lt-footer' });
    const footerText = () => {
      const r = computeDayStats(ref, day), k = dayKcal(ref, day), f = dayFinance(ref, day), c = dayCompletion(ref, day);
      const xpToday = computeDayXP(ref, day, store.work?.items || []);
      return `🎯 ${c.pct}% (${c.done}/${c.total}) · ` + STATS.map(([key, lab]) => `${lab} ${r.stats[key]}`).join(' · ') +
        ` | ккал ${k.balance >= 0 ? '+' : ''}${k.balance}` +
        ` | ₽ ${f.balance >= 0 ? '+' : ''}${f.balance}` +
        (r.syn.length ? ` | синергии: ${r.syn.length} ✅` : '') +
        ` | ✨ +${xpToday} XP`;
    };
    const save = debounce(() => { store.saveDay(date); footer.setText(footerText() + ' · сохранено ✓'); }, 400);
    const refresh = () => { footer.setText(footerText()); save(); };

    el.createEl('h3', { text: 'Привычки' });
    for (const h of ref.habits) {
      const l = day.habitLogs.find(x => x.habitId === h.id);
      const row = el.createDiv({ cls: 'lt-row' });
      const cb = row.createEl('input', { type: 'checkbox' }); cb.checked = !!l.done;
      cb.addEventListener('change', () => { l.done = cb.checked; refresh(); });
      row.createEl('span', { cls: 'lt-name', text: h.name });
      row.createEl('span', { cls: 'lt-chip', text: fmtStats(h.baseEffects) });
      const st = row.createDiv({ cls: 'lt-step' });
      const hrs = st.createEl('span', { text: fmtH(l.hours || 0) });
      st.createEl('button', { text: '−' }).onclick = () => { l.hours = Math.max(0, (+l.hours || 0) - 0.25); hrs.setText(fmtH(l.hours)); refresh(); };
      st.createEl('button', { text: '+' }).onclick = () => { l.hours = (+l.hours || 0) + 0.25; hrs.setText(fmtH(l.hours)); refresh(); };
      const sk = row.createEl('span', { cls: 'lt-chip' });
      habitStreak(store, h.id, date).then(n => sk.setText(n ? `🔥${n}` : ''));
    }

    el.createEl('h3', { text: 'Вещества' });
    for (const s of ref.substances) {
      const l = day.substanceLogs.find(x => x.substanceId === s.id);
      const row = el.createDiv({ cls: 'lt-row' });
      const cb = row.createEl('input', { type: 'checkbox' }); cb.checked = !!l.taken;
      cb.addEventListener('change', () => { l.taken = cb.checked; refresh(); });
      row.createEl('span', { cls: 'lt-name', text: s.name });
    }

    el.createEl('h3', { text: 'Активности' });
    for (const a of ref.activities) {
      const l = day.activityLogs.find(x => x.activityId === a.id);
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: a.name });
      const st = row.createDiv({ cls: 'lt-step' });
      const amt = st.createEl('span', { text: String(+l.amount || 0) });
      const kc = row.createEl('span', { cls: 'lt-chip' });
      const upd = () => { amt.setText(String(l.amount)); kc.setText(`−${Math.round(a.kcalPerUnit * l.amount)} ккал`); refresh(); };
      st.createEl('button', { text: '−' }).onclick = () => { l.amount = Math.max(0, (+l.amount || 0) - 1); upd(); };
      st.createEl('button', { text: '+' }).onclick = () => { l.amount = (+l.amount || 0) + 1; upd(); };
      kc.setText(`−${Math.round(a.kcalPerUnit * (+l.amount || 0))} ккал`);
    }

    el.createEl('h3', { text: 'Еда (ккал)' });
    const mrow = el.createDiv({ cls: 'lt-row' });
    for (const [slot, lab] of MEALS) {
      const m = day.meals.find(x => x.slot === slot);
      const w = mrow.createDiv({ cls: 'lt-meal' });
      w.createEl('span', { text: lab });
      const inp = w.createEl('input', { type: 'number', attr: { inputmode: 'numeric' } });
      inp.value = String(+m.kcal || 0);
      inp.addEventListener('input', () => { m.kcal = +inp.value || 0; refresh(); });
    }

    el.createEl('h3', { text: 'Финансы (₽)' });
    const fWrap = el.createDiv();
    const renderFin = () => {
      fWrap.empty();
      for (let i = 0; i < day.financeLogs.length; i++) {
        const f = day.financeLogs[i];
        const row = fWrap.createDiv({ cls: 'lt-row' });
        const sel = row.createEl('select');
        for (const c of ref.finCategories) {
          const o = sel.createEl('option', { value: c.id, text: `${c.type === 'income' ? '↓' : '↑'} ${c.name}` });
          if (c.id === f.categoryId) o.selected = true;
        }
        sel.addEventListener('change', () => { f.categoryId = sel.value; refresh(); });
        const amt = row.createEl('input', { type: 'number', cls: 'lt-input', attr: { inputmode: 'decimal' } });
        amt.value = String(+f.amount || 0);
        amt.addEventListener('input', () => { f.amount = +amt.value || 0; refresh(); });
        row.createEl('button', { text: '✕' }).onclick = () => { day.financeLogs.splice(i, 1); renderFin(); refresh(); };
      }
      fWrap.createEl('button', { text: '+ операция', cls: 'lt-add' }).onclick = () => {
        if (ref.finCategories.length === 0) { new Notice('Сначала добавь категории в Справочниках'); return; }
        day.financeLogs.push({ categoryId: ref.finCategories[0].id, amount: 0, note: '' });
        renderFin(); refresh();
      };
      const tot = dayFinance(ref, day);
      fWrap.createDiv({ cls: 'lt-sum', text: `↓ ${tot.income} ₽  ↑ ${tot.expense} ₽  = ${tot.balance} ₽` });
    };
    renderFin();

    el.createEl('h3', { text: 'Состояние (0–10)' });
    for (const [key, lab] of STATES) {
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: lab });
      const r = row.createEl('input', { type: 'range', attr: { min: '0', max: '10', step: '1' } });
      r.value = String(day.state[key] ?? 5);
      const v = row.createEl('span', { cls: 'lt-chip', text: r.value });
      r.addEventListener('input', () => { day.state[key] = +r.value; v.setText(r.value); refresh(); });
    }

    el.createEl('h3', { text: 'Комментарий' });
    const ta = el.createEl('textarea', { cls: 'lt-comment' }); ta.value = day.comment || '';
    ta.addEventListener('input', () => { day.comment = ta.value; save(); });

    footer.setText(footerText());
    el.createEl('button', { text: 'Готово ✓', cls: 'mod-cta' }).onclick = async () => { await store.saveDay(date); this.close(); };
  }
}

/* ---------- UI: НЕДЕЛЯ ---------- */
class WeekModal extends Modal {
  constructor(app, store, date) { super(app); this.store = store; this.date = date; }
  async onOpen() {
    const { store } = this, ref = store.ref, el = this.contentEl; el.addClass('lt');
    const mon = mondayOf(parseISO(this.date)), today = iso(new Date());
    const days = [];
    for (let i = 0; i < 7; i++) { const d = iso(addDays(mon, i)); days.push({ d, future: d > today, day: d <= today ? await store.loadDay(d) : null }); }
    el.createEl('h2', { text: `Неделя · ${days[0].d} — ${days[6].d}` });
    const wc = await weekCompletion(store, ref, today);
    el.createDiv({ cls: 'lt-big' }).createEl('span', { text: `🎯 Итог недели: ${wc.pct}% (${wc.done}/${wc.total})` });

    const t = el.createEl('table', { cls: 'lt-week' }), tb = t.createEl('tbody');
    const hd = tb.createEl('tr'); hd.createEl('th', { text: '' });
    days.forEach(x => hd.createEl('th', { text: WD[(parseISO(x.d).getDay() + 6) % 7] }));
    hd.createEl('th', { text: 'Σ' });

    const cell = (x, get) => x.future ? '·' : (get(x.day) ? '✓' : '✗');
    const cnt = x => get => !x.future && get(x.day);
    for (const h of ref.habits) {
      const r = tb.createEl('tr'); r.createEl('td', { text: h.name }); let n = 0;
      days.forEach(x => { const ok = cnt(x)(d => d.habitLogs.find(l => l.habitId === h.id && l.done)); if (ok) n++; r.createEl('td', { text: cell(x, d => d.habitLogs.find(l => l.habitId === h.id && l.done)), cls: ok ? 'lt-ok' : '' }); });
      r.createEl('td', { text: `${n}/7` });
    }
    for (const s of ref.substances) {
      const r = tb.createEl('tr'); r.createEl('td', { text: s.name }); let n = 0;
      days.forEach(x => { const ok = cnt(x)(d => d.substanceLogs.find(l => l.substanceId === s.id && l.taken)); if (ok) n++; r.createEl('td', { text: cell(x, d => d.substanceLogs.find(l => l.substanceId === s.id && l.taken)), cls: ok ? 'lt-ok' : '' }); });
      r.createEl('td', { text: `${n}/7` });
    }
    const rsy = tb.createEl('tr'); rsy.createEl('td', { text: 'Синергии' }); let synSum = 0;
    days.forEach(x => { const v = x.future ? '·' : String(computeDayStats(ref, x.day).syn.length); if (!x.future) synSum += +v; rsy.createEl('td', { text: v }); });
    rsy.createEl('td', { text: String(synSum) });
    const rk = tb.createEl('tr'); rk.createEl('td', { text: 'Ккал баланс' }); let kSum = 0;
    days.forEach(x => { const v = x.future ? '·' : String(dayKcal(ref, x.day).balance); if (!x.future) kSum += +v; rk.createEl('td', { text: v }); });
    rk.createEl('td', { text: String(kSum) });
    const rf = tb.createEl('tr'); rf.createEl('td', { text: '₽ баланс' }); let fSum = 0;
    days.forEach(x => { const v = x.future ? '·' : String(dayFinance(ref, x.day).balance); if (!x.future) fSum += +v; rf.createEl('td', { text: v }); });
    rf.createEl('td', { text: String(fSum) });
    const tot = zeroStats();
    days.forEach(x => { if (!x.future) { const s = computeDayStats(ref, x.day).stats; for (const [k] of STATS) tot[k] += s[k]; } });
    const rtt = tb.createEl('tr'); rtt.createEl('td', { text: 'Статы за неделю' });
    rtt.createEl('td', { cls: 'lt-sum', attr: { colspan: '7' }, text: fmtStats(tot) }); rtt.createEl('td', { text: '' });

    el.createEl('h3', { text: 'Навыки за неделю' });
    const hours = skillHoursFor(ref, days.filter(x => !x.future).map(x => x.day));
    for (const sk of ref.skills) {
      const h = hours[sk.id] || 0;
      const lv = skillLevel(h);
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: sk.name });
      row.createEl('span', { cls: 'lt-chip', text: lv.name });
      row.createEl('span', { cls: 'lt-chip', text: fmtH(h) + ' / ' + lv.to + ' ч' });
      const bar = row.createDiv({ cls: 'lt-bar' });
      bar.createDiv({ cls: 'lt-bar-fill', attr: { style: `width:${skillProgress(h)}%` } });
    }

    el.createEl('h3', { text: 'Цели' });
    for (const g of ref.goals) {
      const p = await goalProgress(store, g, today);
      el.createDiv({ cls: 'lt-row' }).createEl('span', { text: `${g.name}: ${Math.round(p * 10) / 10} / ${g.targetValue} (${Math.min(999, Math.round(p / g.targetValue * 100))}%)` });
    }
  }
}

/* ---------- CRUD справочников ---------- */
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TITLES = { habits: 'Привычка', activities: 'Активность', substances: 'Вещество', skills: 'Навык', synergyRules: 'Синергия', goals: 'Цель', finCategories: 'Категория финансов' };

function newItem(key) {
  switch (key) {
    case 'habits': return { id: uid('h'), name: '', baseEffects: zeroStats() };
    case 'activities': return { id: uid('a'), name: '', kcalPerUnit: 0 };
    case 'substances': return { id: uid('s'), name: '' };
    case 'skills': return { id: uid('sk'), name: '', description: '', habitRefs: [] };
    case 'synergyRules': return { id: uid('r'), source: { type: 'habit', id: '' }, target: { type: 'substance', id: '' }, bonus: zeroStats() };
    case 'goals': return { id: uid('g'), name: '', targetType: 'activity', targetId: '', metric: 'km', targetValue: 0, start: iso(new Date()), end: '', status: 'active' };
    case 'finCategories': return { id: uid('fc'), name: '', type: 'expense' };
  }
}
function epName(ref, ep) {
  const col = ep.type === 'habit' ? 'habits' : ep.type === 'activity' ? 'activities' : ep.type === 'substance' ? 'substances' : null;
  if (!col) return '?';
  const it = ref[col].find(x => x.id === ep.id);
  return it ? it.name : '?(удалено)';
}
function subline(ref, key, it) {
  switch (key) {
    case 'habits': return fmtStats(it.baseEffects);
    case 'activities': return it.kcalPerUnit + ' ккал/ед';
    case 'skills': return (it.habitRefs || []).length + ' связей';
    case 'synergyRules': return fmtStats(it.bonus);
    case 'goals': return it.targetValue + ' ' + it.metric;
    case 'finCategories': return it.type === 'income' ? '↓ доход' : '↑ расход';
    default: return '';
  }
}

/* ---------- список справочников ---------- */
class RefModal extends Modal {
  constructor(app, store) { super(app); this.store = store; }
  onOpen() { this.render(); }
  async render() {
    const ref = this.store.ref, el = this.contentEl; el.empty(); el.addClass('lt');
    el.createEl('h2', { text: 'Справочники' });
    const cols = [
      ['habits', 'Привычки', h => h.name],
      ['activities', 'Активности', a => a.name],
      ['substances', 'Вещества', s => s.name],
      ['skills', 'Навыки', s => s.name],
      ['synergyRules', 'Синергии', r => epName(ref, r.source) + ' + ' + epName(ref, r.target)],
      ['goals', 'Цели', g => g.name],
      ['finCategories', 'Категории финансов', c => c.name],
    ];
    for (const [key, label, fmt] of cols) {
      el.createEl('h3', { text: label });
      for (const item of ref[key]) {
        const row = el.createDiv({ cls: 'lt-row' });
        row.createEl('span', { cls: 'lt-name', text: fmt(item) || '(без имени)' });
        const sub = subline(ref, key, item);
        if (sub) row.createEl('span', { cls: 'lt-chip', text: sub });
        row.createEl('button', { text: '✎' }).onclick = () => new EditModal(this.app, this.store, key, item, () => this.render()).open();
        const del = row.createEl('button', { text: '🗑' });
        del.onclick = () => {
          if (del.dataset.arm) { this.store.ref[key] = this.store.ref[key].filter(x => x.id !== item.id); this.store.saveRef(); this.render(); }
          else { del.dataset.arm = '1'; del.setText('точно?'); del.addClass('lt-danger'); setTimeout(() => { if (del.isConnected) { del.setText('🗑'); delete del.dataset.arm; del.removeClass('lt-danger'); } }, 2500); }
        };
      }
      el.createEl('button', { text: '+ добавить', cls: 'lt-add' }).onclick = () => new EditModal(this.app, this.store, key, null, () => this.render()).open();
    }

    el.createEl('h3', { text: '📈 Уровни навыков (текущие часы)' });
    const hoursMap = {};
    for (const d of (await this.store.listDays())) {
      const day = await this.store.loadDay(d);
      for (const sk of ref.skills) for (const hr of sk.habitRefs || []) {
        const l = day.habitLogs.find(x => x.habitId === hr.habitId);
        if (l && l.hours) hoursMap[sk.id] = (hoursMap[sk.id] || 0) + l.hours * (hr.weight ?? 1);
      }
    }
    for (const sk of ref.skills) {
      const h = hoursMap[sk.id] || 0;
      const lv = skillLevel(h);
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: sk.name });
      row.createEl('span', { cls: 'lt-chip', text: lv.name });
      row.createEl('span', { cls: 'lt-chip', text: fmtH(h) + ' / ' + lv.to + ' ч' });
      const bar = row.createDiv({ cls: 'lt-bar' });
      bar.createDiv({ cls: 'lt-bar-fill', attr: { style: `width:${skillProgress(h)}%` } });
    }

    el.createEl('h3', { text: '🏆 Достижения' });
    for (const a of (ref.achievements || []).slice().reverse()) {
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: `🏆 ${a.title}` });
      row.createEl('span', { cls: 'lt-chip', text: a.date || '' });
      const del = row.createEl('button', { text: '🗑' });
      del.onclick = () => {
        if (del.dataset.arm) { ref.achievements = ref.achievements.filter(x => x.id !== a.id); this.store.saveRef(); this.render(); }
        else { del.dataset.arm = '1'; del.setText('точно?'); del.addClass('lt-danger'); setTimeout(() => { if (del.isConnected) { del.setText('🗑'); delete del.dataset.arm; del.removeClass('lt-danger'); } }, 2500); }
      };
    }
    el.createEl('button', { text: '+ добавить достижение', cls: 'lt-add' }).onclick = () => new AchievementEditModal(this.app, this.store, () => this.render()).open();
  }
}

/* ---------- конструктор форм ---------- */
class FormBuilder {
  constructor(el, item, store) { this.el = el; this.item = item; this.store = store; }
  row(label) { const r = this.el.createDiv({ cls: 'lt-row' }); if (label) r.createEl('span', { cls: 'lt-flabel', text: label }); return r; }
  text(k, label) { const r = this.row(label); const i = r.createEl('input', { type: 'text', cls: 'lt-wide' }); i.value = this.item[k] || ''; i.addEventListener('input', () => { this.item[k] = i.value; }); }
  num(k, label) { const r = this.row(label); const i = r.createEl('input', { type: 'number', cls: 'lt-input' }); i.value = String(this.item[k] ?? 0); i.addEventListener('input', () => { this.item[k] = +i.value || 0; }); }
  date(k, label) { const r = this.row(label); const i = r.createEl('input', { type: 'date', cls: 'lt-input' }); i.value = this.item[k] || ''; i.addEventListener('input', () => { this.item[k] = i.value; }); }
  select(k, label, opts, onChange) {
    const r = this.row(label); const s = r.createEl('select');
    for (const [v, t] of opts) { const o = s.createEl('option', { value: v, text: t }); if (this.item[k] === v) o.selected = true; }
    s.addEventListener('change', () => { this.item[k] = s.value; onChange && onChange(); });
  }
  stats(k, label) {
    this.el.createDiv({ cls: 'lt-flabel', text: label });
    const r = this.el.createDiv({ cls: 'lt-stats' });
    for (const [key, lab] of STATS) {
      const w = r.createDiv({ cls: 'lt-meal' }); w.createEl('span', { text: lab });
      const i = w.createEl('input', { type: 'number', cls: 'lt-input' }); i.value = String(this.item[k][key] || 0);
      i.addEventListener('input', () => { this.item[k][key] = +i.value || 0; });
    }
  }
  endpoint(k, label) {
    this.el.createDiv({ cls: 'lt-flabel', text: label });
    const r = this.el.createDiv({ cls: 'lt-row' });
    const ts = r.createEl('select');
    for (const [v, t] of [['habit', 'привычка'], ['activity', 'активность'], ['substance', 'вещество']]) { const o = ts.createEl('option', { value: v, text: t }); if (this.item[k].type === v) o.selected = true; }
    const is = r.createEl('select');
    const fill = () => {
      is.empty();
      const col = this.item[k].type === 'habit' ? 'habits' : this.item[k].type === 'activity' ? 'activities' : 'substances';
      for (const x of this.store.ref[col]) { const o = is.createEl('option', { value: x.id, text: x.name }); if (this.item[k].id === x.id) o.selected = true; }
      this.item[k].id = is.value || '';
    };
    ts.addEventListener('change', () => { this.item[k].type = ts.value; fill(); });
    is.addEventListener('change', () => { this.item[k].id = is.value; });
    fill();
  }
  refs(k) {
    const wrap = this.el.createDiv();
    const render = () => {
      wrap.empty();
      this.item[k].forEach((hr, idx) => {
        const r = wrap.createDiv({ cls: 'lt-row' });
        const s = r.createEl('select');
        for (const h of this.store.ref.habits) { const o = s.createEl('option', { value: h.id, text: h.name }); if (hr.habitId === h.id) o.selected = true; }
        s.addEventListener('change', () => { hr.habitId = s.value; });
        const w = r.createEl('input', { type: 'number', cls: 'lt-input', attr: { step: '0.1', min: '0', max: '1' } });
        w.value = String(hr.weight ?? 1);
        w.addEventListener('input', () => { hr.weight = +w.value || 0; });
        r.createEl('button', { text: '✕' }).onclick = () => { this.item[k].splice(idx, 1); render(); };
      });
      wrap.createEl('button', { text: '+ связь с привычкой', cls: 'lt-add' }).onclick = () => { this.item[k].push({ habitId: this.store.ref.habits[0]?.id || '', weight: 1 }); render(); };
    };
    render();
  }
  refSelect(k, label, collGetter, onRegister) {
    const r = this.row(label); const s = r.createEl('select');
    const fill = () => {
      s.empty();
      for (const x of this.store.ref[collGetter()]) { const o = s.createEl('option', { value: x.id, text: x.name }); if (this.item[k] === x.id) o.selected = true; }
      this.item[k] = s.value || '';
    };
    fill(); onRegister && onRegister(fill);
    s.addEventListener('change', () => { this.item[k] = s.value; });
  }
}

/* ---------- форма элемента справочника ---------- */
class EditModal extends Modal {
  constructor(app, store, collKey, item, onSaved) {
    super(app); this.store = store; this.collKey = collKey; this.onSaved = onSaved;
    this.isNew = !item;
    this.item = item ? JSON.parse(JSON.stringify(item)) : newItem(collKey);
  }
  onOpen() {
    const el = this.contentEl; el.addClass('lt');
    const it = this.item;
    el.createEl('h2', { text: (this.isNew ? 'Новая · ' : 'Правка · ') + TITLES[this.collKey] });
    const F = new FormBuilder(el, it, this.store);
    switch (this.collKey) {
      case 'habits': F.text('name', 'Название'); F.stats('baseEffects', 'Эффекты за выполнение'); break;
      case 'activities': F.text('name', 'Название'); F.num('kcalPerUnit', 'ккал за единицу'); break;
      case 'substances': F.text('name', 'Название'); break;
      case 'skills': F.text('name', 'Название'); F.text('description', 'Описание'); F.refs('habitRefs'); break;
      case 'synergyRules': F.endpoint('source', 'Условие 1'); F.endpoint('target', 'Условие 2'); F.stats('bonus', 'Бонус, если оба в один день'); break;
      case 'goals': {
        F.text('name', 'Название');
        let refill = null;
        F.select('targetType', 'Тип цели', [['activity', 'активность'], ['skill', 'навык']], () => refill && refill());
        F.refSelect('targetId', 'Объект', () => it.targetType === 'skill' ? 'skills' : 'activities', f => { refill = f; });
        F.select('metric', 'Метрика', [['km', 'км'], ['count', 'кол-во'], ['hours', 'часы']]);
        F.num('targetValue', 'Целевое значение');
        F.date('start', 'Начало'); F.date('end', 'Конец (опц.)');
        F.select('status', 'Статус', [['active', 'активна'], ['achieved', 'выполнена'], ['failed', 'провалена'], ['cancelled', 'отменена']]);
        break;
      }
      case 'finCategories':
        F.text('name', 'Название');
        F.select('type', 'Тип', [['income', '↓ доход'], ['expense', '↑ расход']]);
        break;
    }
    el.createEl('button', { text: 'Сохранить ✓', cls: 'mod-cta' }).onclick = async () => {
      if (this.collKey !== 'synergyRules' && !it.name) { new Notice('Нужно название'); return; }
      if (this.collKey === 'synergyRules' && (!it.source.id || !it.target.id)) { new Notice('Выбери оба конца синергии'); return; }
      if (this.collKey === 'goals' && it.status === 'achieved') {
        const already = this.store.ref.achievements.find(a => a.fromGoalId === it.id);
        if (!already) {
          this.store.ref.achievements.push({ id: uid('ach'), title: '🎯 ' + it.name, description: '', date: iso(new Date()), fromGoalId: it.id });
          new Notice('Достижение создано: ' + it.name);
        }
      }
      const arr = this.store.ref[this.collKey];
      if (this.isNew) arr.push(it);
      else { const i = arr.findIndex(x => x.id === it.id); if (i >= 0) arr[i] = it; }
      await this.store.saveRef();
      this.onSaved(); this.close();
    };
  }
}

/* ---------- форма достижения ---------- */
class AchievementEditModal extends Modal {
  constructor(app, store, onSaved) { super(app); this.store = store; this.onSaved = onSaved; this.item = { id: uid('ach'), title: '', description: '', date: iso(new Date()) }; }
  onOpen() {
    const el = this.contentEl; el.addClass('lt');
    el.createEl('h2', { text: 'Новое достижение' });
    const F = new FormBuilder(el, this.item, this.store);
    F.text('title', 'Название');
    F.text('description', 'Описание');
    F.date('date', 'Дата получения');
    el.createEl('button', { text: 'Сохранить ✓', cls: 'mod-cta' }).onclick = async () => {
      if (!this.item.title) { new Notice('Нужно название'); return; }
      this.store.ref.achievements.push(this.item);
      await this.store.saveRef();
      this.onSaved(); this.close();
    };
  }
}

/* ---------- UI: ДЕЛА И ИДЕИ ---------- */
class WorkItemsModal extends Modal {
  constructor(app, store) { super(app); this.store = store; }
  onOpen() { this.render(); }
  render() {
    const el = this.contentEl; el.empty(); el.addClass('lt');
    el.createEl('h2', { text: '📋 Дела и идеи' });
    const tabs = el.createDiv({ cls: 'lt-tabs' });
    const kinds = [['all', 'Все'], ['task', 'Дела'], ['idea', 'Идеи'], ['done', 'Выполненные']];
    let curKind = 'all';
    const list = el.createDiv();
    const rerender = () => {
      list.empty();
      const items = this.store.work.items.filter(it => {
        if (curKind === 'done') return it.status === 'done';
        if (curKind === 'all') return true;
        return it.kind === curKind;
      });
      if (items.length === 0) list.createDiv({ text: '— пусто —' });
      
      // Получаем текущие статы для проверки требований
      const todayStats = computeDayStats(this.store.ref, this.store.cache[iso(new Date())] || { habitLogs: [], substanceLogs: [], activityLogs: [] }).stats;
      
      for (const it of items) {
        const row = list.createDiv({ cls: 'lt-row' });
        const statusIcons = { backlog: '○', in_progress: '◐', done: '✓', dropped: '✕' };
        
        // Проверяем требование к характеристике
        let canAccess = true;
        let reqText = '';
        if (it.minStatRequirement) {
          const [statKey, statLabel] = STATS.find(([k]) => k === it.minStatRequirement.stat) || ['', '?'];
          const statValue = todayStats[it.minStatRequirement.stat] || 0;
          canAccess = statValue >= it.minStatRequirement.threshold;
          reqText = ` (${statLabel} ${statValue}/${it.minStatRequirement.threshold})`;
        }
        
        const icon = canAccess ? (it.kind === 'task' ? '📝 ' : '💡 ') + (statusIcons[it.status] || '') : '🔒 ';
        row.createEl('span', { cls: 'lt-chip', text: icon });
        row.createEl('span', { cls: 'lt-name' + (it.status === 'done' ? ' lt-done' : '') + (!canAccess ? ' lt-locked' : ''), text: (it.name || '(без имени)') + reqText });
        row.createEl('button', { text: '✎' }).onclick = () => new WorkItemEditModal(this.app, this.store, it, () => this.render()).open();
        const del = row.createEl('button', { text: '🗑' });
        del.onclick = () => {
          if (del.dataset.arm) { this.store.work.items = this.store.work.items.filter(x => x.id !== it.id); this.store.saveWorkItems(); this.render(); }
          else { del.dataset.arm = '1'; del.setText('точно?'); del.addClass('lt-danger'); setTimeout(() => { if (del.isConnected) { del.setText('🗑'); delete del.dataset.arm; del.removeClass('lt-danger'); } }, 2500); }
        };
      }
    };
    for (const [k, l] of kinds) {
      const b = tabs.createEl('button', { text: l });
      b.onclick = () => { curKind = k; tabs.findAll('button').forEach(x => x.removeClass('is-active')); b.addClass('is-active'); rerender(); };
      if (k === 'all') b.addClass('is-active');
    }
    rerender();
    el.createEl('button', { text: '+ дело', cls: 'lt-add' }).onclick = () => new WorkItemEditModal(this.app, this.store, null, () => this.render(), 'task').open();
    el.createEl('button', { text: '+ идея', cls: 'lt-add' }).onclick = () => new WorkItemEditModal(this.app, this.store, null, () => this.render(), 'idea').open();
  }
}

class WorkItemEditModal extends Modal {
  constructor(app, store, item, onSaved, defaultKind) {
    super(app); this.store = store; this.onSaved = onSaved;
    this.isNew = !item;
    this.item = item ? JSON.parse(JSON.stringify(item)) : { id: uid('wi'), kind: defaultKind || 'task', name: '', description: '', effects: zeroStats(), status: 'backlog', createdAt: iso(new Date()) };
  }
  onOpen() {
    const el = this.contentEl; el.addClass('lt');
    el.createEl('h2', { text: (this.isNew ? 'Новый' : 'Правка') + ' · ' + (this.item.kind === 'task' ? 'Дело' : 'Идея') });
    const F = new FormBuilder(el, this.item, this.store);
    F.text('name', 'Название');
    F.text('description', 'Описание');
    F.select('kind', 'Тип', [['task', 'Дело'], ['idea', 'Идея']]);
    F.select('status', 'Статус', [['backlog', 'Ожидает'], ['in_progress', 'В работе'], ['done', 'Выполнено'], ['dropped', 'Отброшено']]);
    F.stats('effects', 'Эффекты (опц.)');
    
    // Секция порога характеристики (только для новых или если еще не установлен)
    const canEditRequirement = this.isNew || !this.item.minStatRequirement;
    if (canEditRequirement) {
      el.createEl('h4', { text: '🔒 Требование к характеристике (read-only после создания)' });
      const reqRow = el.createDiv({ cls: 'lt-row' });
      const statSel = reqRow.createEl('select', { cls: 'lt-big-select' });
      statSel.createEl('option', { value: '', text: 'Без требования' });
      for (const [key, label] of STATS) {
        statSel.createEl('option', { value: key, text: label });
      }
      if (this.item.minStatRequirement) {
        statSel.value = this.item.minStatRequirement.stat;
      }
      
      const threshInput = reqRow.createEl('input', { type: 'number', cls: 'lt-big-input', attr: { min: '0', max: '100', placeholder: 'Порог' } });
      if (this.item.minStatRequirement) {
        threshInput.value = this.item.minStatRequirement.threshold;
      }
      
      const setReqBtn = el.createEl('button', { text: 'Установить требование', cls: 'mod-cta' });
      setReqBtn.onclick = () => {
        if (statSel.value) {
          this.item.minStatRequirement = { stat: statSel.value, threshold: parseInt(threshInput.value) || 0 };
          new Notice(`Требование установлено: ${STATS.find(([k]) => k === statSel.value)?.[1]} >= ${threshInput.value}`);
        } else {
          this.item.minStatRequirement = null;
        }
      };
    } else if (this.item.minStatRequirement) {
      // Показываем read-only требование
      const [statKey, statLabel] = STATS.find(([k]) => k === this.item.minStatRequirement.stat) || ['', '?'];
      el.createEl('div', { cls: 'lt-notice', text: `🔒 Требование: ${statLabel} >= ${this.item.minStatRequirement.threshold} (нельзя изменить)` });
    }
    
    el.createEl('button', { text: 'Сохранить ✓', cls: 'mod-cta' }).onclick = async () => {
      if (!this.item.name) { new Notice('Нужно название'); return; }
      if (this.item.status === 'done' && !this.item.doneAt) this.item.doneAt = iso(new Date());
      if (this.isNew) this.store.work.items.push(this.item);
      else { const i = this.store.work.items.findIndex(x => x.id === this.item.id); if (i >= 0) this.store.work.items[i] = this.item; }
      await this.store.saveWorkItems();
      this.onSaved(); this.close();
    };
  }
}

/* ---------- UI: НАГРАДЫ И ТИТУЛЫ ---------- */
class RewardsModal extends Modal {
  constructor(app, store) { super(app); this.store = store; }
  async onOpen() {
    const el = this.contentEl; el.addClass('lt-rewards');
    const ref = this.store.ref;
    const rewardsData = this.store.rewardsData;
    
    // Сначала проверяем и начисляем награды за уровни
    await checkAndGrantLevelRewards(this.store);
    // Перезагружаем данные после начисления
    await this.store.loadRewards();
    
    // Расчет текущего уровня и XP
    const progress = await getPlayerProgress(this.store);
    
    el.createEl('h2', { text: '🏆 Награды и титулы' });
    
    // Секция 1: Уровень игрока
    const levelSection = el.createDiv({ cls: 'lt-rewards-section' });
    levelSection.createEl('h3', { text: `⚔️ Уровень ${progress.level} — ${progress.name}` });
    levelSection.createEl('div', { text: `✨ Всего XP: ${progress.totalXP}` });
    levelSection.createEl('div', { text: `📊 До следующего уровня: ${progress.remaining} XP` });
    
    // Кнопка проверки наград (для отладки)
    levelSection.createEl('button', { text: '🔄 Проверить награды', cls: 'mod-cta' }).onclick = async () => {
      const result = await checkAndGrantLevelRewards(this.store);
      if (result) {
        new Notice(`Получено ${result.grantedGlory} очков славы! Уровень: ${result.newLevel}`);
        this.close();
        new RewardsModal(this.app, this.store).open();
      } else {
        new Notice('Нет новых наград');
      }
    };
    
    // Секция 2: Титулы характеристик
    el.createEl('h3', { text: '📜 Титулы характеристик' });
    const stats = computeDayStats(ref, await this.store.loadDay(iso(new Date())));
    
    for (const [key, label] of STATS) {
      const statValue = stats.stats[key] || 0;
      const title = getStatTitle(key, statValue);
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: `${label}: ${statValue}` });
      row.createEl('span', { cls: 'lt-chip lt-title', text: title || '—' });
    }
    
    // Секция 3: Очки славы (валюта наград)
    el.createEl('h3', { text: '💰 Очки славы' });
    const currencyRow = el.createDiv({ cls: 'lt-rewards-currency' });
    currencyRow.createEl('span', { text: `Доступно: ${rewardsData.currency} 🪙` });
    
    // Секция 4: Инвентарь наград с кнопками экипировки
    el.createEl('h3', { text: '🎒 Инвентарь' });
    if (rewardsData.inventory.length === 0) {
      el.createEl('p', { text: 'Пока нет наград. Выполняйте задачи и повышайте уровень!' });
    } else {
      for (const reward of rewardsData.inventory) {
        const row = el.createDiv({ cls: 'lt-row' });
        const icon = reward.type === REWARD_TYPES.ACCESSORY ? '📿' : reward.type === REWARD_TYPES.DECOR ? '🏺' : '📜';
        row.createEl('span', { text: `${icon} ${reward.name}` });
        
        // Кнопки управления
        const actions = row.createDiv({ cls: 'lt-actions' });
        
        if (reward.type === REWARD_TYPES.ACCESSORY || reward.type === REWARD_TYPES.DECOR) {
          const slotType = reward.type === REWARD_TYPES.ACCESSORY ? 'accessory' : 'decor';
          const isEquipped = rewardsData.slots[slotType] && rewardsData.slots[slotType].id === reward.id;
          
          if (isEquipped) {
            actions.createEl('button', { text: 'Снять', cls: 'mod-warning' }).onclick = async () => {
              rewardsData.slots[slotType] = null;
              await this.store.saveRewards();
              this.close();
              new RewardsModal(this.app, this.store).open();
            };
          } else {
            actions.createEl('button', { text: 'Экипировать', cls: 'mod-cta' }).onclick = async () => {
              rewardsData.slots[slotType] = { id: reward.id, name: reward.name };
              await this.store.saveRewards();
              this.close();
              new RewardsModal(this.app, this.store).open();
            };
          }
        }
        
        row.createEl('span', { cls: 'lt-chip', text: new Date(reward.unlockedAt).toLocaleDateString() });
      }
    }
    
    // Секция 5: Активные слоты
    el.createEl('h3', { text: '🎯 Активные слоты' });
    const slotsRow = el.createDiv({ cls: 'lt-row' });
    slotsRow.createEl('span', { text: `Аксессуар: ${rewardsData.slots.accessory ? rewardsData.slots.accessory.name : '—'}` });
    slotsRow.createEl('span', { text: `Декор: ${rewardsData.slots.decor ? rewardsData.slots.decor.name : '—'}` });
    
    // Кнопка добавления пользовательской награды
    el.createEl('h3', { text: '➕ Добавить награду' });
    const addForm = el.createDiv({ cls: 'lt-form' });
    const nameInput = addForm.createEl('input', { type: 'text', placeholder: 'Название награды', cls: 'lt-big-input' });
    const typeSelect = addForm.createEl('select', { cls: 'lt-big-select' });
    typeSelect.createEl('option', { value: REWARD_TYPES.ACCESSORY, text: '📿 Аксессуар' });
    typeSelect.createEl('option', { value: REWARD_TYPES.DECOR, text: '🏺 Декор' });
    typeSelect.createEl('option', { value: REWARD_TYPES.TITLE, text: '📜 Титул' });
    typeSelect.createEl('option', { value: REWARD_TYPES.ACCESS, text: '🔓 Доступ' });
    
    addForm.createEl('button', { text: 'Добавить награду (10 🪙)', cls: 'mod-cta' }).onclick = async () => {
      if (!nameInput.value.trim()) {
        new Notice('Введите название награды');
        return;
      }
      if (rewardsData.currency < 10) {
        new Notice('Недостаточно очков славы');
        return;
      }
      
      rewardsData.inventory.push({
        id: 'custom_' + Date.now(),
        type: typeSelect.value,
        name: nameInput.value.trim(),
        unlockedAt: iso(new Date())
      });
      rewardsData.currency -= 10;
      await this.store.saveRewards();
      new Notice('Награда добавлена!');
      this.close();
      new RewardsModal(this.app, this.store).open();
    };
  }
}

/* ---------- UI: ДАШБОРД ---------- */
class DashboardModal extends Modal {
  constructor(app, store) { super(app); this.store = store; }
  async onOpen() {
    const el = this.contentEl; el.addClass('lt-dashboard');
    const today = iso(new Date());
    const ref = this.store.ref;
    const day = await this.store.loadDay(today);

    el.createEl('h2', { text: '📊 Дашборд персонажа' });

    // 0. Уровень и опыт игрока
    const progress = await getPlayerProgress(this.store);
    const xpCurrent = progress.totalXP - progress.required;
    const xpNeeded = progress.next - progress.required;
    const xpPct = xpNeeded > 0 ? Math.round((xpCurrent / xpNeeded) * 100) : 100;
    
    const levelCard = el.createDiv({ cls: 'lt-dash-card lt-level-card' });
    levelCard.createEl('div', { cls: 'lt-dash-title', text: `⚔️ Уровень ${progress.level} — ${progress.name}` });
    levelCard.createEl('div', { cls: 'lt-dash-value', text: `✨ ${progress.totalXP} XP` });
    const xpBar = levelCard.createDiv({ cls: 'lt-bar' });
    xpBar.createDiv({ cls: 'lt-bar-fill', attr: { style: `width:${xpPct}%` } });
    levelCard.createEl('div', { cls: 'lt-dash-subtitle', text: `${xpCurrent}/${xpNeeded} XP до уровня ${progress.level + 1}` });

    // Добавим кнопку для просмотра наград
    el.createEl('button', { text: '🏆 Награды и титулы', cls: 'mod-cta' }).onclick = () => { 
      new RewardsModal(this.app, this.store).open(); 
    };

    // 1. Сводка дня
    const c = dayCompletion(ref, day);
    const r = computeDayStats(ref, day);
    el.createEl('h3', { text: 'Сегодня' });
    const todayCard = el.createDiv({ cls: 'lt-dash-card' });
    todayCard.createEl('div', { cls: 'lt-dash-title', text: `Выполнение привычек` });
    todayCard.createEl('div', { cls: 'lt-dash-value', text: `${c.pct}% (${c.done}/${c.total})` });
    
    const statsCard = el.createDiv({ cls: 'lt-dash-card' });
    statsCard.createEl('div', { cls: 'lt-dash-title', text: 'Текущие статы' });
    statsCard.createEl('div', { cls: 'lt-dash-value', text: fmtStats(r.stats) });

    el.createEl('button', { text: 'Открыть полный трекер дня', cls: 'mod-cta' }).onclick = () => { this.close(); new DayModal(this.app, this.store, today).open(); };

    // 2. Навыки (суммарно за всё время)
    el.createEl('h3', { text: '📈 Навыки' });
    const allDays = await this.store.listDays();
    const hoursMap = {};
    for (const d of allDays) {
      const dData = await this.store.loadDay(d);
      for (const sk of ref.skills) {
        for (const hr of sk.habitRefs || []) {
          const l = dData.habitLogs.find(x => x.habitId === hr.habitId);
          if (l && l.hours) hoursMap[sk.id] = (hoursMap[sk.id] || 0) + l.hours * (hr.weight ?? 1);
        }
      }
    }
    for (const sk of ref.skills.slice(0, 5)) { // Показываем топ-5
      const h = hoursMap[sk.id] || 0;
      const lv = skillLevel(h);
      const row = el.createDiv({ cls: 'lt-row' });
      row.createEl('span', { cls: 'lt-name', text: sk.name });
      row.createEl('span', { cls: 'lt-chip', text: `${lv.name} (${fmtH(h)})` });
      const bar = row.createDiv({ cls: 'lt-bar' });
      bar.createDiv({ cls: 'lt-bar-fill', attr: { style: `width:${skillProgress(h)}%` } });
    }

    // 3. Активные цели
    const activeGoals = ref.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      el.createEl('h3', { text: '🎯 Активные цели' });
      for (const g of activeGoals.slice(0, 3)) {
        const p = await goalProgress(this.store, g, today);
        const pct = Math.min(100, Math.round((p / g.targetValue) * 100));
        const row = el.createDiv({ cls: 'lt-row' });
        row.createEl('span', { cls: 'lt-name', text: g.name });
        row.createEl('span', { cls: 'lt-chip', text: `${pct}%` });
        const bar = row.createDiv({ cls: 'lt-bar' });
        bar.createDiv({ cls: 'lt-bar-fill', attr: { style: `width:${pct}%` } });
      }
    }

    // 4. Последние достижения
    const achs = (ref.achievements || []).slice(-3).reverse();
    if (achs.length > 0) {
      el.createEl('h3', { text: '🏆 Последние достижения' });
      for (const a of achs) {
        el.createDiv({ cls: 'lt-dash-card' }).createEl('div', { text: `🏆 ${a.title} <span style="color:var(--text-muted);font-size:12px">(${a.date})</span>` });
      }
    }
  }
}

/* ---------- Плагин ---------- */
module.exports = class LifeTracker extends Plugin {
  async onload() {
    this.store = new Store(this.app);
    await this.store.init();
    const today = () => iso(new Date());
    
    this.addRibbonIcon('bar-chart', 'LifeTracker: день', () => new DayModal(this.app, this.store, today()).open());
    this.addRibbonIcon('calendar-range', 'LifeTracker: неделя', () => new WeekModal(this.app, this.store, today()).open());
    this.addRibbonIcon('gear', 'LifeTracker: справочники', () => new RefModal(this.app, this.store).open());
    this.addRibbonIcon('check-square', 'LifeTracker: дела', () => new WorkItemsModal(this.app, this.store).open());
    this.addRibbonIcon('layout-dashboard', 'LifeTracker: дашборд', () => new DashboardModal(this.app, this.store).open());    
    
    this.addCommand({ id: 'lt-day', name: 'LT: открыть сегодня', callback: () => new DayModal(this.app, this.store, today()).open() });
    this.addCommand({ id: 'lt-week', name: 'LT: открыть неделю', callback: () => new WeekModal(this.app, this.store, today()).open() });
    this.addCommand({ id: 'lt-ref', name: 'LT: справочники', callback: () => new RefModal(this.app, this.store).open() });
    this.addCommand({ id: 'lt-work', name: 'LT: дела и идеи', callback: () => new WorkItemsModal(this.app, this.store).open() });
    this.addCommand({ id: 'lt-dashboard', name: 'LT: открыть дашборд', callback: () => new DashboardModal(this.app, this.store).open() });

    // ▼ ПЕРЕНЕСЕНО ВНУТРЬ onload() ▼
    // Обработчик код-блока ```lifetracker-day [дата]
    // Код-блок ```lifetracker-day [дата]
    this.registerMarkdownCodeBlockProcessor('lifetracker-day', async (source, el, ctx) => {
      const store = this.store, ref = store.ref;
      const targetDate = source.trim() || iso(new Date());

      const render = async () => {
        el.empty();
        const day = await store.loadDay(targetDate);
        const c = dayCompletion(ref, day);
        const r = computeDayStats(ref, day);
        const k = dayKcal(ref, day);
        const f = dayFinance(ref, day);
        const save = () => store.saveDay(targetDate);
        const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
        const bar = v => '▰'.repeat(v) + '▱'.repeat(10 - v);

        /* ========== ПАНЕЛЬ 1: СТАТИЧНАЯ ASCII (справочная) ========== */
        const ascii = el.createDiv({ cls: 'lt-ascii' });
        const line = (text, cls) => ascii.createDiv({ cls: 'lt-ascii-line' + (cls ? ' ' + cls : ''), text });

        line(`┌─ ДЕНЬ · ${targetDate} · ${WD[(parseISO(targetDate).getDay() + 6) % 7]} · 🎯 ${c.pct}% (${c.done}/${c.total}) ─────`, 'lt-a-head');

        line('│ ПРИВЫЧКИ', 'lt-a-sec');
        const wH = Math.max(10, ...ref.habits.map(h => h.name.length)) + 1;
        for (const h of ref.habits) {
          const l = day.habitLogs.find(x => x.habitId === h.id);
          const streak = await habitStreak(store, h.id, targetDate);
          const eff = fmtStats(h.baseEffects);
          line(`│  [${l.done ? '✓' : ' '}] ${pad(h.name, wH)}${eff === '—' ? '' : eff + '  '}${fmtH(l.hours || 0)}${streak ? '  🔥' + streak : ''}`);
        }

        if (ref.substances.length) {
          line('│ ВЕЩЕСТВА', 'lt-a-sec');
          for (const s of ref.substances) {
            const l = day.substanceLogs.find(x => x.substanceId === s.id);
            line(`│  [${l.taken ? '✓' : ' '}] ${s.name}`);
          }
        }

        if (ref.activities.length) {
          line('│ АКТИВНОСТИ', 'lt-a-sec');
          for (const a of ref.activities) {
            const l = day.activityLogs.find(x => x.activityId === a.id);
            const kc = Math.round(a.kcalPerUnit * (+l.amount || 0));
            line(`│  ${pad(a.name + ' ×' + (+l.amount || 0), wH)}${kc ? '−' + kc + ' ккал' : ''}`);
          }
        }

        line('│ ЕДА', 'lt-a-sec');
        line(`│  ${MEALS.map(([slot, lab]) => `${lab} ${(day.meals.find(m => m.slot === slot) || {}).kcal || 0}`).join(' · ')}  Σ ${k.eaten}`);

        if (day.financeLogs.length) {
          line('│ ФИНАНСЫ', 'lt-a-sec');
          line(`│  ↓ ${f.income} · ↑ ${f.expense}  = ${f.balance >= 0 ? '+' : ''}${f.balance} ₽`);
        }

        line('│ СОСТОЯНИЕ', 'lt-a-sec');
        const wS = Math.max(10, ...STATES.map(([, l]) => l.length)) + 1;
        for (const [key, lab] of STATES) {
          const v = day.state[key] ?? 5;
          line(`│  ${pad(lab, wS)}${bar(v)} ${v}`);
        }

        if (day.comment) line(`│ ЗАМЕТКА  «${day.comment}»`, 'lt-a-com');

        line(`│ ИТОГ  ${fmtStats(r.stats)}  ·  ккал ${k.balance >= 0 ? '+' : ''}${k.balance}  ·  ₽ ${f.balance >= 0 ? '+' : ''}${f.balance}${r.syn.length ? '  ·  синергии ' + r.syn.length + ' ✅' : ''}`, 'lt-a-total');
        line('└' + '─'.repeat(46), 'lt-a-head');

        /* ========== ПАНЕЛЬ 2: ИНТЕРАКТИВНАЯ (тач) ========== */
        const touch = el.createDiv({ cls: 'lt-touch' });
        touch.createEl('h4', { cls: 'lt-touch-title', text: '✏️ ЗАПОЛНИТЬ' });
        const act = fn => async () => { fn(); await save(); render(); };
        const bigBtn = (parent, txt, fn) => { const b = parent.createEl('button', { cls: 'lt-big-btn', text: txt }); b.onclick = act(fn); return b; };
        const head = t => touch.createEl('h4', { text: t });

        head('Привычки');
        for (const h of ref.habits) {
          const l = day.habitLogs.find(x => x.habitId === h.id);
          const row = touch.createDiv({ cls: 'lt-touch-row' });
          const cb = row.createEl('input', { type: 'checkbox', cls: 'lt-big-check' });
          cb.checked = !!l.done;
          cb.onchange = act(() => { l.done = cb.checked; });
          row.createEl('span', { cls: 'lt-touch-name', text: h.name });
          const step = row.createDiv({ cls: 'lt-touch-step' });
          bigBtn(step, '−', () => { l.hours = Math.max(0, (+l.hours || 0) - 0.25); });
          step.createEl('span', { cls: 'lt-touch-val', text: fmtH(l.hours || 0) });
          bigBtn(step, '+', () => { l.hours = (+l.hours || 0) + 0.25; });
        }

        if (ref.substances.length) {
          head('Вещества');
          for (const s of ref.substances) {
            const l = day.substanceLogs.find(x => x.substanceId === s.id);
            const row = touch.createDiv({ cls: 'lt-touch-row' });
            const cb = row.createEl('input', { type: 'checkbox', cls: 'lt-big-check' });
            cb.checked = !!l.taken;
            cb.onchange = act(() => { l.taken = cb.checked; });
            row.createEl('span', { cls: 'lt-touch-name', text: s.name });
          }
        }

        if (ref.activities.length) {
          head('Активности');
          for (const a of ref.activities) {
            const l = day.activityLogs.find(x => x.activityId === a.id);
            const row = touch.createDiv({ cls: 'lt-touch-row' });
            row.createEl('span', { cls: 'lt-touch-name', text: a.name });
            const step = row.createDiv({ cls: 'lt-touch-step' });
            bigBtn(step, '−', () => { l.amount = Math.max(0, (+l.amount || 0) - 1); });
            step.createEl('span', { cls: 'lt-touch-val', text: String(+l.amount || 0) });
            bigBtn(step, '+', () => { l.amount = (+l.amount || 0) + 1; });
            row.createEl('span', { cls: 'lt-touch-sub', text: `−${Math.round(a.kcalPerUnit * (+l.amount || 0))} ккал` });
          }
        }

        head('Еда (ккал)');
        const mrow = touch.createDiv({ cls: 'lt-touch-meals' });
        for (const [slot, lab] of MEALS) {
          const m = day.meals.find(x => x.slot === slot);
          const w = mrow.createDiv({ cls: 'lt-touch-meal' });
          w.createEl('span', { text: lab });
          const inp = w.createEl('input', { type: 'number', cls: 'lt-big-input', attr: { inputmode: 'numeric' } });
          inp.value = String(+m.kcal || 0);
          inp.onchange = act(() => { m.kcal = +inp.value || 0; });
        }

        head('Финансы (₽)');
        for (let i = 0; i < day.financeLogs.length; i++) {
          const fin = day.financeLogs[i];
          const row = touch.createDiv({ cls: 'lt-touch-row' });
          const sel = row.createEl('select', { cls: 'lt-big-select' });
          for (const fc of ref.finCategories) {
            const o = sel.createEl('option', { value: fc.id, text: `${fc.type === 'income' ? '↓' : '↑'} ${fc.name}` });
            if (fc.id === fin.categoryId) o.selected = true;
          }
          sel.onchange = act(() => { fin.categoryId = sel.value; });
          const amt = row.createEl('input', { type: 'number', cls: 'lt-big-input', attr: { inputmode: 'decimal' } });
          amt.value = String(+fin.amount || 0);
          amt.onchange = act(() => { fin.amount = +amt.value || 0; });
          bigBtn(row, '✕', () => { day.financeLogs.splice(i, 1); });
        }
        const addB = touch.createEl('button', { cls: 'lt-big-btn lt-wide-btn', text: '+ операция' });
        addB.onclick = act(() => {
          if (!ref.finCategories.length) { new Notice('Сначала добавь категории в Справочниках'); return; }
          day.financeLogs.push({ categoryId: ref.finCategories[0].id, amount: 0, note: '' });
        });

        head('Состояние (0–10)');
        for (const [key, lab] of STATES) {
          const row = touch.createDiv({ cls: 'lt-touch-row' });
          row.createEl('span', { cls: 'lt-touch-name', text: lab });
          const step = row.createDiv({ cls: 'lt-touch-step' });
          bigBtn(step, '−', () => { day.state[key] = Math.max(0, (day.state[key] ?? 5) - 1); });
          step.createEl('span', { cls: 'lt-touch-val', text: String(day.state[key] ?? 5) });
          bigBtn(step, '+', () => { day.state[key] = Math.min(10, (day.state[key] ?? 5) + 1); });
        }

        head('Комментарий');
        const ta = touch.createEl('textarea', { cls: 'lt-touch-comment', attr: { placeholder: 'комментарий дня…' } });
        ta.value = day.comment || '';
        ta.onchange = async () => { day.comment = ta.value; await save(); render(); };

        touch.createDiv({ cls: 'lt-touch-hint', text: '💾 автосохранение после каждого изменения' });
      };

      render();
    });
  } // <--- Теперь onload() закрывается ПОСЛЕ registerMarkdownCodeBlockProcessor
} // <--- Закрывается класс LifeTracker