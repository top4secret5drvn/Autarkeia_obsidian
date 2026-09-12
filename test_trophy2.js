const fs = require('fs');
const path = require('path');

const rewardsPath = path.join(__dirname, 'LifeTracker', 'rewards.json');

// Симуляция того что делает плагин при создании трофея
async function simulateCreateTrophy() {
  // Читаем данные (как это делает loadRewards)
  let rawData;
  if (fs.existsSync(rewardsPath)) {
    rawData = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
  } else {
    rawData = {
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
  
  console.log('До создания трофея:', JSON.stringify(rawData, null, 2));
  
  // Создаём трофей (как в RewardsModal)
  const newTrophy = {
    id: 'trophy_' + Date.now(),
    type: 'accessory',
    name: 'Золотые часы',
    description: 'Красивые золотые часы',
    unlockedAt: new Date().toISOString()
  };
  
  rawData.inventory.push(newTrophy);
  rawData.currency -= 1;
  
  // Сохраняем (как saveRewards)
  fs.writeFileSync(rewardsPath, JSON.stringify(rawData, null, 2));
  
  // Проверяем что сохранилось
  const savedData = JSON.parse(fs.readFileSync(rewardsPath, 'utf8'));
  console.log('\nПосле сохранения:', JSON.stringify(savedData, null, 2));
  
  if (savedData.inventory.length === 1 && savedData.inventory[0].name === 'Золотые часы') {
    console.log('\n✅ ТЕСТ ПРОЙДЕН: Трофей успешно сохранён!');
    return true;
  } else {
    console.log('\n❌ ТЕСТ НЕ ПРОЙДЕН: Трофей не сохранился!');
    return false;
  }
}

simulateCreateTrophy();
