import os
from flask import Flask
from geo_open_source.webapp.routes import main_blueprint

# Import the JSON editor blueprint and registration function
try:
    from geo_open_source.webapp.jsonEditor.runJsonEditor import register_json_editor

    print("✅ [IMPORT] Successfully imported runJsonEditor")
except ImportError as e:
    print(f"❌ [IMPORT] Failed to import runJsonEditor: {e}")
    register_json_editor = None


def create_app():
    """
    Factory function that creates and configures the Flask app.
    """
    print("🚀 [APP] Starting Flask app creation")

    app = Flask(
        __name__,
        template_folder=os.path.join("webapp", "templates"),
        static_folder=os.path.join("webapp", "static")
    )
    app.config['SECRET_KEY'] = 'some_random_secret_key'

    print(f"📁 [APP] Template folder: {app.template_folder}")
    print(f"📁 [APP] Static folder: {app.static_folder}")

    # Register the main blueprint
    print("📘 [APP] Registering main blueprint")
    app.register_blueprint(main_blueprint)
    print("✅ [APP] Main blueprint registered")

    # Register the JSON editor blueprint if available
    if register_json_editor:
        print("📘 [APP] Registering JSON editor blueprint")
        try:
            register_json_editor(app)
            print("✅ [APP] JSON editor blueprint registered successfully")
        except Exception as e:
            print(f"❌ [APP] Failed to register JSON editor blueprint: {e}")
            import traceback
            print(f"❌ [APP] Traceback: {traceback.format_exc()}")
    else:
        print("⚠️ [APP] JSON editor blueprint not available - skipping registration")

    # DEBUG: Print out all registered routes.
    print("🔍 [APP] All registered routes:")
    route_count = 0
    json_editor_count = 0

    for rule in app.url_map.iter_rules():
        route_count += 1
        if 'json_editor' in rule.endpoint:
            json_editor_count += 1
            print(f"  🎯 JSON Editor: {rule.endpoint}: {rule.rule} {list(rule.methods - {'HEAD', 'OPTIONS'})}")
        else:
            print(f"  📄 Main: {rule.endpoint}: {rule.rule} {list(rule.methods - {'HEAD', 'OPTIONS'})}")

    print(f"📊 [APP] Total routes registered: {route_count}")
    print(f"📊 [APP] JSON Editor routes: {json_editor_count}")

    if json_editor_count == 0:
        print("⚠️ [APP] WARNING: No JSON editor routes found! Check if blueprint was registered correctly.")

    print("✅ [APP] Flask app creation complete")
    return app


app = create_app()

if __name__ == '__main__':
    print("🌍 [SERVER] Starting Flask development server")
    print("🔗 [SERVER] Available endpoints:")
    print("  - Main page: http://127.0.0.1:5000/")
    print("  - Editor: http://127.0.0.1:5000/editor")
    print("  - JSON Editor: http://127.0.0.1:5000/json-editor/editor")
    print("  - JSON Editor API: http://127.0.0.1:5000/json-editor/api/load_preset")
    print("  - Debug routes: http://127.0.0.1:5000/json-editor/debug/routes")
    print("🔍 [SERVER] Check console for detailed debug logs")

    app.run(debug=True, host='0.0.0.0', port=5000)