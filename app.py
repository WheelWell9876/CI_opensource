import os
from flask import Flask
from webapp.routes import main_blueprint
from webapp.display import display_blueprint

def create_app():
    """
    Factory function that creates and configures the Flask app.
    """
    app = Flask(
        __name__,
        template_folder=os.path.join("webapp", "templates"),
        static_folder=os.path.join("webapp", "static")
    )
    app.config['SECRET_KEY'] = 'some_random_secret_key'

    # Register blueprints so all routes (including editor functionality now in routes.py) are available.
    app.register_blueprint(main_blueprint)
    app.register_blueprint(display_blueprint)

    # DEBUG: Print out all registered routes.
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=80)
