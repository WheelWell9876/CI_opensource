def create_comparative_overlay(gdf):
    if "Dataset" in gdf.columns:
        groups = gdf.groupby("Dataset")
    else:
        groups = [("All", gdf)]
    traces = []
    for name, group in groups:
        if group.empty:
            continue
        gdf_points = group[group.geometry.geom_type == "Point"]
        lats = [pt.y for pt in gdf_points.geometry]
        lons = [pt.x for pt in gdf_points.geometry]
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "markers",
            "marker": {"size": 8, "color": get_color(str(name))},
            "name": str(name)
        }
        traces.append(trace)
    # var_all_lats = [];
    # var_all_lons = [];
    # for (var i = 0; i < traces.length; i++) {
    #     var tr = traces[i];
    # var_all_lats = var_all_lats.concat(tr["lat"]);
    # var_all_lons = var_all_lons.concat(tr["lon"]);
    # }
    # center = {"lat": np.mean(var_all_lats) if var_all_lats.length else 39.8283,
    #           "lon": np.mean(var_all_lons) if var_all_lons.length else -98.5795}
    # layout = {
    #     "mapbox": {
    #         "style": "open-street-map",
    #         "center": center,
    #         "zoom": 6
    #     },
    #     "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    # }
    logger.debug("Comparative overlay: %d groups", len(traces))
    return traces
