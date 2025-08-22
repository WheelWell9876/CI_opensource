// builtin-apis.js - Handle built-in API functionality

let builtInApis = [];

function initBuiltInApis() {
  debugLog('Built-in APIs - Initializing');
  loadBuiltInApis();
}

function loadBuiltInApis() {
  debugLog('Built-in APIs - Loading from server');

  fetch('/json-editor/api/apis', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    debugLog('Built-in APIs - Response status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('Built-in APIs - Data received', data);
    if (data.success) {
      builtInApis = data.apis.built_in || [];
      populateBuiltInApiSelect();
    } else {
      console.error('Built-in APIs - Failed to load:', data.error);
      showMessage('Failed to load built-in APIs', 'error');
    }
  })
  .catch(error => {
    console.error('Built-in APIs - Error loading:', error);
    showMessage('Error loading built-in APIs: ' + error.message, 'error');
    // Initialize empty state
    populateBuiltInApiSelect();
  });
}

function populateBuiltInApiSelect() {
  debugLog('Built-in APIs - Populating select');

  const select = document.getElementById('builtInApiSelect');
  if (!select) {
    debugLog('Built-in APIs - Select element not found');
    return;
  }

  select.innerHTML = '<option value="">Choose a built-in API...</option>';

  if (builtInApis.length === 0) {
    select.innerHTML = '<option value="">No built-in APIs available</option>';
    return;
  }

  // Group APIs by category
  const apisByCategory = {};
  builtInApis.forEach(api => {
    const category = api.category || 'Other';
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

  debugLog('Built-in APIs - Select populated with', builtInApis.length, 'APIs');
}

function loadFromBuiltInApi() {
  const select = document.getElementById('builtInApiSelect');
  if (!select || !select.value) {
    showMessage('Please select a built-in API', 'error');
    return;
  }

  const apiId = select.value;
  debugLog('Built-in APIs - Loading from API:', apiId);

  showMessage('Loading data from built-in API...', 'info');

  fetch('/json-editor/api/load_from_api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_id: apiId,
      limit: 1000
    })
  })
  .then(response => {
    debugLog('Built-in APIs - API response received', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('Built-in APIs - API data received', data);
    if (data.success) {
      // Call the core editor's processGeoJSON function
      processGeoJSON(data.data, data.field_info);
      showMessage(`Loaded ${data.data.total_features || data.data.features.length} features successfully!`, 'success');
    } else {
      console.error('Built-in APIs - API returned error:', data.error);
      showMessage(data.error || 'Failed to load data', 'error');
    }
  })
  .catch(error => {
    console.error('Built-in APIs - Error loading:', error);
    showMessage('Error loading data: ' + error.message, 'error');
  });
}