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

  // ---------------------------------------------------------------------------
  // Populate provided APIs dropdown.
  // ---------------------------------------------------------------------------
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
  // Load fields from API and update the UI, JSON editor, and Quant/Qual options.
  // ---------------------------------------------------------------------------
  document.getElementById('load-fields').addEventListener('click', function() {
    const apiUrl = document.getElementById('api-url-input').value;
    if (!apiUrl) {
      alert("Please enter an API URL.");
      return;
    }
    fetch('/editor/fetch_fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_url: apiUrl })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }
      updateFieldsUI(data.fields);
      // Update JSON editor and quant/qual options based on all fields (initially all are selected).
      updateJSONEditor();
      updateQuantQualOptions();
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
      // Use our predictor to display predicted type.
      typeSpan.textContent = predictFieldType(field);
      const selectSpan = document.createElement('span');
      selectSpan.classList.add('field-select');
      const checkbox = document.createElement('input');
      checkbox.type = "checkbox";
      checkbox.value = field;
      checkbox.checked = true;
      // Update JSON editor when a field is toggled.
      checkbox.addEventListener('change', function() {
        const allCbs = container.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
        const allChecked = Array.from(allCbs).every(cb => cb.checked);
        document.getElementById('all-fields').checked = allChecked;
        updateJSONEditor();
        updateQuantQualOptions();
      });
      selectSpan.appendChild(checkbox);
      row.appendChild(nameSpan);
      row.appendChild(typeSpan);
      row.appendChild(selectSpan);
      container.appendChild(row);
    });
    bindAllFieldsToggle();
  }

  // ---------------------------------------------------------------------------
  // Bind "All Fields" toggle.
  // ---------------------------------------------------------------------------
  function bindAllFieldsToggle() {
    const allFieldsCheckbox = document.getElementById('all-fields');
    if (allFieldsCheckbox) {
      allFieldsCheckbox.addEventListener('change', function() {
        const fieldRows = document.querySelectorAll('#fields-container .field-row:not(.header)');
        fieldRows.forEach(row => {
          const cb = row.querySelector('input[type="checkbox"]');
          if (cb) { cb.checked = allFieldsCheckbox.checked; }
        });
        updateJSONEditor();
        updateQuantQualOptions();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Simple Predictor function to guess field type.
  // ---------------------------------------------------------------------------
  function predictFieldType(fieldName) {
    const lower = fieldName.toLowerCase();
    // A simple heuristic: if field name contains "id", "number", "area", "value", "count", or "accuracy", assume quantitative.
    if (lower.includes("id") || lower.includes("number") || lower.includes("area") || lower.includes("value") || lower.includes("count") || lower.includes("accuracy")) {
      return "Quantitative";
    }
    return "Qualitative";
  }

  // ---------------------------------------------------------------------------
  // Update the JSON Editor section based on selected fields.
  // ---------------------------------------------------------------------------
  function updateJSONEditor() {
    const container = document.getElementById('fields-container');
    const checkboxes = container.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
    const selectedFields = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const jsonContainer = document.getElementById('json-editor');
    jsonContainer.innerHTML = "";
    selectedFields.forEach(field => {
      const prediction = predictFieldType(field);
      const fieldDiv = document.createElement('div');
      fieldDiv.classList.add('json-field');
      fieldDiv.style.border = "1px solid #ccc";
      fieldDiv.style.marginBottom = "10px";
      fieldDiv.style.padding = "5px";
      fieldDiv.innerHTML = `
        <h4>${field} <span class="prediction-box">(Prediction: ${prediction})</span></h4>
        <label>Weight: <input type="number" step="0.01" name="${field}_weight" placeholder="e.g. 0.1"></label><br>
        <label>Meaning: <input type="text" name="${field}_meaning" placeholder="Enter meaning"></label><br>
        <label>Importance: <input type="text" name="${field}_importance" placeholder="Enter importance"></label><br>
        <label>Grade: <input type="number" step="0.01" name="${field}_grade" placeholder="Normalized grade"></label>
      `;
      jsonContainer.appendChild(fieldDiv);
    });
  }

  // ---------------------------------------------------------------------------
  // Update Quant/Qual Options UI based on selected fields.
  // ---------------------------------------------------------------------------
  function updateQuantQualOptions() {
    const container = document.getElementById('quant-qual-section');
    const fieldsContainer = document.getElementById('fields-container');
    const checkboxes = fieldsContainer.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
    const selectedFields = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    container.innerHTML = "";
    selectedFields.forEach(field => {
      const prediction = predictFieldType(field);
      const row = document.createElement('div');
      row.style.marginBottom = "5px";
      row.innerHTML = `
        <span style="font-weight:bold;">${field}</span>
        <span style="margin-left:10px; font-style: italic;">(${prediction})</span>
        <label style="margin-left:10px;">
          <input type="checkbox" class="quant-field" value="${field}" /> Quantitative
        </label>
        <label style="margin-left:10px;">
          <input type="checkbox" class="qual-field" value="${field}" /> Qualitative
        </label>
      `;
      container.appendChild(row);
    });
    // Append a button to generate Python function code.
    const pyGenerateBtn = document.createElement('button');
    pyGenerateBtn.textContent = "Generate Python Function";
    pyGenerateBtn.addEventListener('click', generatePythonFunction);
    container.appendChild(pyGenerateBtn);
  }

  // ---------------------------------------------------------------------------
  // JSON file upload handler.
  // ---------------------------------------------------------------------------
  document.getElementById('json-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const jsonData = JSON.parse(e.target.result);
          if (validateJSONStructure(jsonData)) {
            populateJSONEditorFromData(jsonData);
          } else {
            alert("Uploaded JSON does not match the required structure.");
          }
        } catch(err) {
          alert("Error parsing JSON file: " + err);
        }
      }
      reader.readAsText(file);
    }
  });

  // --- Handle JSON Maker: create JSON structure from user inputs ---
    document.getElementById('create-json-btn').addEventListener('click', function() {
      // Read dataset-level inputs.
      const datasetName = document.getElementById('dataset-name').value;
      const datasetLink = document.getElementById('dataset-link').value;

      // Gather the fields that the user has edited in the JSON editor.
      // (Assumes that each field is rendered as a .json-field div with inputs named like:
      //  "[fieldName]_weight", "[fieldName]_meaning", "[fieldName]_importance", "[fieldName]_grade")
      const jsonFields = document.querySelectorAll('#json-editor .json-field');
      let qualitativeFields = [];
      let quantitativeFields = [];

      jsonFields.forEach(fieldDiv => {
        // Extract field name from the header; assume header text is like "FIELD_NAME (Prediction: X)"
        const header = fieldDiv.querySelector('h4');
        let fieldName = header.textContent.split(' (Prediction:')[0].trim();

        // Get the input values for weight, meaning, importance, and grade.
        const weight = parseFloat(fieldDiv.querySelector(`input[name="${fieldName}_weight"]`).value) || 0;
        const meaning = fieldDiv.querySelector(`input[name="${fieldName}_meaning"]`).value;
        const importance = fieldDiv.querySelector(`input[name="${fieldName}_importance"]`).value;
        const grade = parseFloat(fieldDiv.querySelector(`input[name="${fieldName}_grade"]`).value) || 0;

        // Use the predictor function to determine if this field is quantitative or qualitative.
        const prediction = predictFieldType(fieldName);
        const fieldObj = {
          fieldName: fieldName,
          type: (prediction === "Quantitative") ? "Float" : "String",
          meaning: meaning,
          importance: importance,
          overallFieldImportanceGrade: grade
        };

        // For qualitative fields, you may later add a UI for editing their sub-properties.
        if (prediction === "Qualitative") {
          fieldObj.qualitativeProperties = []; // Initialize an empty list; user can add properties later.
          qualitativeFields.push(fieldObj);
        } else {
          quantitativeFields.push(fieldObj);
        }
      });

      // Determine removed fields from the API fields UI.
      // (Assumes that the API fields container checkboxes reflect the available fields.)
      const fieldsCheckboxes = document.querySelectorAll('#fields-container .field-row:not(.header) input[type="checkbox"]');
      let removedFields = [];
      fieldsCheckboxes.forEach(cb => {
        if (!cb.checked) {
          removedFields.push({
            fieldName: cb.value,
            type: "String", // Default type; adjust if needed.
            meaning: "",
            importance: ""
          });
        }
      });

      // Build a field grade summary by reading each field's grade from the JSON editor.
      let totalGrade = 0;
      let fieldGradeSummary = {};
      jsonFields.forEach(fieldDiv => {
        const header = fieldDiv.querySelector('h4');
        let fieldName = header.textContent.split(' (Prediction:')[0].trim();
        const grade = parseFloat(fieldDiv.querySelector(`input[name="${fieldName}_grade"]`).value) || 0;
        fieldGradeSummary[fieldName] = grade;
        totalGrade += grade;
      });
      // Normalize the summary so that the grades sum to 1.
      Object.keys(fieldGradeSummary).forEach(key => {
        fieldGradeSummary[key] = fieldGradeSummary[key] / totalGrade;
      });

      // Build the dataset JSON object without dummy data.
      const datasetJSON = {
        datasetName: datasetName,
        datasetLink: datasetLink,
        qualitativeFields: qualitativeFields,
        quantitativeProperties: quantitativeFields,
        removedFields: removedFields,
        summaryOfGrades: fieldGradeSummary
      };

      // Send the constructed dataset JSON to the backend endpoint.
      fetch('/editor/create_json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datasetJSON)
      })
      .then(response => response.json())
      .then(data => {
        // Save the generated JSON and refresh the preview.
        window.generatedCode = window.generatedCode || {};
        window.generatedCode.json = data;
        refreshCodePreview();
      })
      .catch(err => {
        console.error("Error creating JSON:", err);
        alert("Failed to create JSON: " + err);
      });
    });


  function validateJSONStructure(data) {
    return data.hasOwnProperty("datasetName") && data.hasOwnProperty("qualitativeFields");
  }

  function populateJSONEditorFromData(data) {
    const jsonContainer = document.getElementById('json-editor');
    jsonContainer.innerHTML = "";
    data.qualitativeFields.forEach(fieldObj => {
      const prediction = predictFieldType(fieldObj.fieldName);
      const fieldDiv = document.createElement('div');
      fieldDiv.classList.add('json-field');
      fieldDiv.style.border = "1px solid #ccc";
      fieldDiv.style.marginBottom = "10px";
      fieldDiv.style.padding = "5px";
      fieldDiv.innerHTML = `
        <h4>${fieldObj.fieldName} (Prediction: ${prediction})</h4>
        <label>Meaning: <input type="text" name="${fieldObj.fieldName}_meaning" value="${fieldObj.meaning}" /></label><br>
        <label>Importance: <input type="text" name="${fieldObj.fieldName}_importance" value="${fieldObj.importance}" /></label><br>
        <label>Overall Field Grade: <input type="number" step="0.01" name="${fieldObj.fieldName}_grade" value="${fieldObj.overallFieldImportanceGrade || ''}" /></label>
      `;
      jsonContainer.appendChild(fieldDiv);
    });
  }

  // ---------------------------------------------------------------------------
  // Generate Python function code based on Quant/Qual selections.
  // ---------------------------------------------------------------------------
  function generatePythonFunction() {
    const quantFields = Array.from(document.querySelectorAll('.quant-field:checked')).map(cb => cb.value);
    const qualFields = Array.from(document.querySelectorAll('.qual-field:checked')).map(cb => cb.value);
    let pythonCode = "import json\nimport numpy as np\n\ndef quant_and_qual_analysis(geojson_path):\n";
    pythonCode += "    with open(geojson_path, 'r') as f:\n";
    pythonCode += "        data = json.load(f)\n";
    pythonCode += "    quant_stats = {}\n";
    pythonCode += "    qual_counts = {}\n";
    pythonCode += `    quant_fields = ${JSON.stringify(quantFields)}\n`;
    pythonCode += `    qual_fields = ${JSON.stringify(qualFields)}\n`;
    pythonCode += "    for (let field of quant_fields) {\n";
    pythonCode += "        quant_stats[field] = [];\n";
    pythonCode += "    }\n";
    pythonCode += "    for (let field of qual_fields) {\n";
    pythonCode += "        qual_counts[field] = {};\n";
    pythonCode += "    }\n";
    pythonCode += "    for (let feature of data['features']) {\n";
    pythonCode += "        let props = feature['properties'];\n";
    pythonCode += "        for (let field of quant_fields) {\n";
    pythonCode += "            if (props.hasOwnProperty(field) && typeof props[field] === 'number') {\n";
    pythonCode += "                quant_stats[field].push(props[field]);\n";
    pythonCode += "            }\n";
    pythonCode += "        }\n";
    pythonCode += "        for (let field of qual_fields) {\n";
    pythonCode += "            if (props.hasOwnProperty(field)) {\n";
    pythonCode += "                let value = props[field];\n";
    pythonCode += "                qual_counts[field][value] = (qual_counts[field][value] || 0) + 1;\n";
    pythonCode += "            }\n";
    pythonCode += "        }\n";
    pythonCode += "    }\n";
    pythonCode += "    return quant_stats, qual_counts;\n";
    window.generatedCode = window.generatedCode || {};
    window.generatedCode.python = pythonCode;
    refreshCodePreview();
  }

  // ---------------------------------------------------------------------------
  // Build configuration object from current UI values.
  // ---------------------------------------------------------------------------
  function buildConfig() {
    const apiUrl = document.getElementById('api-url-input').value;
    const fieldsContainer = document.getElementById('fields-container');
    const checkboxes = fieldsContainer.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
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
    return config;
  }

  // ---------------------------------------------------------------------------
  // Update preview: first generate API URL then execute it.
  // ---------------------------------------------------------------------------
  function updatePreview() {
    const config = buildConfig();
    // Generate the API creation preview (URL).
    fetch('/editor/generate_preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    .then(response => response.json())
    .then(previewData => {
      window.generatedCode = window.generatedCode || {};
      window.generatedCode.api = previewData.api;
      // Now execute the updated API.
      return fetch('/editor/execute_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    })
    .then(response => response.json())
    .then(executeData => {
      window.generatedCode.api_response = executeData.api_response;
      refreshCodePreview();
    })
    .catch(err => {
      console.error("Error in updatePreview:", err);
    });
  }

  // ---------------------------------------------------------------------------
  // Refresh the code preview area.
  // ---------------------------------------------------------------------------
  function refreshCodePreview() {
    const codeType = document.getElementById('code-type-select').value;
    const codePreview = document.getElementById('code-preview');
    let previewContent = window.generatedCode ? window.generatedCode[codeType] || "" : "// Preview will appear here.";
    if (typeof previewContent === 'object') {
      previewContent = JSON.stringify(previewContent, null, 2);
    }
    codePreview.value = previewContent;
  }

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
});
