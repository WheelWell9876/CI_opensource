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
      // After fields are loaded, update JSON editor and quant/qual options.
      updateJSONEditor();
      updateQuantQualOptions();
      // For testing, save the loaded fields as GeoJSON to window.currentGeoJSON for later processing.
      window.currentGeoJSON = data.geojson || {};  // assuming the response might include a GeoJSON object
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
      // When a field is toggled, update the JSON editor and Quant/Qual options.
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
    const jsonEditor = document.getElementById('json-editor');
    jsonEditor.innerHTML = "";
    selectedFields.forEach(field => {
      const prediction = predictFieldType(field);
      // Create a collapsible block for each field.
      const fieldBlock = document.createElement('div');
      fieldBlock.classList.add('json-field');
      fieldBlock.style.border = "1px solid #ccc";
      fieldBlock.style.marginBottom = "10px";
      fieldBlock.style.padding = "5px";
      fieldBlock.innerHTML = `
        <div class="json-field-header">
          <h4>${field} <span class="prediction-box">(Prediction: ${prediction})</span></h4>
        </div>
        <div class="props-content"></div>
        <div class="edit-group">
          <label>Weight: <input type="number" step="0.01" name="${field}_weight"></label><br>
          <label>Meaning: <input type="text" name="${field}_meaning"></label><br>
          <label>Importance: <input type="text" name="${field}_importance"></label><br>
          <label>Grade: <input type="number" step="0.01" name="${field}_grade"></label>
        </div>
      `;
      jsonEditor.appendChild(fieldBlock);
    });
    updateJSONEditorQual(selectedFields);
    updateJSONEditorQuant(selectedFields);
  }

  // ---------------------------------------------------------------------------
  // Update the qualitative fields section.
  // ---------------------------------------------------------------------------
    function updateJSONEditorQual(selectedFields) {
      const qualContainer = document.getElementById('qualitative-fields-container');
      qualContainer.innerHTML = "";
      selectedFields.forEach(field => {
        if (predictFieldType(field) === "Qualitative") {
          const fieldContainer = document.createElement('div');
          fieldContainer.classList.add('json-qual-field');
          fieldContainer.style.border = "1px solid #ccc";
          fieldContainer.style.marginBottom = "10px";
          fieldContainer.style.padding = "5px";

          const title = document.createElement('h4');
          title.textContent = `${field} (Qualitative)`;
          fieldContainer.appendChild(title);

          if (window.fieldAnalysis && window.fieldAnalysis.qualitative_fields && window.fieldAnalysis.qualitative_fields[field]) {
            const counts = window.fieldAnalysis.qualitative_fields[field].counts;
            for (const prop in counts) {
              const propBox = document.createElement('div');
              propBox.classList.add('bento-box');
              propBox.style.margin = "5px 0";
              propBox.innerHTML = `
                <strong>${prop}</strong> (Count: ${counts[prop]})<br>
                <div class="edit-group">
                  <label>Weight: <input type="number" step="0.01" name="${field}_${prop}_weight"></label>
                  <label>Meaning: <input type="text" name="${field}_${prop}_meaning"></label>
                  <label>Importance: <input type="text" name="${field}_${prop}_importance"></label>
                  <label>Grade: <input type="number" step="0.01" name="${field}_${prop}_grade"></label>
                </div>
              `;
              fieldContainer.appendChild(propBox);
            }
          } else {
            fieldContainer.innerHTML += `<em>No Data Available</em>`;
          }
          qualContainer.appendChild(fieldContainer);
        }
      });
    }




  // ---------------------------------------------------------------------------
  // Update the quantitative fields section.
  // ---------------------------------------------------------------------------
    function updateJSONEditorQuant(selectedFields) {
      const quantContainer = document.getElementById('quantitative-fields-container');
      quantContainer.innerHTML = "";
      selectedFields.forEach(field => {
        if (predictFieldType(field) === "Quantitative") {
          const div = document.createElement('div');
          div.classList.add('json-quant-field');
          let metricsHtml = `<p>No metrics processed yet.</p>`;
          if (
            window.fieldAnalysis &&
            window.fieldAnalysis.quantitative_fields &&
            window.fieldAnalysis.quantitative_fields[field]
          ) {
            const metrics = window.fieldAnalysis.quantitative_fields[field].metrics;
            metricsHtml = `<pre>${JSON.stringify(metrics, null, 2)}</pre>`;
          }
          div.innerHTML = `
            <strong>${field}</strong> - <em>Quantitative Metrics</em>
            <div id="${field}_quant_metrics">
              ${metricsHtml}
            </div>
            <div class="edit-group">
              <label>Weight: <input type="number" step="0.01" name="${field}_weight" /></label><br>
              <label>Meaning: <input type="text" name="${field}_meaning" /></label><br>
              <label>Importance: <input type="text" name="${field}_importance" /></label><br>
              <label>Grade: <input type="number" step="0.01" name="${field}_grade" /></label>
            </div>
          `;
          quantContainer.appendChild(div);
        }
      });
    }

    function updateJSONBuilderPreview() {
      const categoryType = document.getElementById('category-type-select').value;
      let categoryName = "";
      if (categoryType === 'new') {
        categoryName = document.getElementById('new-category-input').value;
      } else {
        categoryName = document.getElementById('dataset-select').value;
      }
      document.getElementById('category-name-display').textContent = categoryName;

      const datasetName = document.getElementById('dataset-name').value;
      document.getElementById('dataset-name-display').textContent = datasetName;

      const fieldsLevel = document.getElementById('fields-level');
      fieldsLevel.innerHTML = "";
      const jsonFields = document.querySelectorAll('.json-field');
      jsonFields.forEach(fieldDiv => {
        const fieldTitle = fieldDiv.querySelector('h4').textContent;
        const fieldBox = document.createElement('div');
        fieldBox.classList.add('bento-box');
        fieldBox.style.marginBottom = "5px";
        fieldBox.innerHTML = `<strong>${fieldTitle}</strong>`;
        fieldsLevel.appendChild(fieldBox);
      });
    }

    document.getElementById('category-type-select').addEventListener('change', function() {
      const newCatContainer = document.getElementById('new-category-input-container');
      newCatContainer.style.display = (this.value === 'new') ? 'block' : 'none';
      updateJSONBuilderPreview();
    });

    document.getElementById('dataset-select').addEventListener('change', updateJSONBuilderPreview);
    document.getElementById('dataset-name').addEventListener('input', updateJSONBuilderPreview);


  // ---------------------------------------------------------------------------
  // Process Fields Button – Call the processing endpoint for field analysis.
  // ---------------------------------------------------------------------------
    function processFieldAnalysis() {
      console.log("processFieldAnalysis: Sending geojson to /editor/process_fields...");
      const geojson = window.currentGeoJSON;
      fetch('/editor/process_fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson)
      })
      .then(response => {
        console.log("processFieldAnalysis: Received response status", response.status);
        return response.json();
      })
      .then(analysisData => {
        console.log("processFieldAnalysis: Received analysis data:", analysisData);
        // Save analysis data globally
        window.fieldAnalysis = analysisData;
        // Update the JSON editor UI based on the new analysis
        updateJSONEditorFromAnalysis();
      })
      .catch(err => {
        console.error("Error in processFieldAnalysis:", err);
      });
    }

    // Updated Qualitative Fields Rendering with Nested Property Objects
    function updateJSONEditorFromAnalysis() {
      const qualContainer = document.getElementById('qualitative-fields-container');
      const quantContainer = document.getElementById('quantitative-fields-container');
      // Clear any previous content.
      qualContainer.innerHTML = "";
      quantContainer.innerHTML = "";

      // Updated Qualitative Fields Section:
      if (window.fieldAnalysis && window.fieldAnalysis.qualitative_fields) {
        for (const field in window.fieldAnalysis.qualitative_fields) {
          const analysis = window.fieldAnalysis.qualitative_fields[field];
          const div = document.createElement('div');
          div.classList.add('json-qual-field');
          div.style.border = "1px solid #ccc";
          div.style.marginBottom = "10px";
          div.style.padding = "5px";
          let html = `<h4>${field} <span class="prediction-box">(Prediction: Qualitative)</span></h4>`;
          // Create a nested box for each qualitative property
          if (analysis.counts) {
            for (const prop in analysis.counts) {
              html += `
                <div class="bento-box" style="margin: 5px 0;">
                  <strong>${prop}</strong> (Count: ${analysis.counts[prop]})<br>
                  <div class="edit-group">
                    <label>Weight: <input type="number" step="0.01" name="${field}_${prop}_weight"></label>
                    <label>Meaning: <input type="text" name="${field}_${prop}_meaning"></label>
                    <label>Importance: <input type="text" name="${field}_${prop}_importance"></label>
                    <label>Grade: <input type="number" step="0.01" name="${field}_${prop}_grade"></label>
                  </div>
                </div>
              `;
            }
          } else {
            html += `<em>No Data Available</em>`;
          }
          // Optionally add overall settings for the field
          html += `
            <div class="edit-group">
              <label>Overall Weight: <input type="number" step="0.01" name="${field}_weight"></label><br>
              <label>Overall Meaning: <input type="text" name="${field}_meaning"></label><br>
              <label>Overall Importance: <input type="text" name="${field}_importance"></label><br>
              <label>Overall Grade: <input type="number" step="0.01" name="${field}_grade"></label>
            </div>
          `;
          div.innerHTML = html;
          qualContainer.appendChild(div);
        }
      }

      // (The quantitative section remains unchanged)
      if (window.fieldAnalysis && window.fieldAnalysis.quantitative_fields) {
        for (const field in window.fieldAnalysis.quantitative_fields) {
          const analysis = window.fieldAnalysis.quantitative_fields[field];
          let metricsHtml = `<p>No metrics processed yet.</p>`;
          if (analysis.metrics) {
            metricsHtml = `<pre>${JSON.stringify(analysis.metrics, null, 2)}</pre>`;
          }
          const div = document.createElement('div');
          div.classList.add('json-quant-field');
          div.style.border = "1px solid #ccc";
          div.style.marginBottom = "10px";
          div.style.padding = "5px";
          div.innerHTML = `
            <h4>${field} <span class="prediction-box">(Prediction: Quantitative)</span></h4>
            <div id="${field}_quant_metrics">
              ${metricsHtml}
            </div>
            <div class="edit-group">
              <label>Weight: <input type="number" step="0.01" name="${field}_weight"></label><br>
              <label>Meaning: <input type="text" name="${field}_meaning"></label><br>
              <label>Importance: <input type="text" name="${field}_importance"></label><br>
              <label>Grade: <input type="number" step="0.01" name="${field}_grade"></label>
            </div>
          `;
          quantContainer.appendChild(div);
        }
      }

      // Save processed fields for use elsewhere.
      window.generatedCode = window.generatedCode || {};
      window.generatedCode.processedFields = window.fieldAnalysis;
      refreshCodePreview();
    }



  // ---------------------------------------------------------------------------
  // Render analysis results into the JSON Options UI.
  // ---------------------------------------------------------------------------
  function renderFieldAnalysis(analysis) {
    console.log("renderFieldAnalysis: Rendering field analysis:", analysis);
    // Update qualitative fields preview.
    const qualContainer = document.getElementById('qualitative-fields-container');
    for (const field in analysis.qualitative_fields) {
      const fieldData = analysis.qualitative_fields[field];
      // Find the matching field wrapper in qualContainer.
      const wrapper = Array.from(qualContainer.getElementsByClassName('json-field'))
                              .find(div => div.querySelector('.json-field-header') && div.querySelector('.json-field-header').textContent.includes(field));
      if (wrapper) {
        wrapper.querySelector('.props-content').innerHTML =
          `<em>Counts:</em> ${JSON.stringify(fieldData.counts, null, 2)}`;
      }
    }
    // Update quantitative fields preview.
    const quantContainer = document.getElementById('quantitative-fields-container');
    for (const field in analysis.quantitative_fields) {
      const fieldData = analysis.quantitative_fields[field];
      const wrapper = Array.from(quantContainer.getElementsByClassName('json-field'))
                              .find(div => div.querySelector('.json-field-header') && div.querySelector('.json-field-header').textContent.includes(field));
      if (wrapper) {
        wrapper.querySelector('.props-content').innerHTML =
          `<em>Metrics:</em> ${JSON.stringify(fieldData.metrics, null, 2)}`;
      }
    }
    window.generatedCode = window.generatedCode || {};
    window.generatedCode.processedFields = analysis;
    refreshCodePreview();
  }

  // ---------------------------------------------------------------------------
  // Attach event listener to the "Process Fields" button.
  // ---------------------------------------------------------------------------
  const processFieldsBtn = document.getElementById('process-fields-btn');
  if (processFieldsBtn) {
    processFieldsBtn.addEventListener('click', processFieldAnalysis);
  } else {
    console.warn("Process Fields button (#process-fields-btn) not found in the DOM.");
  }

  // ---------------------------------------------------------------------------
  // Create JSON Button – Build dataset JSON from the JSON Editor values.
  // ---------------------------------------------------------------------------
  document.getElementById('create-json-btn').addEventListener('click', function() {
    const jsonEditor = document.getElementById('json-editor');
    const fieldDivs = jsonEditor.querySelectorAll('.json-field');
    let qualitativeFields = [];
    let quantitativeFields = [];
    fieldDivs.forEach(div => {
      const fieldName = div.querySelector('h4').textContent.split(' (Prediction:')[0].trim();
      const weight = div.querySelector(`input[name="${fieldName}_weight"]`).value;
      const meaning = div.querySelector(`input[name="${fieldName}_meaning"]`).value;
      const importance = div.querySelector(`input[name="${fieldName}_importance"]`).value;
      const grade = div.querySelector(`input[name="${fieldName}_grade"]`).value;
      const predictionText = div.querySelector('.prediction-box').textContent;
      if (predictionText.includes("Qualitative")) {
        qualitativeFields.push({
          fieldName: fieldName,
          type: "String",
          meaning: meaning,
          importance: importance,
          overallFieldImportanceGrade: parseFloat(grade)
        });
      } else {
        quantitativeFields.push({
          fieldName: fieldName,
          type: "Float",
          meaning: meaning,
          importance: importance
        });
      }
    });
    let removedFields = []; // (Assume none for now.)
    let allGrades = {};
    qualitativeFields.concat(quantitativeFields).forEach(field => {
      allGrades[field.fieldName] = parseFloat(field.overallFieldImportanceGrade || 0);
    });
    const datasetName = document.getElementById('dataset-name').value;
    const datasetLink = document.getElementById('dataset-link').value;
    const datasetJSON = {
      datasetName: datasetName,
      datasetLink: datasetLink,
      qualitativeFields: qualitativeFields,
      quantitativeProperties: quantitativeFields,
      removedFields: removedFields,
      summaryOfGrades: allGrades
    };
    console.log("Creating JSON with dataset object:", datasetJSON);
    fetch('/editor/create_json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datasetJSON)
    })
    .then(response => response.json())
    .then(data => {
      window.generatedCode = window.generatedCode || {};
      window.generatedCode.json = data;
      refreshCodePreview();
    })
    .catch(err => {
      console.error("Error creating JSON:", err);
      alert("Error creating JSON: " + err);
    });
  });

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
  // Update preview: first generate API URL then execute it.
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
  // Refresh the code preview area.
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
  // (For debugging) Log that the integrated JS file has loaded.
  // ---------------------------------------------------------------------------
  console.log("Integrated editor.js loaded successfully.");
});