PYTHON ?= python3
PYTHON_CMD := $(if $(wildcard .venv-docs/bin/python),.venv-docs/bin/python,$(PYTHON))
PIP := $(PYTHON_CMD) -m pip
PYTHON_TARGETS = backend jsonschema_diagram jsonschema_diagram_sphinx tests docs/conf.py

.PHONY: install-dev test docs format lint type-check build-package

format:
	$(PYTHON_CMD) -m isort $(PYTHON_TARGETS)
	$(PYTHON_CMD) -m black $(PYTHON_TARGETS)

lint:
	$(PYTHON_CMD) -m flake8 $(PYTHON_TARGETS)

type-check:
	$(PYTHON_CMD) -m mypy

install-dev:
	$(PIP) install -e ".[dev]"

test:
	$(PYTHON_CMD) -m unittest discover -s tests -v

docs:
	$(PYTHON_CMD) -m sphinx -E -a -b html docs docs/_build/html

build-package:
	$(PYTHON_CMD) -m build
