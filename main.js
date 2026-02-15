// Weather determination thresholds
const THRESHOLD_SUNNY = 0.01; // +1% or more favorable
const THRESHOLD_RAINY = -0.01; // -1% or worse

// Cache duration in milliseconds (10 minutes)
const CACHE_DURATION = 10 * 60 * 1000;

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
  // Higher rate means more EUR received per unit of JPY/USD, which is favorable when converting to EUR
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
  if (!Array.isArray(rates) || rates.length === 0) {
    return 0;
  }
  const sum = rates.reduce((acc, val) => acc + val, 0);
  return sum / rates.length;
}

// Fetch historical rates for past 30 days
async function fetchHistoricalRates(baseCurrency, targetCurrency = 'EUR') {
  const rates = [];
  const today = new Date();
  
  // Fetch actual historical rates from frankfurter.app
  // which provides free historical exchange rate data for the last 30 days
  
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
    
    // Validate response structure before accessing rates
    if (!data || typeof data !== 'object' || !data.rates || typeof data.rates !== 'object') {
      console.error('Unexpected historical rates response structure:', data);
      return rates;
    }
    
    // Extract rates from the response
    for (const date in data.rates) {
      const dayRates = data.rates[date];
      if (!dayRates || typeof dayRates !== 'object') {
        continue;
      }
      const rateForDay = dayRates[targetCurrency];
      if (typeof rateForDay !== 'number') {
        continue;
      }
      rates.push(rateForDay);
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

// Cache helper functions
function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

function setCachedData(key, data) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

// Fetch with caching
async function fetchWithCache(cacheKey, fetchFunction) {
  // Try to get from cache first
  const cached = getCachedData(cacheKey);
  if (cached !== null) {
    console.log(`Using cached data for ${cacheKey}`);
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetchFunction();
  
  // Cache the result
  setCachedData(cacheKey, data);
  
  return data;
}

// Update UI for a currency pair
function updateCurrencyDisplay(prefix, rate, avgRate, weatherType) {
  const icon = document.getElementById(`${prefix}-icon`);
  const rateEl = document.getElementById(`${prefix}-rate`);
  const diffEl = document.getElementById(`${prefix}-diff`);
  const commentEl = document.getElementById(`${prefix}-comment`);
  
  // Guard against missing DOM elements to avoid runtime errors
  if (!icon || !rateEl || !diffEl || !commentEl) {
    console.warn(
      `Missing DOM element(s) for prefix "${prefix}".`,
      { icon, rateEl, diffEl, commentEl }
    );
    return;
  }
  
  icon.textContent = WEATHER[weatherType].icon;
  
  // For JPY, display inverted rate (EUR/JPY instead of JPY/EUR)
  // to show how many JPY per 1 EUR, which is more familiar to users
  // Guard against division by zero
  const displayRate = prefix === 'jpy' && rate !== 0 ? 1 / rate : rate;
  
  // Add currency pair symbols for clarity
  // Note: Currently supports only 'jpy' and 'usd' prefixes
  const currencySymbol = prefix === 'jpy' ? ' [💴/💶]' : ' [💶/💵]';
  
  // Use 2 decimal places for JPY (e.g., 182.00) and 4 for other currencies
  rateEl.textContent = displayRate.toFixed(prefix === 'jpy' ? 2 : 4) + currencySymbol;
  
  // Calculate percentage difference using RAW rates to match weather determination logic
  // This ensures consistency: favorable weather = positive %, unfavorable = negative %
  // Guard against division by zero in percentage calculation
  if (avgRate === 0) {
    diffEl.textContent = 'N/A';
    diffEl.classList.remove('positive', 'negative');
  } else {
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
    // Fetch data for both currency pairs with caching
    const [jpyRate, jpyHistorical, usdRate, usdHistorical] = await Promise.all([
      fetchWithCache('jpy-current', () => fetchCurrentRate('JPY')),
      fetchWithCache('jpy-historical', () => fetchHistoricalRates('JPY')),
      fetchWithCache('usd-current', () => fetchCurrentRate('USD')),
      fetchWithCache('usd-historical', () => fetchHistoricalRates('USD'))
    ]);
    
    // Use current rate as fallback if historical data is unavailable or empty
    const jpyHistoricalForAvg =
      Array.isArray(jpyHistorical) && jpyHistorical.length > 0 ? jpyHistorical : [jpyRate];
    const usdHistoricalForAvg =
      Array.isArray(usdHistorical) && usdHistorical.length > 0 ? usdHistorical : [usdRate];
    
    // Calculate averages
    const jpyAvg = calculateAverage(jpyHistoricalForAvg);
    const usdAvg = calculateAverage(usdHistoricalForAvg);
    
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
