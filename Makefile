LOCAL_IP := $(shell ipconfig getifaddr en0)

# Docker image version
DK_REGISTRY ?= jbustin1/

DK_SIO_VERSION ?= 0.6.1
DK_SIO_NAME ?= sioux
DK_SIO_ID ?= $(shell docker ps | grep -F "$(DK_SIO_NAME):$(DK_SIO_VERSION)" | awk '{ print $$1 }')
DK_SIO_IMAGE ?= $(DK_REGISTRY)$(DK_SIO_NAME):$(DK_SIO_VERSION)
DK_SIO_LATEST ?= $(DK_REGISTRY)$(DK_SIO_NAME):latest

.DEFAULT_GOAL := help

help: ## Display this help
	@grep -E '^[a-zA-Z1-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN { FS = ":.*?## " }; { printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

build: ## Build sioux
	@docker build -t ${DK_SIO_IMAGE} .

build-latest: ## Build latest sioux
	@docker build -t ${DK_SIO_LATEST} .

push: ## Push sioux
	@docker push ${DK_SIO_IMAGE}

push-latest: ## Push latest sioux
	@docker push $(DK_SIO_LATEST)

build-and-push: ## Build and push
	@make build
	@make push

build-and-push-latest: ## Build and push latest
	@make build-latest
	@make push-latest

dev: ## Run sioux for dev
	@docker run --rm \
	-v ${PWD}/lib:/usr/app/lib \
	-v ${PWD}/tests:/usr/app/tests \
	-v ${PWD}/vhosts:/usr/app/vhosts \
	-v ${PWD}/.env:/usr/app/.env \
	${DK_SIO_IMAGE}

run: ## Run sioux
	@docker run --rm \
	-v ${PWD}/tests:/usr/app/tests \
	-v ${PWD}/vhosts:/usr/app/vhosts \
	-v ${PWD}/.env:/usr/app/.env \
	${DK_SIO_IMAGE}

build-and-run: ## Build and run sioux
	@make build
	@make run

interactive: ## Run sioux in interactive mode
	@docker run --rm -it \
	-v ${PWD}/tests:/usr/app/tests \
	-v ${PWD}/vhosts:/usr/app/vhosts \
	-v ${PWD}/.env:/usr/app/.env \
	${DK_SIO_IMAGE} bash

dev-interactive: ## Run dev sioux in interactive mode
	@docker run --rm -it \
	-v ${PWD}/tests:/usr/app/tests \
	-v ${PWD}/lib:/usr/app/lib \
	-v ${PWD}/vhosts:/usr/app/vhosts \
	-v ${PWD}/.env:/usr/app/.env \
	${DK_SIO_IMAGE} bash

format: ## Format test files (as user)
	@docker run --rm -it \
	-v ${PWD}/tests:/usr/app/tests \
	${DK_SIO_IMAGE} ./node_modules/.bin/prettier --write 'tests/*.{js,json}'