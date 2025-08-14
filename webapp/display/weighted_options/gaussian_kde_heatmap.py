def create_gaussian_kde_heatmap(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        logger.debug("Gaussian KDE: no point data")
        return create_default_display(gdf)
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    try:
        kde = gaussian_kde(np.vstack([lons, lats]), weights=weights)
    except Exception as e:
        logger.exception("Gaussian KDE failed:")
        return create_default_display(gdf)
    xi = np.linspace(min(lons), max(lons), 100)
    yi = np.linspace(min(lats), max(lats), 100)
    xi, yi = np.meshgrid(xi, yi)
    zi = kde(np.vstack([xi.flatten(), yi.flatten()])).reshape(xi.shape)
    trace = {
        "type": "densitymapbox",
        "lat": yi.flatten().tolist(),
        "lon": xi.flatten().tolist(),
        "z": zi.flatten().tolist(),
        "radius": 10,
        "colorscale": "Viridis",
        "opacity": 0.7
    }
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": np.mean(lats), "lon": np.mean(lons)},
            "zoom": 6
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("Gaussian KDE: processed %d points", len(lats))
    return [trace], layout
