from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from jsonschema_diagram import (  # noqa: E402
    DEFAULT_EMBED_TEMPLATE_PATH,
    DEFAULT_SCHEMA_PATH,
)

project = "JSON Schema Diagram"
author = "OpenAI Codex"
extensions = ["jsonschema_diagram_sphinx"]
templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
html_theme = "furo"
html_title = "JSON Schema Diagram Sphinx Demo"
html_static_path = ["_static"]
html_css_files = ["docs-theme.css"]
html_theme_options = {
    "sidebar_hide_name": False,
    "navigation_with_keys": True,
    "light_logo": None,
    "dark_logo": None,
    "light_css_variables": {
        "color-brand-primary": "#0f172a",
        "color-brand-content": "#0369a1",
        "color-api-name": "#0f172a",
        "color-api-pre-name": "#475569",
        "color-background-primary": "#f7fafc",
        "color-background-secondary": "#eef4f8",
        "color-background-hover": "#e2edf5",
        "color-background-border": "#d6e3ee",
        "color-sidebar-background": "#f2f7fb",
        "color-sidebar-link-text": "#334155",
        "color-sidebar-link-text--top-level": "#0f172a",
        "color-sidebar-item-background--hover": "#e0edf6",
        "color-sidebar-item-expander-background--hover": "#dbe9f3",
        "color-content-foreground": "#0f172a",
        "color-content-secondary": "#475569",
        "color-link": "#0284c7",
        "color-link--hover": "#0369a1",
        "color-admonition-background": "#f4f8fb",
        "font-stack": "Avenir Next, Segoe UI, sans-serif",
        "font-stack--monospace": "IBM Plex Mono, SFMono-Regular, monospace",
    },
    "dark_css_variables": {
        "color-brand-primary": "#e2e8f0",
        "color-brand-content": "#7dd3fc",
        "color-api-name": "#f8fafc",
        "color-api-pre-name": "#94a3b8",
        "color-background-primary": "#0a0d12",
        "color-background-secondary": "#0f141c",
        "color-background-hover": "#131a24",
        "color-background-border": "#1e293b",
        "color-sidebar-background": "#0b1017",
        "color-sidebar-link-text": "#a8b5c7",
        "color-sidebar-link-text--top-level": "#f8fafc",
        "color-sidebar-item-background--hover": "#121924",
        "color-sidebar-item-expander-background--hover": "#141c27",
        "color-content-foreground": "#e5edf7",
        "color-content-secondary": "#9aa9bd",
        "color-link": "#7dd3fc",
        "color-link--hover": "#bae6fd",
        "color-admonition-background": "#0f1722",
        "font-stack": "Avenir Next, Segoe UI, sans-serif",
        "font-stack--monospace": "IBM Plex Mono, SFMono-Regular, monospace",
    },
}

jsonschema_diagram_embed_template = str(DEFAULT_EMBED_TEMPLATE_PATH)
jsonschema_diagram_default_schema_path = str(DEFAULT_SCHEMA_PATH)
jsonschema_diagram_default_height = "760px"
jsonschema_diagram_default_theme = "slate"
