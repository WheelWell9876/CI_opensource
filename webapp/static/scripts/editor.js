// webapp/static/scripts/editor.js

document.addEventListener('DOMContentLoaded', function() {
    // Example: When the "Run Pipeline" button is clicked, gather user input and call the endpoint.
    document.getElementById('runPipelineBtn').addEventListener('click', function() {
        // Retrieve user inputs from the editor form
        const datasetName = document.getElementById('datasetName').value;
        const inputGeoJSON = document.getElementById('inputGeoJSON').value;
        // You may also collect selected fields, normalized grades, reasons, etc.
        const payload = {
            dataset_name: datasetName,
            input_geojson: inputGeoJSON
            // Add additional fields from your editor UI as needed.
        };

        fetch('/editor/run_pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(data.message);
            } else {
                alert("Error: " + data.message);
            }
        })
        .catch(err => {
            console.error("Error running pipeline:", err);
            alert("An error occurred while running the pipeline.");
        });
    });
});
