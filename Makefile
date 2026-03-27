PYTHON ?= .venv-docs/bin/python
PYTHON_TARGETS = backend jsonschema_diagram jsonschema_diagram_sphinx tests docs/conf.py

.PHONY: format lint type-check

format:
	$(PYTHON) -m isort $(PYTHON_TARGETS)
	$(PYTHON) -m black $(PYTHON_TARGETS)

lint:
	$(PYTHON) -m flake8 $(PYTHON_TARGETS)

type-check:
	$(PYTHON) -m mypy
