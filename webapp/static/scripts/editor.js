document.addEventListener('DOMContentLoaded', function() {
  // ---------------------------------------------------------------------------
  // Provided APIs – update as needed.
  // ---------------------------------------------------------------------------
  const providedAPIs = {
    "EPA Disaster Debris Recovery Data": "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/EPA_Disaster_Debris_Recovery_Data/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
    "Agricultural Minerals Operations": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Agricultural_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
    "Construction Minerals Operations": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Construction_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
    "US Army Corps of Engineers (USACE) Owned and Operated Reservoirs": "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/arcgis/rest/services/usace_rez/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson"
  };

  // Populate Provided APIs dropdown.
  function populateProvidedAPIs() {
    const select = document.getElementById('provided-api-select');
    select.innerHTML = '';
    Object.keys(providedAPIs).sort().forEach(apiName => {
      const option = document.createElement('option');
      option.value = providedAPIs[apiName];
      option.textContent = apiName;
      select.appendChild(option);
    });
  }
  populateProvidedAPIs();

  // ---------------------------------------------------------------------------
  // Source Type selection.
  // ---------------------------------------------------------------------------
  document.getElementById('source-type-select').addEventListener('change', function() {
    const providedGroup = document.getElementById('provided-api-group');
    if (this.value === 'provided') {
      providedGroup.style.display = 'block';
      document.getElementById('api-url-input').value = document.getElementById('provided-api-select').value;
    } else {
      providedGroup.style.display = 'none';
      document.getElementById('api-url-input').value = '';
    }
  });
  document.getElementById('provided-api-select').addEventListener('change', function() {
    document.getElementById('api-url-input').value = this.value;
  });

  // ---------------------------------------------------------------------------
  // Toggle collapsible sections.
  // ---------------------------------------------------------------------------
  const collapsibles = document.querySelectorAll('.collapsible-header');
  collapsibles.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      content.classList.toggle('active');
    });
  });

  // ---------------------------------------------------------------------------
  // Load fields from API and update the UI.
  // ---------------------------------------------------------------------------
  document.getElementById('load-fields').addEventListener('click', function() {
    const apiUrl = document.getElementById('api-url-input').value;
    if (!apiUrl) {
      alert("Please enter an API URL.");
      return;
    }
    console.log("Loading fields from API:", apiUrl);
    fetch('/editor/fetch_fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: apiUrl })
    })
    .then(response => {
      console.log("Received response from fetch_fields with status:", response.status);
      return response.json();
    })
    .then(data => {
      if (data.error) {
        alert("Error: " + data.error);
        console.error("Error in fetch_fields:", data.error);
        return;
      }
      console.log("Fields loaded:", data.fields);
      updateFieldsUI(data.fields);
      // Save the loaded fields for later use.
      window.currentGeoJSON = data.geojson || {};
    })
    .catch(err => {
      console.error("Error loading fields:", err);
      alert("Failed to load fields.");
    });
  });

  // ---------------------------------------------------------------------------
  // Update the Fields UI in the API Fields section.
  // ---------------------------------------------------------------------------
  function updateFieldsUI(fields) {
    const container = document.getElementById('fields-container');
    container.innerHTML = "";
    // "All Fields" toggle.
    const allFieldsDiv = document.createElement('div');
    allFieldsDiv.classList.add('input-group');
    allFieldsDiv.innerHTML = '<label><input type="checkbox" id="all-fields" checked> All Fields</label>';
    container.appendChild(allFieldsDiv);
    // Header row.
    const headerRow = document.createElement('div');
    headerRow.classList.add('field-row', 'header');
    headerRow.innerHTML = "<span class='field-name'>Name</span><span class='field-type'>Data Type</span><span class='field-select'>Select</span>";
    container.appendChild(headerRow);
    // For each field, create a row.
    fields.forEach(field => {
      const row = document.createElement('div');
      row.classList.add('field-row');
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('field-name');
      nameSpan.textContent = field;
      const typeSpan = document.createElement('span');
      typeSpan.classList.add('field-type');
      typeSpan.textContent = predictFieldType(field);
      const selectSpan = document.createElement('span');
      selectSpan.classList.add('field-select');
      const checkbox = document.createElement('input');
      checkbox.type = "checkbox";
      checkbox.value = field;
      checkbox.checked = true;
      checkbox.addEventListener('change', function() {
        const allCbs = container.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
        const allChecked = Array.from(allCbs).every(cb => cb.checked);
        document.getElementById('all-fields').checked = allChecked;
      });
      selectSpan.appendChild(checkbox);
      row.appendChild(nameSpan);
      row.appendChild(typeSpan);
      row.appendChild(selectSpan);
      container.appendChild(row);
    });
    bindAllFieldsToggle();
  }

  function bindAllFieldsToggle() {
    const allFieldsCheckbox = document.getElementById('all-fields');
    if (allFieldsCheckbox) {
      allFieldsCheckbox.addEventListener('change', function() {
        const fieldRows = document.querySelectorAll('#fields-container .field-row:not(.header)');
        fieldRows.forEach(row => {
          const cb = row.querySelector('input[type="checkbox"]');
          if (cb) { cb.checked = allFieldsCheckbox.checked; }
        });
      });
    }
  }

  // Simple predictor to guess field type.
  function predictFieldType(fieldName) {
    const lower = fieldName.toLowerCase();
    if (lower.includes("id") || lower.includes("number") || lower.includes("area") || lower.includes("value") || lower.includes("count") || lower.includes("accuracy")) {
      return "Quantitative";
    }
    return "Qualitative";
  }
  window.predictFieldType = predictFieldType;

  // ---------------------------------------------------------------------------
  // Build configuration for API preview.
  // ---------------------------------------------------------------------------
  function buildConfig() {
    const apiUrl = document.getElementById('api-url-input').value;
    const container = document.getElementById('fields-container');
    const checkboxes = container.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
    let selectedFields = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (checkboxes.length > 0 && selectedFields.length === checkboxes.length) {
      selectedFields = "*";
    }
    const outReturnGeometry = document.getElementById('out-return-geometry').checked;
    const outReturnIds = document.getElementById('out-return-ids').checked;
    const outReturnCount = document.getElementById('out-return-count').checked;
    const previewLimit = document.getElementById('preview-limit').value;
    const spatialInput = document.getElementById('spatial-input-select').value;
    let inSR = "", spatialRel = "";
    if (spatialInput === "Envelope") {
      inSR = document.getElementById('inSR-input').value;
      spatialRel = document.getElementById('spatial-rel-select').value;
    }
    const outSR = document.getElementById('outSR-input').value;
    const config = {
      api_url: apiUrl,
      selected_fields: selectedFields,
      preview_limit: previewLimit,
      where: document.getElementById('where-input').value || "1=1",
      spatial_input: spatialInput,
      output_options: {
        returnGeometry: outReturnGeometry,
        returnIdsOnly: outReturnIds,
        returnCountOnly: outReturnCount,
        outSR: outSR
      }
    };
    if (spatialInput === "Envelope") {
      config.inSR = inSR;
      config.spatialRel = spatialRel;
    }
    const advParamsText = document.getElementById('advanced-params').value;
    if (advParamsText) {
      try {
        config.advanced_params = JSON.parse(advParamsText);
      } catch (e) {
        alert("Error parsing advanced query parameters: " + e);
      }
    }
    console.log("Configuration built:", config);
    return config;
  }

  // ---------------------------------------------------------------------------
  // Update preview by generating API URL and executing it.
  // ---------------------------------------------------------------------------
  function updatePreview() {
    const config = buildConfig();
    console.log("Updating preview with config:", config);
    fetch('/editor/generate_preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    .then(response => {
      console.log("generate_preview response status:", response.status);
      return response.json();
    })
    .then(previewData => {
      window.generatedCode = window.generatedCode || {};
      window.generatedCode.api = previewData.api;
      console.log("Preview API code received:", previewData.api);
      return fetch('/editor/execute_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    })
    .then(response => {
      console.log("execute_api response status:", response.status);
      return response.json();
    })
    .then(executeData => {
      window.generatedCode.api_response = executeData.api_response;
      window.currentGeoJSON = executeData.api_response;
      refreshCodePreview();
    })
    .catch(err => {
      console.error("Error in updatePreview:", err);
    });
  }

  // ---------------------------------------------------------------------------
  // Refresh code preview area.
  // ---------------------------------------------------------------------------
  function refreshCodePreview() {
    const codeType = document.getElementById('code-type-select').value;
    const codePreview = document.getElementById('code-preview');
    if (codeType === 'txt') {
      let txtSummary = "Qualitative Fields Summary:\n";
      if (window.fieldAnalysis && window.fieldAnalysis.qualitative_fields) {
        for (const field in window.fieldAnalysis.qualitative_fields) {
          txtSummary += `Field: ${field}\n`;
          const counts = window.fieldAnalysis.qualitative_fields[field].counts;
          for (const prop in counts) {
            txtSummary += `  ${prop}: ${counts[prop]}\n`;
          }
        }
      } else {
        txtSummary = "No qualitative analysis data available.";
      }
      codePreview.value = txtSummary;
    } else {
      let previewContent = window.generatedCode ? window.generatedCode[codeType] || "" : "// Preview will appear here.";
      if (typeof previewContent === 'object') {
        previewContent = JSON.stringify(previewContent, null, 2);
      }
      codePreview.value = previewContent;
    }
  }
  window.refreshCodePreview = refreshCodePreview;

  // ---------------------------------------------------------------------------
  // Event listeners for update preview, code type selection, and copy button.
  // ---------------------------------------------------------------------------
  document.getElementById('update-preview').addEventListener('click', updatePreview);
  document.getElementById('code-type-select').addEventListener('change', refreshCodePreview);
  document.getElementById('copy-code').addEventListener('click', function() {
    const codePreview = document.getElementById('code-preview');
    codePreview.select();
    document.execCommand("copy");
    alert("Code copied to clipboard!");
  });

  // ---------------------------------------------------------------------------
  // Resizer functionality for the main editor panels.
  // ---------------------------------------------------------------------------
  const resizer = document.querySelector('.resizer');
  const leftPanel = document.querySelector('.editor-options');
  const rightPanel = document.querySelector('.editor-preview');
  const container = document.querySelector('.editor-wrapper');

  let isResizing = false;
  resizer.addEventListener('mousedown', function(e) {
    isResizing = true;
    document.body.style.cursor = 'ew-resize';
  });

  const minRightWidth = 300;
  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    const containerRect = container.getBoundingClientRect();
    let newLeftWidth = e.clientX - containerRect.left;
    const minWidth = 250;
    const maxWidth = containerRect.width - minRightWidth;
    if (newLeftWidth < minWidth) newLeftWidth = minWidth;
    if (newLeftWidth > maxWidth) newLeftWidth = maxWidth;
    leftPanel.style.flex = '0 0 ' + newLeftWidth + 'px';
  });

  document.addEventListener('mouseup', function(e) {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
    }
  });

  console.log("Integrated editor.js loaded successfully.");
});
