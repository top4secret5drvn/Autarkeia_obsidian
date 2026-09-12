const fs = require('fs');
const path = require('path');

const rewardsPath = path.join(__dirname, 'LifeTracker', 'rewards.json');

// Читаем текущие данные
let data;
if (fs.existsSync(rewardsPath)) {
  data = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
} else {
  data = {
    currency: 5,
    inventory: [],
    slots: [],
    titles: [],
    accesses: [],
    lastProcessedLevel: 0,
    unlockedSlots: 0,
    levelingConfig: {
      baseXP: 100,
      growthFactor: 1.5,
      formula: 'quadratic',
      gloryPerLevel: 1
    }
  };
}

console.log('До создания трофея:', JSON.stringify(data, null, 2));

// Создаём трофей
const newTrophy = {
  id: 'trophy_' + Date.now(),
  type: 'accessory',
  name: 'Золотые часы',
  description: 'Красивые золотые часы в подарок за достижения',
  unlockedAt: new Date().toISOString()
};

data.inventory.push(newTrophy);
data.currency -= 1;

console.log('\nПосле создания трофея:', JSON.stringify(data, null, 2));

// Сохраняем обратно
fs.writeFileSync(rewardsPath, JSON.stringify(data, null, 2));

// Проверяем что сохранилось
const savedData = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
console.log('\nПосле чтения из файла:', JSON.stringify(savedData, null, 2));

if (savedData.inventory.length === 1 && savedData.inventory[0].name === 'Золотые часы') {
  console.log('\n✅ ТЕСТ ПРОЙДЕН: Трофей успешно сохранён!');
} else {
  console.log('\n❌ ТЕСТ НЕ ПРОЙДЕН: Трофей не сохранился!');
}
