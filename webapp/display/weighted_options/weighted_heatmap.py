def create_weighted_heatmap(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    trace = {
        "type": "densitymapbox",
        "lat": lats,
        "lon": lons,
        "z": weights,
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
    logger.debug("Weighted heatmap: %d points, using weight type '%s'", len(lats), weight_type)
    return [trace], layout
