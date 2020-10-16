WORKSPACE := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
LOCAL_IP := $(shell ipconfig getifaddr en0)

# Docker image version
DK_REGISTRY ?= jbustin1/

DK_SIO_VERSION ?= 0.2.0
DK_SIO_NAME ?= sioux
DK_SIO_ID ?= $(shell docker ps | grep -F "$(DK_SIO_NAME):$(DK_SIO_VERSION)" | awk '{ print $$1 }')
DK_SIO_IMAGE ?= $(DK_REGISTRY)$(DK_SIO_NAME):$(DK_SIO_VERSION)

.DEFAULT_GOAL := help

help: ## Display this help
	@grep -E '^[a-zA-Z1-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN { FS = ":.*?## " }; { printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

build: ## Build sioux
	@docker build -t ${DK_SIO_IMAGE} .

push: ## Push sioux
	@docker push ${DK_SIO_IMAGE}

dev: ## Run sioux for dev
	@docker run --rm \
	-v ${WORKSPACE}/lib:/usr/app/lib \
	-v ${WORKSPACE}/formatters:/usr/app/formatters \
	-v ${WORKSPACE}/vhosts:/usr/app/vhosts \
	-v ${WORKSPACE}/tests:/usr/app/tests \
	-v ${WORKSPACE}/.env:/usr/app/.env \
	${DK_SIO_IMAGE}

run: ## Run sioux
	@docker run --rm \
	-v ${WORKSPACE}/formatters:/usr/app/formatters \
	-v ${WORKSPACE}/vhosts:/usr/app/vhosts \
	-v ${WORKSPACE}/tests:/usr/app/tests \
	-v ${WORKSPACE}/.env:/usr/app/.env \
	${DK_SIO_IMAGE}

build-and-run: ## Build and run sioux
	@docker build
	@docker run

interactive: ## Run sioux in interactive mode
	@docker run --rm -it \
	-v ${WORKSPACE}/formatters:/usr/app/formatters \
	-v ${WORKSPACE}/vhosts:/usr/app/vhosts \
	-v ${WORKSPACE}/tests:/usr/app/tests \
	-v ${WORKSPACE}/.env:/usr/app/.env \
	${DK_SIO_IMAGE} bash

dev-interactive: ## Run dev sioux in interactive mode
	@docker run --rm -it \
	-v ${WORKSPACE}/lib:/usr/app/lib \
	-v ${WORKSPACE}/formatters:/usr/app/formatters \
	-v ${WORKSPACE}/vhosts:/usr/app/vhosts \
	-v ${WORKSPACE}/tests:/usr/app/tests \
	-v ${WORKSPACE}/.env:/usr/app/.env \
	${DK_SIO_IMAGE} bash