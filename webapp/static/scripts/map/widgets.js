// -------------------------------------------
// 9) Submit Button => POST to /fetch_data or /fetch_weighted_data
// -------------------------------------------
$("#submitBtn").on("click", function() {
  if (currentMode === "weighted") {
    const weightedDataset = $("#weightedDatasetSelect").val();
    if (!weightedDataset) {
      alert("Please select a Weighted Dataset!");
      return;
    }
    const payload = { dataset: weightedDataset };
    console.log("[Weighted] Sending payload:", payload);
    $.ajax({
      url: "/fetch_weighted_data",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(payload),
      success: function(response) {
        console.log("[Weighted] Received response:", response);
        if (response.error) {
          alert("Error: " + response.error);
          return;
        }
        if (!response.data || !response.data.length) {
          alert("No data returned for this selection.");
          return;
        }
        renderMap(response.data);
      },
      error: function(xhr, status, error) {
        console.error("[submitBtn] AJAX error fetching weighted data:", status, error);
        console.log("Response Text:", xhr.responseText);
        alert("An error occurred while fetching weighted data from the server. Check the console for details.");
      }
    });
  } else {
    const state = $("#stateSelect").val();
    const county = $("#countySelect").val();
    const category = $("#categorySelect").val();
    const dataset = $("#datasetSelect").val();

    if (!state) {
      alert("Please select a State first!");
      return;
    }
    const payload = {
      state: state,
      county: county,
      category: category,
      dataset: dataset
    };
    $.ajax({
      url: "/fetch_data",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(payload),
      success: function(response) {
        if (response.error) {
          alert("Error: " + response.error);
          return;
        }
        if (!response.data || !response.data.length) {
          alert("No data returned for this selection.");
          return;
        }
        renderMap(response.data);
      },
      error: function(xhr, status, error) {
        console.error("[submitBtn] AJAX error fetching data:", status, error);
        alert("An error occurred while fetching data from the server.");
      }
    });
  }
});

// -------------------------------------------
// 10) RESET Button => Clear & Load Default
// -------------------------------------------
$("#resetBtn").on("click", function() {
  $("#stateSelect").val("");
  resetDropdown("#countySelect", "-- Select County (optional) --");
  resetDropdown("#categorySelect", "-- Select Category (optional) --");
  resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");
  $("#hideUnavailable").prop("checked", true);
  loadDefaultMap();
});