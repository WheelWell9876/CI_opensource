def create_3d_extrusion_display(gdf, weight_type):
    gdf_points = gdf[gdf.geometry.geom_type == "Point"]
    if gdf_points.empty:
        return create_default_display(gdf)
    lats = [pt.y for pt in gdf_points.geometry]
    lons = [pt.x for pt in gdf_points.geometry]
    weights = gdf_points[weight_type].tolist() if weight_type in gdf_points.columns else [1] * len(lats)
    zs = [w * 50 for w in weights]
    trace = {
        "type": "scatter3d",
        "x": lons,
        "y": lats,
        "z": zs,
        "mode": "markers",
        "marker": {"size": 5, "color": zs, "colorscale": "Viridis"},
        "name": "3D Extrusion"
    }
    layout = {
        "scene": {
            "xaxis": {"title": "Longitude"},
            "yaxis": {"title": "Latitude"},
            "zaxis": {"title": "Extrusion Height"}
        },
        "margin": {"r": 0, "t": 0, "b": 0, "l": 0}
    }
    logger.debug("3D Extrusion: %d points", len(lats))
    return [trace], layout
