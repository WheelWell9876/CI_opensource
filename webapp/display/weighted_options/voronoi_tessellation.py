def create_voronoi_tessellation_display(gdf):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        return create_default_display(gdf)
    points = np.array([[pt.x, pt.y] for pt in gdf_points.geometry])
    try:
        vor = Voronoi(points)
    except Exception:
        logger.exception("Voronoi tessellation failed")
        return create_default_display(gdf)
    traces = []
    for ridge in vor.ridge_vertices:
        if -1 in ridge:
            continue
        pts = [vor.vertices[i] for i in ridge]
        lons, lats = zip(*pts)
        trace = {
            "type": "scattermapbox",
            "lat": lats,
            "lon": lons,
            "mode": "lines",
            "line": {"color": "orange", "width": 2},
            "name": "Voronoi"
        }
        traces.append(trace)
    center = {"lat": np.mean(points[:, 1]), "lon": np.mean(points[:, 0])}
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": center,
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Voronoi tessellation: processed %d points", len(points))
    return traces, layout
