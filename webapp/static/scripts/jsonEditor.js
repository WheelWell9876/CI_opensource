// All interactive JSON editor functionality
// (Assumes that functions like predictFieldType() and refreshCodePreview() are defined in editor.js.)

document.addEventListener('DOMContentLoaded', function() {

  // Update the JSON Editor based on selected fields from the API fields section.
  function updateJSONEditor() {
    const container = document.getElementById('fields-container');
    const checkboxes = container.querySelectorAll('.field-row:not(.header) input[type="checkbox"]');
    const selectedFields = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    updateJSONEditorQual(selectedFields);
    updateJSONEditorQuant(selectedFields);
  }

  // Render qualitative fields in the interactive JSON builder.
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

        if (window.fieldAnalysis &&
            window.fieldAnalysis.qualitative_fields &&
            window.fieldAnalysis.qualitative_fields[field]) {
          const counts = window.fieldAnalysis.qualitative_fields[field].counts;
          for (const prop in counts) {
            const propBox = document.createElement('div');
            propBox.classList.add('bento-box');
            propBox.style.margin = "5px 0";
            propBox.innerHTML = `
              <strong>${prop}</strong> (Count: ${counts[prop]})<br>
              <div class="edit-group">
                <label>Grade: <input type="number" step="0.01" name="${field}_${prop}_grade"></label>
              </div>
            `;
            fieldContainer.appendChild(propBox);
          }
        } else {
          fieldContainer.innerHTML += `<em>No Data Available</em>`;
        }
        fieldContainer.innerHTML += `
          <div class="edit-group">
            <label>Overall Grade: <input type="number" step="0.01" name="${field}_grade"></label>
          </div>
        `;
        qualContainer.appendChild(fieldContainer);
      }
    });
    initializeNestedResizers();
  }

  // Render quantitative fields in the interactive JSON builder.
  function updateJSONEditorQuant(selectedFields) {
    const quantContainer = document.getElementById('quantitative-fields-container');
    quantContainer.innerHTML = "";
    selectedFields.forEach(field => {
      if (predictFieldType(field) === "Quantitative") {
        const div = document.createElement('div');
        div.classList.add('json-quant-field');
        let metricsHtml = `<p>No metrics processed yet.</p>`;
        if (window.fieldAnalysis &&
            window.fieldAnalysis.quantitative_fields &&
            window.fieldAnalysis.quantitative_fields[field]) {
          const metrics = window.fieldAnalysis.quantitative_fields[field].metrics;
          metricsHtml = `<pre>${JSON.stringify(metrics, null, 2)}</pre>`;
        }
        div.innerHTML = `
          <strong>${field}</strong> - <em>Quantitative Metrics</em>
          <div id="${field}_quant_metrics">
            ${metricsHtml}
          </div>
          <div class="edit-group">
            <label>Grade: <input type="number" step="0.01" name="${field}_grade"></label>
          </div>
        `;
        quantContainer.appendChild(div);
      }
    });
    initializeNestedResizers();
  }

  // Build the JSON Builder Preview (category, dataset, nested fields preview)
  function updateJSONBuilderPreview() {
    const categoryType = document.getElementById('category-type-select').value;
    let categoryName = (categoryType === 'new') ?
                       document.getElementById('new-category-input').value :
                       document.getElementById('dataset-select').value;
    document.getElementById('category-name-display').textContent = categoryName;

    const datasetName = document.getElementById('dataset-name').value;
    document.getElementById('dataset-name-display').textContent = datasetName;

    const fieldsLevel = document.getElementById('fields-level');
    fieldsLevel.innerHTML = "";

    // Build qualitative fields preview.
    const qualContainer = document.getElementById('qualitative-fields-container');
    const qualFields = qualContainer.querySelectorAll('.json-qual-field');
    if (qualFields.length > 0) {
      const qualSection = document.createElement('div');
      qualSection.classList.add('builder-section');
      const qualHeader = document.createElement('h4');
      qualHeader.textContent = "Qualitative Fields";
      qualSection.appendChild(qualHeader);
      qualFields.forEach(field => {
        const fieldName = field.querySelector('h4').textContent.split(" (")[0].trim();
        const gradeInput = field.querySelector(`input[name="${fieldName}_grade"]`);
        const gradeValue = gradeInput ? gradeInput.value : "";
        const fieldPreview = document.createElement('div');
        fieldPreview.classList.add('field-preview');
        fieldPreview.innerHTML = `<strong>${fieldName}</strong> - Grade: <input type="number" value="${gradeValue}" step="0.01" />`;
        const propContainer = document.createElement('div');
        propContainer.classList.add('qual-properties');
        const propBoxes = field.querySelectorAll('.bento-box');
        propBoxes.forEach(propBox => {
          const propName = propBox.querySelector('strong').textContent;
          const propGradeInput = propBox.querySelector(`input[name="${fieldName+'_'+propName}_grade"]`);
          const propGradeValue = propGradeInput ? propGradeInput.value : "";
          const propPreview = document.createElement('div');
          propPreview.classList.add('property-preview');
          propPreview.innerHTML = `<span>${propName}</span> - Grade: <input type="number" value="${propGradeValue}" step="0.01" />`;
          propContainer.appendChild(propPreview);
        });
        fieldPreview.appendChild(propContainer);
        qualSection.appendChild(fieldPreview);
      });
      fieldsLevel.appendChild(qualSection);
    }

    // Build quantitative fields preview.
    const quantContainer = document.getElementById('quantitative-fields-container');
    const quantFields = quantContainer.querySelectorAll('.json-quant-field');
    if (quantFields.length > 0) {
      const quantSection = document.createElement('div');
      quantSection.classList.add('builder-section');
      const quantHeader = document.createElement('h4');
      quantHeader.textContent = "Quantitative Fields";
      quantSection.appendChild(quantHeader);
      quantFields.forEach(field => {
        const fieldName = field.querySelector('strong').textContent;
        const gradeInput = field.querySelector(`input[name="${fieldName}_grade"]`);
        const gradeValue = gradeInput ? gradeInput.value : "";
        const fieldPreview = document.createElement('div');
        fieldPreview.classList.add('field-preview');
        fieldPreview.innerHTML = `<strong>${fieldName}</strong> - Grade: <input type="number" value="${gradeValue}" step="0.01" />`;
        quantSection.appendChild(fieldPreview);
      });
      fieldsLevel.appendChild(quantSection);
    }
    initializeNestedResizers();
  }

  // Update JSON Editor using field analysis results.
    function updateJSONEditorFromAnalysis() {
      console.log("DEBUG: updateJSONEditorFromAnalysis called...");

      // 1) Find the active dataset editor
      const editorPane = getActiveDatasetEditor();
      if (!editorPane) {
        console.error("DEBUG: No active dataset editor found; cannot render fields.");
        return;
      }

      // 2) Find the containers in the active editor
      const qualContainer = editorPane.querySelector('.qualitative-fields-container');
      const quantContainer = editorPane.querySelector('.quantitative-fields-container');
      const fieldsLevel = editorPane.querySelector('.fields-level');

      console.log("DEBUG: Found containers:", {
        qualContainer,
        quantContainer,
        fieldsLevel
      });

      if (!qualContainer || !quantContainer || !fieldsLevel) {
        console.error("DEBUG: One or more containers not found in active editor. Aborting field render.");
        return;
      }

      // 3) Clear them
      qualContainer.innerHTML = "";
      quantContainer.innerHTML = "";

      // 4) Render qualitative fields
      if (window.fieldAnalysis && window.fieldAnalysis.qualitative_fields) {
        console.log("DEBUG: Rendering qualitative fields from fieldAnalysis...");
        for (const field in window.fieldAnalysis.qualitative_fields) {
          const analysis = window.fieldAnalysis.qualitative_fields[field];
          const div = document.createElement('div');
          div.classList.add('json-qual-field');
          div.style.border = "1px solid #ccc";
          div.style.marginBottom = "10px";
          div.style.padding = "5px";

          let html = `<h4>${field} (Qualitative)</h4>`;
          if (analysis.counts) {
            for (const prop in analysis.counts) {
              html += `
                <div class="bento-box" style="margin: 5px 0;">
                  <strong>${prop}</strong> (Count: ${analysis.counts[prop]})<br>
                  <div class="edit-group">
                    <label>Grade: <input type="number" step="0.01" name="${field}_${prop}_grade"></label>
                  </div>
                </div>
              `;
            }
          } else {
            html += `<em>No Data Available</em>`;
          }
          html += `
            <div class="edit-group">
              <label>Overall Grade: <input type="number" step="0.01" name="${field}_grade"></label>
            </div>
          `;
          div.innerHTML = html;
          qualContainer.appendChild(div);
        }
      }

      // 5) Render quantitative fields
      if (window.fieldAnalysis && window.fieldAnalysis.quantitative_fields) {
        console.log("DEBUG: Rendering quantitative fields from fieldAnalysis...");
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
            <h4>${field} (Quantitative)</h4>
            <div>
              ${metricsHtml}
            </div>
            <div class="edit-group">
              <label>Grade: <input type="number" step="0.01" name="${field}_grade"></label>
            </div>
          `;
          quantContainer.appendChild(div);
        }
      }

      // 6) Optionally update code preview
      if (window.generatedCode) {
        window.generatedCode.processedFields = window.fieldAnalysis;
      }
      refreshCodePreview();
      initializeNestedResizers();
      console.log("DEBUG: Finished rendering field analysis into active editor tab.");
    }


    function getActiveDatasetEditor() {
      // 1) Find the currently active .tab in the #json-editor-tabs
      const activeTabButton = document.querySelector('#json-editor-tabs .tab.active');
      if (!activeTabButton) {
        console.error("DEBUG: No active tab found in #json-editor-tabs!");
        return null;
      }
      const tabId = activeTabButton.dataset.tab;
      console.log("DEBUG: getActiveDatasetEditor found active tabId =", tabId);

      // 2) Find the corresponding editor pane
      const editorPane = document.getElementById(tabId);
      if (!editorPane) {
        console.error("DEBUG: No editor pane found with id =", tabId);
        return null;
      }
      return editorPane;
    }




  // Process Fields: send geoJSON for analysis.
    function processFieldAnalysis() {
      console.log("DEBUG: processFieldAnalysis: Sending geojson to /editor/process_fields...");
      const geojson = window.currentGeoJSON;
      fetch('/editor/process_fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson)
      })
      .then(response => {
        console.log("DEBUG: Received response from /editor/process_fields with status:", response.status);
        return response.json();
      })
      .then(analysisData => {
        console.log("DEBUG: Received analysis data from server:", analysisData);
        window.fieldAnalysis = analysisData;
        updateJSONEditorFromAnalysis();  // calls the function that updates the active tab
      })
      .catch(err => {
        console.error("DEBUG: Error in processFieldAnalysis:", err);
      });
    }


  // Attach process fields button event.
  document.getElementById('process-fields-btn')?.addEventListener('click', processFieldAnalysis);

  // Create JSON Button – build the dataset JSON.
  document.getElementById('create-json-btn')?.addEventListener('click', function() {
    let qualitativeFields = [];
    const qualDivs = document.querySelectorAll('#json-qualitative-section .json-qual-field');
    qualDivs.forEach(div => {
      const fieldName = div.querySelector('h4').textContent.split(' (Prediction:')[0].trim();
      const meaning = div.querySelector(`input[name="${fieldName}_meaning"]`).value;
      const importance = div.querySelector(`input[name="${fieldName}_importance"]`).value;
      const grade = div.querySelector(`input[name="${fieldName}_grade"]`).value;
      qualitativeFields.push({
        fieldName: fieldName,
        type: "String",
        meaning: meaning,
        importance: importance,
        overallFieldImportanceGrade: parseFloat(grade)
      });
    });
    let quantitativeFields = [];
    const quantDivs = document.querySelectorAll('#json-quantitative-section .json-quant-field');
    quantDivs.forEach(div => {
      const fieldName = div.querySelector('h4').textContent.split(' (Prediction:')[0].trim();
      const meaning = div.querySelector(`input[name="${fieldName}_meaning"]`).value;
      const importance = div.querySelector(`input[name="${fieldName}_importance"]`).value;
      const grade = div.querySelector(`input[name="${fieldName}_grade"]`).value;
      quantitativeFields.push({
        fieldName: fieldName,
        type: "Float",
        meaning: meaning,
        importance: importance,
        overallFieldImportanceGrade: parseFloat(grade)
      });
    });
    let removedFields = [];
    let allGrades = {};
    qualitativeFields.concat(quantitativeFields).forEach(field => {
      allGrades[field.fieldName] = field.overallFieldImportanceGrade;
    });
    const datasetName = document.querySelector('#json-dataset-section input[id="dataset-name"]').value;
    const datasetLink = document.querySelector('#json-dataset-section input[id="dataset-link"]').value;
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

  // JSON file upload handler.
  document.getElementById('json-upload')?.addEventListener('change', function(e) {
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

  // Update Quant/Qual Options UI.
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

  // Generate Python function code based on quant/qual selections.
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
    pythonCode += "    for field in quant_fields:\n";
    pythonCode += "        quant_stats[field] = []\n";
    pythonCode += "    for field in qual_fields:\n";
    pythonCode += "        qual_counts[field] = {}\n";
    pythonCode += "    for feature in data['features']:\n";
    pythonCode += "        props = feature['properties']\n";
    pythonCode += "        for field in quant_fields:\n";
    pythonCode += "            if (field in props && typeof props[field] === 'number') {\n";
    pythonCode += "                quant_stats[field].push(props[field]);\n";
    pythonCode += "            }\n";
    pythonCode += "        for field in qual_fields:\n";
    pythonCode += "            if (field in props) {\n";
    pythonCode += "                let value = props[field];\n";
    pythonCode += "                qual_counts[field][value] = (qual_counts[field][value] || 0) + 1;\n";
    pythonCode += "            }\n";
    pythonCode += "    return quant_stats, qual_counts;\n";
    window.generatedCode = window.generatedCode || {};
    window.generatedCode.python = pythonCode;
    refreshCodePreview();
  }

  // --- New Nested Resizer Initialization ---
  // This function implements a flex-based split pane behavior.
  function initializeNestedResizers() {
    const nestedResizers = document.querySelectorAll('.nested-resizer');
    nestedResizers.forEach(resizer => {
      let isDragging = false;
      let startY = 0;
      let prevElem, nextElem, prevHeight, nextHeight;

      resizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        prevElem = resizer.previousElementSibling;
        nextElem = resizer.nextElementSibling;
        // Capture current heights in pixels.
        prevHeight = prevElem.getBoundingClientRect().height;
        nextHeight = nextElem.getBoundingClientRect().height;
        // Temporarily disable flex-grow to work with explicit heights.
        prevElem.style.flex = "none";
        nextElem.style.flex = "none";
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        let newPrevHeight = prevHeight + dy;
        let newNextHeight = nextHeight - dy;
        const minHeight = 50;  // minimum height for each pane
        if (newPrevHeight < minHeight) {
          newPrevHeight = minHeight;
          newNextHeight = prevHeight + nextHeight - newPrevHeight;
        }
        if (newNextHeight < minHeight) {
          newNextHeight = minHeight;
          newPrevHeight = prevHeight + nextHeight - newNextHeight;
        }
        prevElem.style.height = newPrevHeight + "px";
        nextElem.style.height = newNextHeight + "px";
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          // Remove the inline heights and restore flex so panes remain responsive.
          prevElem.style.height = "";
          nextElem.style.height = "";
          prevElem.style.flex = "1 1 auto";
          nextElem.style.flex = "1 1 auto";
        }
      });
    });
  }
  // Initial call to set up nested resizers.
  initializeNestedResizers();

  console.log("Interactive JSON editor (jsonEditor.js) loaded successfully.");
});
