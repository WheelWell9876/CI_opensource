// webapp/static/scripts/editor.js

document.addEventListener('DOMContentLoaded', function() {
    // Provided APIs list (sorted alphabetically)
    const providedAPIs = {
        "EPA Disaster Debris Recovery Data": "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/EPA_Disaster_Debris_Recovery_Data/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson"
        // Add additional provided APIs here
    };

    // Populate the provided APIs dropdown in alphabetical order
    function populateProvidedAPIs() {
        const select = document.getElementById('provided-api-select');
        select.innerHTML = '';
        const keys = Object.keys(providedAPIs).sort();
        keys.forEach(apiName => {
            const option = document.createElement('option');
            option.value = providedAPIs[apiName];
            option.textContent = apiName;
            select.appendChild(option);
        });
    }
    populateProvidedAPIs();

    // When source type changes, update the API URL input accordingly.
    document.getElementById('source-type-select').addEventListener('change', function() {
        const sourceType = this.value;
        const providedGroup = document.getElementById('provided-api-group');
        if (sourceType === 'provided') {
            providedGroup.style.display = 'block';
            // Set the API URL input to the currently selected provided API value.
            const providedAPI = document.getElementById('provided-api-select').value;
            document.getElementById('api-url-input').value = providedAPI;
        } else {
            providedGroup.style.display = 'none';
            // Clear the API URL input if custom is selected (optional)
            document.getElementById('api-url-input').value = '';
        }
    });

    // When provided API dropdown changes, update the API URL input.
    document.getElementById('provided-api-select').addEventListener('change', function() {
        document.getElementById('api-url-input').value = this.value;
    });

    // Function to call the API to load fields and populate the bento box
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
            const container = document.getElementById('fields-container');
            container.innerHTML = "<h3>Available Fields</h3>";
            data.fields.forEach(field => {
                // Create a bento box element for each field with a checkbox
                const label = document.createElement('label');
                label.classList.add('field-item');
                const checkbox = document.createElement('input');
                checkbox.type = "checkbox";
                checkbox.value = field;
                checkbox.checked = true;  // default all fields selected
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(" " + field));
                container.appendChild(label);
            });
        })
        .catch(err => {
            console.error(err);
            alert("Failed to load fields.");
        });
    });

    // Function to update preview code (including API response preview)
    function updatePreview() {
        // Build configuration from left panel options
        const apiUrl = document.getElementById('api-url-input').value;
        const fieldsContainer = document.getElementById('fields-container');
        const checkboxes = fieldsContainer.querySelectorAll('input[type="checkbox"]');
        let selectedFields = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedFields.push(cb.value);
            }
        });
        const returnGeometry = document.getElementById('toggle-geometry').checked;
        const returnIdsOnly = document.getElementById('toggle-ids').checked;
        const returnCountOnly = document.getElementById('toggle-count').checked;
        const previewLimit = document.getElementById('preview-limit').value;
        const config = {
            api_url: apiUrl,
            selected_fields: selectedFields,
            return_geometry: returnGeometry,
            return_ids_only: returnIdsOnly,
            return_count_only: returnCountOnly,
            preview_limit: previewLimit
        };

        // Call backend endpoint to generate preview code based on config.
        fetch('/editor/generate_preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            // Save the generated code in a global variable
            window.generatedCode = data;
            // Update the preview based on current dropdown selection.
            refreshCodePreview();
        })
        .catch(err => {
            console.error("Error generating preview:", err);
        });
    }

    // Function to refresh the code preview area based on dropdown selection.
    function refreshCodePreview() {
        const codeType = document.getElementById('code-type-select').value;
        const codePreview = document.getElementById('code-preview');
        if (window.generatedCode) {
            codePreview.value = window.generatedCode[codeType] || "";
        } else {
            codePreview.value = "// Preview code will appear here once you update.";
        }
    }

    // Bind change events to update preview live.
    document.getElementById('update-preview').addEventListener('click', updatePreview);
    document.getElementById('code-type-select').addEventListener('change', refreshCodePreview);

    // Copy button logic
    document.getElementById('copy-code').addEventListener('click', function() {
        const codePreview = document.getElementById('code-preview');
        codePreview.select();
        document.execCommand("copy");
        alert("Code copied to clipboard!");
    });
});
