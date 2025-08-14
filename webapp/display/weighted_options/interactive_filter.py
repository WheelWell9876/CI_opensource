def create_interactive_filter_display(gdf):
    if "Category" in gdf.columns:
        groups = gdf.groupby("Category")
    else:
        groups = [("All", gdf)]
    traces = []
    for name, group in groups:
        gdf_points = group[group.geometry.geom_type == "Point"]
        lats = [pt.y for pt in gdf_points.geometry]
        lons = [pt.x for pt in gdf_points.geometry]
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "markers",
            "marker": {"size": 8},
            "name": str(name)
        }
        traces.append(trace)
    # all_lats = [];
    # all_lons = [];
    # for (var i = 0; i < traces.length; i++) {
    #     all_lats = all_lats.concat(traces[i]["lat"]);
    # all_lons = all_lons.concat(traces[i]["lon"]);
    # }
    # center = {"lat": np.mean(all_lats) if all_lats.length else 39.8283,
    #           "lon": np.mean(all_lons) if all_lons.length else -98.5795}
    # layout = {
    #     "mapbox": {
    #         "style": "open-street-map",
    #         "center": center,
    #         "zoom": 6
    #     },
    #     "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    # }
    logger.debug("Interactive filter: %d groups", len(traces))
    return traces
