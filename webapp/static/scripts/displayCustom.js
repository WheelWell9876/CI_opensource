$(document).ready(function(){
    $("#displayMethodSelect").on("change", function(){
      var method = $(this).val();
      console.log("Display method selected: " + method);
      if(method === "weighted_heatmap" || method === "bubble_map" || method === "gaussian_kde"){
        $("#weightTypeRow").show();
      } else {
        $("#weightTypeRow").hide();
      }
    });

    $("#submitDisplayBtn").on("click", function(){
      var displayMethod = $("#displayMethodSelect").val();
      var weightType = $("#weightTypeSelect").val();
      var payload = {
        display_method: displayMethod,
        weight_type: weightType
      };

      if(currentMode === "weighted"){
        payload.dataset = $("#weightedDatasetSelect").val();
      } else {
        payload.state = $("#stateSelect").val();
        payload.county = $("#countySelect").val();
        payload.category = $("#categorySelect").val();
        payload.dataset = $("#datasetSelect").val();
      }

      console.log("Fetching custom display data with payload:", payload);
      $.ajax({
        url: "/fetch_display_data",
        method: "POST",
        dataType: "json",
        contentType: "application/json",
        data: JSON.stringify(payload),
        success: function(response){
          console.log("Custom display response:", response);
          if(response.error){
            alert("Error: " + response.error);
            return;
          }
          if(!response.traces || !response.layout){
            alert("No display data returned.");
            return;
          }
          Plotly.newPlot("mapContainer", response.traces, response.layout);
        },
        error: function(xhr, status, error){
          console.error("AJAX error fetching custom display data:", status, error);
          console.log("Response Text:", xhr.responseText);
          alert("Error fetching custom display data. Check console for details.");
        }
      });
    });
  });
