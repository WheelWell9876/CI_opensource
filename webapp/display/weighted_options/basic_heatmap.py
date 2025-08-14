def create_basic_heatmap(gdf):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    trace = {
        "type": "densitymapbox",
        "lat": lats,
        "lon": lons,
        "radius": 10,
        "colorscale": "Viridis",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats) if lats else 39.8283,
                       "lon": np.mean(lons) if lons else -98.5795},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Basic heatmap: %d points", len(lats))
    return [trace], layout