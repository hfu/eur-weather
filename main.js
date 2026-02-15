// Exchange rate API configuration
const API_BASE = 'https://api.exchangerate-api.com/v4/latest';

// Weather determination thresholds
const THRESHOLD_SUNNY = 0.01; // +1% or more favorable
const THRESHOLD_RAINY = -0.01; // -1% or worse

// Weather icons and comments
const WEATHER = {
  sunny: {
    icon: '☀️',
    comments: [
      '良いタイミングです。今日は替え時かもしれません。',
      '平均より有利なレートです。検討してみては？',
      '今日のレートは好調です。チャンスかも。'
    ]
  },
  cloudy: {
    icon: '⛅',
    comments: [
      '平均的なレートです。急ぎでなければ様子見も。',
      '標準的な水準です。焦らず判断しましょう。',
      '平均的なタイミングです。落ち着いて検討を。'
    ]
  },
  rainy: {
    icon: '🌧️',
    comments: [
      '平均より不利なレートです。待つのも一つの手。',
      '今日は様子見がよいかもしれません。',
      '少し待ってみるのもありかもしれません。'
    ]
  }
};

// Get random comment from weather type
function getComment(weatherType) {
  const comments = WEATHER[weatherType].comments;
  return comments[Math.floor(Math.random() * comments.length)];
}

// Determine weather based on rate comparison
function determineWeather(currentRate, avgRate) {
  // For JPY and USD to EUR, higher rate means more EUR per unit, which is better
  const difference = (currentRate - avgRate) / avgRate;
  
  if (difference >= THRESHOLD_SUNNY) {
    return 'sunny';
  } else if (difference <= THRESHOLD_RAINY) {
    return 'rainy';
  } else {
    return 'cloudy';
  }
}

// Calculate average of rates
function calculateAverage(rates) {
  const sum = rates.reduce((acc, val) => acc + val, 0);
  return sum / rates.length;
}

// Fetch historical rates for past 30 days
async function fetchHistoricalRates(baseCurrency, targetCurrency = 'EUR') {
  const rates = [];
  const today = new Date();
  
  // For simplicity, we'll use the current rate as a proxy
  // In a real app, you'd need a service that provides historical data
  // Since exchangerate-api.com free tier doesn't provide historical data,
  // we'll use a workaround with frankfurter.app which is free
  
  try {
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const response = await fetch(
      `https://api.frankfurter.app/${startDateStr}..${endDate}?from=${baseCurrency}&to=${targetCurrency}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch historical data');
    }
    
    const data = await response.json();
    
    // Extract rates from the response
    for (const date in data.rates) {
      rates.push(data.rates[date][targetCurrency]);
    }
    
    return rates;
  } catch (error) {
    console.error('Error fetching historical rates:', error);
    // Fallback: return empty array
    return [];
  }
}

// Fetch current rate
async function fetchCurrentRate(baseCurrency, targetCurrency = 'EUR') {
  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${targetCurrency}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch current rate');
    }
    
    const data = await response.json();
    return data.rates[targetCurrency];
  } catch (error) {
    console.error('Error fetching current rate:', error);
    throw error;
  }
}

// Update UI for a currency pair
function updateCurrencyDisplay(prefix, rate, avgRate, weatherType) {
  const icon = document.getElementById(`${prefix}-icon`);
  const rateEl = document.getElementById(`${prefix}-rate`);
  const diffEl = document.getElementById(`${prefix}-diff`);
  const commentEl = document.getElementById(`${prefix}-comment`);
  
  icon.textContent = WEATHER[weatherType].icon;
  rateEl.textContent = rate.toFixed(4);
  
  const difference = rate - avgRate;
  const percentDiff = ((difference / avgRate) * 100).toFixed(2);
  const sign = difference >= 0 ? '+' : '';
  
  diffEl.textContent = `${sign}${percentDiff}%`;
  diffEl.classList.remove('positive', 'negative');
  if (difference > 0) {
    diffEl.classList.add('positive');
  } else if (difference < 0) {
    diffEl.classList.add('negative');
  }
  
  commentEl.textContent = getComment(weatherType);
}

// Main application logic
async function initApp() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const contentEl = document.getElementById('content');
  const updateTimeEl = document.getElementById('update-time');
  
  try {
    // Fetch data for both currency pairs
    const [jpyRate, jpyHistorical, usdRate, usdHistorical] = await Promise.all([
      fetchCurrentRate('JPY'),
      fetchHistoricalRates('JPY'),
      fetchCurrentRate('USD'),
      fetchHistoricalRates('USD')
    ]);
    
    // Calculate averages
    const jpyAvg = calculateAverage(jpyHistorical);
    const usdAvg = calculateAverage(usdHistorical);
    
    // Determine weather
    const jpyWeather = determineWeather(jpyRate, jpyAvg);
    const usdWeather = determineWeather(usdRate, usdAvg);
    
    // Update UI
    updateCurrencyDisplay('jpy', jpyRate, jpyAvg, jpyWeather);
    updateCurrencyDisplay('usd', usdRate, usdAvg, usdWeather);
    
    // Show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    
    // Update timestamp
    const now = new Date();
    updateTimeEl.textContent = `更新: ${now.toLocaleString('ja-JP')}`;
    
  } catch (error) {
    console.error('Error initializing app:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
