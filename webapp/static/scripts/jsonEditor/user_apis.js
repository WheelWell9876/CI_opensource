// user-apis.js - Handle user-created API functionality

let userApis = [];

function initUserApis() {
  debugLog('User APIs - Initializing');
  loadUserApis();
}

function loadUserApis() {
  debugLog('User APIs - Loading from server');

  fetch('/json-editor/api/apis', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    debugLog('User APIs - Response status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('User APIs - Data received', data);
    if (data.success) {
      userApis = data.apis.user_created || [];
      populateUserApiSelect();
    } else {
      console.error('User APIs - Failed to load:', data.error);
      showMessage('Failed to load user APIs', 'error');
    }
  })
  .catch(error => {
    console.error('User APIs - Error loading:', error);
    showMessage('Error loading user APIs: ' + error.message, 'error');
    // Initialize empty state
    populateUserApiSelect();
  });
}

function populateUserApiSelect() {
  debugLog('User APIs - Populating select');

  const select = document.getElementById('userApiSelect');
  if (!select) {
    debugLog('User APIs - Select element not found');
    return;
  }

  select.innerHTML = '<option value="">Choose a custom API...</option>';

  if (userApis.length === 0) {
    select.innerHTML = '<option value="">No custom APIs available</option>';
    return;
  }

  // Group APIs by category
  const apisByCategory = {};
  userApis.forEach(api => {
    const category = api.category || 'Custom';
    if (!apisByCategory[category]) {
      apisByCategory[category] = [];
    }
    apisByCategory[category].push(api);
  });

  // Add options grouped by category
  Object.keys(apisByCategory).sort().forEach(category => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;

    apisByCategory[category].forEach(api => {
      const option = document.createElement('option');
      option.value = api.id;
      option.textContent = api.name;
      option.title = api.description;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  debugLog('User APIs - Select populated with', userApis.length, 'APIs');
}

function loadFromUserApi() {
  const select = document.getElementById('userApiSelect');
  if (!select || !select.value) {
    showMessage('Please select a custom API', 'error');
    return;
  }

  const apiId = select.value;
  debugLog('User APIs - Loading from API:', apiId);

  showMessage('Loading data from custom API...', 'info');

  fetch('/json-editor/api/load_from_api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_id: apiId,
      limit: 1000
    })
  })
  .then(response => {
    debugLog('User APIs - API response received', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('User APIs - API data received', data);
    if (data.success) {
      // Call the core editor's processGeoJSON function
      processGeoJSON(data.data, data.field_info);
      showMessage(`Loaded ${data.data.total_features || data.data.features.length} features successfully!`, 'success');
    } else {
      console.error('User APIs - API returned error:', data.error);
      showMessage(data.error || 'Failed to load data', 'error');
    }
  })
  .catch(error => {
    console.error('User APIs - Error loading:', error);
    showMessage('Error loading data: ' + error.message, 'error');
  });
}

function loadFromCustomUrl() {
  const input = document.getElementById('customApiUrl');
  if (!input || !input.value.trim()) {
    showMessage('Please enter a custom URL', 'error');
    return;
  }

  const customUrl = input.value.trim();
  debugLog('User APIs - Loading from custom URL:', customUrl);

  showMessage('Loading data from custom URL...', 'info');

  fetch('/json-editor/api/load_from_api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: customUrl,
      limit: 1000
    })
  })
  .then(response => {
    debugLog('User APIs - Custom URL response received', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('User APIs - Custom URL data received', data);
    if (data.success) {
      // Call the core editor's processGeoJSON function
      processGeoJSON(data.data, data.field_info);
      showMessage(`Loaded ${data.data.total_features || data.data.features.length} features successfully!`, 'success');
    } else {
      console.error('User APIs - Custom URL returned error:', data.error);
      showMessage(data.error || 'Failed to load data', 'error');
    }
  })
  .catch(error => {
    console.error('User APIs - Error loading custom URL:', error);
    showMessage('Error loading data: ' + error.message, 'error');
  });
}

// Refresh user APIs list (called after creating new API)
function refreshUserApis() {
  debugLog('User APIs - Refreshing list');
  loadUserApis();
}