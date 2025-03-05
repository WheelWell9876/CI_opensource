//----------------------------------------------------------
// File: webapp/static/resources/scripts/graphs.js
// Contains all graph creation and dropdown logic using Chart.js.
// This file must be loaded BEFORE datasets.js.
//----------------------------------------------------------

// Helper: returns a promise that resolves after ms milliseconds.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a graphs dropdown with a loading spinner and Chart.js-based graphs.
 * Graphs are generated asynchronously only when the "Show Graphs" button is clicked.
 */
function createGraphsDropdown(data, type) {
  console.log(`createGraphsDropdown() called for type: "${type}"`, data);

  const dropdownContainer = document.createElement("div");
  dropdownContainer.classList.add("graphs-dropdown-container");

  // Create the Show/Hide Graphs button
  const button = document.createElement("button");
  button.setAttribute("type", "button");
  button.classList.add("graphs-dropdown");
  button.textContent = "Show Graphs";
  dropdownContainer.appendChild(button);

  // Create the container for the graphs content.
  const content = document.createElement("div");
  content.classList.add("graphs-content");
  // Do not set any inline height restrictions.
  dropdownContainer.appendChild(content);

  let graphsLoaded = false;
  let isExpanded = false;

  button.addEventListener("click", async function(e) {
    if (e.target !== button) return;
    e.preventDefault();
    console.log(`Graphs dropdown button clicked for type: "${type}"`);

    if (!isExpanded) {
      if (!graphsLoaded) {
        // Show a loading spinner while graphs load.
        content.innerHTML = '<div class="loading-wheel"></div>';
        console.log(`Loading spinner displayed for type: "${type}"...`);
        await wait(2000);
        console.log(`Generating graphs for type: "${type}" now...`);
        const graphsElement = generateGraphsForSection(data, type);
        content.innerHTML = "";
        content.appendChild(graphsElement);
        graphsLoaded = true;
      }
      // Remove any inline restrictions so that the container naturally expands.
      content.style.maxHeight = "none";
      content.style.height = "auto";
      content.style.overflowY = "visible";
      // Mark the container as expanded.
      content.classList.remove("collapsed");
      content.classList.add("expanded");
      button.textContent = "Hide Graphs";
      isExpanded = true;
    } else {
      // Collapse the container completely by hiding it.
      content.classList.remove("expanded");
      content.classList.add("collapsed");
      button.textContent = "Show Graphs";
      isExpanded = false;
    }
  });

  return dropdownContainer;
}

/**
 * Generate graphs for a given section using Chart.js.
 * Returns a DOM element (container) containing the canvases so that
 * the charts remain attached to the live DOM for rendering.
 */
function generateGraphsForSection(data, type) {
  if (typeof Chart === "undefined") {
    console.error("Chart is not defined. Please load the Chart.js library before graphs.js.");
    const errorDiv = document.createElement("div");
    errorDiv.classList.add("graph-error");
    errorDiv.textContent = "Chart library not loaded";
    return errorDiv;
  }

  console.log(`generateGraphsForSection() called for type: "${type}" with data:`, data);
  const container = document.createElement("div");
  container.classList.add("graphs-container");

  // Branch for Quantitative Field graphs
  if (type === "Quantitative Field") {
    // 1. Grouped Bar Chart for field-level grades.
    const canvasBar = document.createElement("canvas");
    canvasBar.id = "quantBarChart_" + Math.random().toString(36).substring(2);
    canvasBar.style.backgroundColor = "#fff";
    container.appendChild(canvasBar);
    console.log("Creating grouped bar chart for Quantitative Field.");
    new Chart(canvasBar, {
      type: 'bar',
      data: {
        labels: ["Field Grade to Dataset", "Field Grade to Category", "Field Grade to Overall"],
        datasets: [{
          label: "Quantitative Field Grades",
          data: [
            data.overallFieldImportanceGrade,
            data.overallFieldToCategoryGrade,
            data.overallFieldToFullGrade
          ],
          backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });

    // 2. Additional Metrics Bar Chart from importanceDetails (if available).
    if (data.importanceDetails && data.importanceDetails.length > 0 && data.importanceDetails[0].metrics) {
      let metricsStr = data.importanceDetails[0].metrics;
      let metrics = {};
      metricsStr.split(",").forEach(function(metric) {
        let parts = metric.split(":");
        if (parts.length === 2) {
          metrics[parts[0].trim()] = parseFloat(parts[1].trim());
        }
      });
      const metricLabels = Object.keys(metrics);
      const metricValues = metricLabels.map(key => metrics[key]);
      const canvasMetrics = document.createElement("canvas");
      canvasMetrics.id = "quantMetricsChart_" + Math.random().toString(36).substring(2);
      canvasMetrics.style.backgroundColor = "#fff";
      container.appendChild(canvasMetrics);
      console.log("Creating metrics bar chart for Quantitative Field from importanceDetails.");
      new Chart(canvasMetrics, {
        type: 'bar',
        data: {
          labels: metricLabels,
          datasets: [{
            label: "Quantitative Metrics",
            data: metricValues,
            backgroundColor: "#f6c23e"
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }
  }
  // Branch for Qualitative Field graphs (field-level overview)
    else if (type === "Qualitative Field") {
      // 1. Donut Chart showing overall field metrics.
      const canvasDonut = document.createElement("canvas");
      canvasDonut.id = "qualFieldDonutChart_" + Math.random().toString(36).substring(2);
      canvasDonut.style.backgroundColor = "#fff";
      container.appendChild(canvasDonut);
      console.log("Creating donut chart for Qualitative Field overall metrics.");
      new Chart(canvasDonut, {
        type: 'doughnut',
        data: {
          labels: ["Field Grade to Dataset", "Field Grade to Category", "Field Grade to Overall"],
          datasets: [{
            data: [
              data.overallFieldImportanceGrade,
              data.overallFieldToCategoryGrade,
              data.overallFieldToFullGrade
            ],
            backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc"]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'right' } }
        }
      });

      // 2. Radar Chart for a multidimensional view of qualitative field metrics.
      const canvasRadar = document.createElement("canvas");
      canvasRadar.id = "qualFieldRadarChart_" + Math.random().toString(36).substring(2);
      canvasRadar.style.backgroundColor = "#fff";
      container.appendChild(canvasRadar);
      console.log("Creating radar chart for Qualitative Field metrics.");
      new Chart(canvasRadar, {
        type: 'radar',
        data: {
          labels: ["Dataset", "Category", "Overall"],
          datasets: [{
            label: "Qualitative Field Metrics",
            data: [
              data.overallFieldImportanceGrade,
              data.overallFieldToCategoryGrade,
              data.overallFieldToFullGrade
            ],
            backgroundColor: "rgba(78, 115, 223, 0.2)",
            borderColor: "#4e73df",
            pointBackgroundColor: "#4e73df"
          }]
        },
        options: {
          responsive: true,
          scales: { r: { beginAtZero: true } },
          plugins: { legend: { display: false } }
        }
      });

      // 3. Horizontal Grouped Bar Chart for Qualitative Field: Importance vs. Count.
      // Sort properties by importance (grade) descending.
      if (data.qualitativeProperties && Array.isArray(data.qualitativeProperties)) {
        const sortedByImportance = data.qualitativeProperties.slice().sort((a, b) => b.grade - a.grade);
        const labels = sortedByImportance.map(prop => prop.propertyName);
        const importanceValues = sortedByImportance.map(prop => prop.grade);
        const countValues = sortedByImportance.map(prop => prop.count);

        const canvasGroup = document.createElement("canvas");
        canvasGroup.id = "qualFieldImportanceVsCountChart_" + Math.random().toString(36).substring(2);
        canvasGroup.style.backgroundColor = "#fff";
        container.appendChild(canvasGroup);
        console.log("Creating horizontal grouped bar chart for Qualitative Field: Importance vs. Count.");
        new Chart(canvasGroup, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: "Importance",
              data: importanceValues,
              backgroundColor: "#e74a3b",
              xAxisID: 'x1'
            },
            {
              label: "Count",
              data: countValues,
              backgroundColor: "#4e73df",
              xAxisID: 'x'
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
              x: {
                beginAtZero: true,
                position: 'bottom',
                title: { display: true, text: 'Count' }
              },
              x1: {
                beginAtZero: true,
                position: 'top',
                title: { display: true, text: 'Importance (Grade)' },
                ticks: { max: 1, stepSize: 0.1 }
              }
            }
          }
        });
      }
    }


  // Branch for Qualitative Property graphs (detailed property breakdown)
  else if (type === "Qualitative Property") {
    // Stacked Bar Chart for property grade breakdown.
    const canvasStacked = document.createElement("canvas");
    canvasStacked.id = "stackedBarChart_" + Math.random().toString(36).substring(2);
    canvasStacked.style.backgroundColor = "#fff";
    container.appendChild(canvasStacked);
    console.log(`Creating stacked bar chart for property: "${data.propertyName}".`);
    new Chart(canvasStacked, {
      type: 'bar',
      data: {
        labels: ["Property Grade to Field", "Property Grade to Dataset", "Property Grade to Category", "Property Grade to Overall"],
        datasets: [{
          label: data.propertyName,
          data: [
            data.grade,
            data.overallPropertyToDatasetGrade,
            data.overallPropertyToCategoryGrade,
            data.overallPropertyToFullGrade
          ],
          backgroundColor: "#f6c23e"
        }]
      },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true } },
        plugins: { legend: { display: false } }
      }
    });
  }
  // Branch for Summary graphs (aggregated summary view)
    else if (type === "Summary") {
      const canvasPie = document.createElement("canvas");
      canvasPie.id = "summaryPieChart_" + Math.random().toString(36).substring(2);
      canvasPie.style.backgroundColor = "#fff";
      container.appendChild(canvasPie);

      // Exclude unwanted keys
      const excludeKeys = ["overallDatasetImportanceGradeToCategory", "datasetImportanceToFullMode"];
      // Convert keys -> array of { key, value } for sorting
      const gradeData = Object.keys(data)
        .filter(key => !excludeKeys.includes(key))
        .map(key => ({ key, value: data[key] }));

      // Sort in descending order by value
      gradeData.sort((a, b) => b.value - a.value);

      // Prepare final arrays
      const sortedKeys = gradeData.map(item => item.key);
      const sortedValues = gradeData.map(item => item.value);

      // Adjust or expand this palette as needed
      const backgroundColors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#858796', '#fd7e14', '#20c997', '#6f42c1', '#17a673',
        '#2c9faf', '#dddfeb', '#f8f9fc', '#5a5c69', '#b58900'
      ];

      new Chart(canvasPie, {
        type: 'pie',
        data: {
          labels: sortedKeys,
          datasets: [{
            data: sortedValues,
            backgroundColor: backgroundColors.slice(0, sortedKeys.length)
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' }
          },
          // Start at the top (12 o’clock)
          rotation: -90 * (Math.PI / 180),
          // By default, Chart.js draws arcs clockwise from the start angle.
          // circumference: 2 * Math.PI (this is the default for a full pie)
        }
      });
    }



  // Branch for Mode graphs
  else if (type === "Mode") {
    // Simple bar chart for Mode.
    const canvasModeBar = document.createElement("canvas");
    canvasModeBar.id = "modeBarChart_" + Math.random().toString(36).substring(2);
    canvasModeBar.style.backgroundColor = "#fff";
    container.appendChild(canvasModeBar);
    console.log(`Creating bar chart for Mode: "${data.datasetName || "Unnamed"}".`);
    new Chart(canvasModeBar, {
      type: 'bar',
      data: {
        labels: ["Grade"],
        datasets: [{
          label: "Mode Grade",
          data: [data.grade || 0],
          backgroundColor: "#1cc88a"
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }
  // Branch for Category Grade Summary graphs
  else if (type === "Category Grade Summary") {
    const canvasPie = document.createElement("canvas");
    canvasPie.id = "pieChart_" + Math.random().toString(36).substring(2);
    canvasPie.style.backgroundColor = "#fff";
    container.appendChild(canvasPie);

    // Filter out the unwanted key
    const filteredKeys = Object.keys(data).filter(key => key !== "categoryimportanceToOverallMode");
    const filteredValues = filteredKeys.map(key => data[key]);

    // Define a color palette (adjust or extend as needed)
    const backgroundColors = [
      '#4e73df', '#1cc88a', '#36b9cc',
      '#f6c23e', '#e74a3b', '#858796',
      '#fd7e14', '#20c997', '#6f42c1'
    ];

    new Chart(canvasPie, {
      type: 'pie',
      data: {
        labels: filteredKeys,
        datasets: [{
          data: filteredValues,
          backgroundColor: backgroundColors.slice(0, filteredKeys.length)
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });
  }
  // Default fallback if no type matches.
  else {
    const defaultDiv = document.createElement("div");
    defaultDiv.textContent = "No graph available for this type.";
    container.appendChild(defaultDiv);
  }

  console.log(`Finished generateGraphsForSection for type: "${type}".`);
  return container;
}
