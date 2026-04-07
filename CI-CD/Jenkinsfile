pipeline {
  agent {
    kubernetes {
      label "node-kaniko-${UUID.randomUUID().toString()}"
      defaultContainer 'node'
      yaml """
apiVersion: v1
kind: Pod
spec:
  restartPolicy: Never
  containers:
    - name: node
      image: node:22.17.1-bullseye
      command: ['cat']
      tty: true
    - name: kaniko
      image: gcr.io/kaniko-project/executor:debug
      command: ['/busybox/sh','-c','sleep infinity']
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
        - name: workspace
          mountPath: /workspace
    - name: kubectl
      image: bitnami/kubectl@sha256:f6dd048d1c14d89ede9636cd6bee0ff0238579c33ea1e51b2fb1a1cfd62ea246
      command: ['/bin/sh','-c','sleep infinity']
      tty: true
      securityContext:
        runAsUser: 1000
  volumes:
    - name: workspace
      emptyDir: {}
    - name: docker-config
      secret:
        secretName: dockerhub-cred
        items:
          - key: .dockerconfigjson
            path: config.json
"""
    }
  }

  triggers {
    pollSCM('H/5 * * * *')
  }

  parameters {
    string(name: 'K8S_NAMESPACE', defaultValue: 'helm-service', description: 'Target namespace.')
    string(name: 'HELM_RELEASE_NAME', defaultValue: 'waffle-release', description: 'Helm release name used to derive service and rollout names.')
    choice(name: 'FRONTEND_RESOURCE_KIND', choices: ['rollout', 'deployment'], description: 'Frontend workload kind to update.')
    string(name: 'FRONTEND_RESOURCE_NAME', defaultValue: 'waffle-release-wafflebear-frontend', description: 'Frontend workload name.')
    string(name: 'FRONTEND_CONTAINER', defaultValue: 'frontend', description: 'Frontend container name inside the workload.')
    choice(name: 'WEBSOCKET_RESOURCE_KIND', choices: ['rollout', 'deployment'], description: 'Websocket workload kind to update.')
    string(name: 'WEBSOCKET_RESOURCE_NAME', defaultValue: 'waffle-release-wafflebear-websocket', description: 'Websocket workload name.')
    string(name: 'WEBSOCKET_CONTAINER', defaultValue: 'websocket-server', description: 'Websocket container name inside the workload.')
  }

  environment {
    DOCKERFILE_PATH = "${env.WORKSPACE}/CI-CD/Dockerfile"
    FRONTEND_IMAGE_NAME = 'lumisia/frontend'
    WEBSOCKET_IMAGE_NAME = 'lumisia/websocket-server'
    BACKEND_IMAGE_NAME = 'lumisia/backend'
    IMAGE_TAG = "v${env.BUILD_NUMBER}"
  }

  stages {
    stage('Frontend Build') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'main' || env.GIT_BRANCH == 'origin/main' }
        }
      }
      steps {
        container('node') {
          sh '''
            set -eu
            npm ci
            npm run build
          '''
        }
      }
    }

    stage('Kaniko Build & Push') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'main' || env.GIT_BRANCH == 'origin/main' }
        }
      }
      steps {
        container('kaniko') {
          sh '''
            set -eu

            TARGET_NS="${K8S_NAMESPACE:-helm-service}"
            HELM_RELEASE="${HELM_RELEASE_NAME:-waffle-release}"
            BACKEND_UPSTREAM="${HELM_RELEASE}-wafflebear-backend.${TARGET_NS}.svc.cluster.local:8080"
            REALTIME_UPSTREAM="${HELM_RELEASE}-wafflebear-websocket.${TARGET_NS}.svc.cluster.local:1234"

            /kaniko/executor \
              --context="${WORKSPACE}" \
              --dockerfile="${DOCKERFILE_PATH}" \
              --target=frontend-runtime \
              --build-arg BACKEND_UPSTREAM="${BACKEND_UPSTREAM}" \
              --build-arg REALTIME_UPSTREAM="${REALTIME_UPSTREAM}" \
              --destination="${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}" \
              --destination="${FRONTEND_IMAGE_NAME}:latest" \
              --single-snapshot \
              --use-new-run \
              --snapshot-mode=redo

            /kaniko/executor \
              --context="${WORKSPACE}" \
              --dockerfile="${DOCKERFILE_PATH}" \
              --target=websocket-runtime \
              --destination="${WEBSOCKET_IMAGE_NAME}:${IMAGE_TAG}" \
              --destination="${WEBSOCKET_IMAGE_NAME}:latest" \
              --single-snapshot \
              --use-new-run \
              --snapshot-mode=redo
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'main' || env.GIT_BRANCH == 'origin/main' }
        }
      }
      steps {
        container('kubectl') {
          sh '''
            set -eu

            CURRENT_NAMESPACE="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null || true)"
            TARGET_NS="${K8S_NAMESPACE:-${CURRENT_NAMESPACE:-helm-service}}"
            HELM_RELEASE="${HELM_RELEASE_NAME:-waffle-release}"
            LEGACY_FRONTEND_NAME="waffle-release-wafflebear-frontend"
            LEGACY_WEBSOCKET_NAME="waffle-release-wafflebear-websocket"
            FRONTEND_KIND="${FRONTEND_RESOURCE_KIND:-rollout}"
            if [ -z "${FRONTEND_RESOURCE_NAME:-}" ] || [ "${FRONTEND_RESOURCE_NAME}" = "${LEGACY_FRONTEND_NAME}" ]; then
              FRONTEND_NAME="${HELM_RELEASE}-wafflebear-frontend"
            else
              FRONTEND_NAME="${FRONTEND_RESOURCE_NAME}"
            fi
            FRONTEND_TARGET_CONTAINER="${FRONTEND_CONTAINER:-frontend}"
            WEBSOCKET_KIND="${WEBSOCKET_RESOURCE_KIND:-rollout}"
            if [ -z "${WEBSOCKET_RESOURCE_NAME:-}" ] || [ "${WEBSOCKET_RESOURCE_NAME}" = "${LEGACY_WEBSOCKET_NAME}" ]; then
              WEBSOCKET_NAME="${HELM_RELEASE}-wafflebear-websocket"
            else
              WEBSOCKET_NAME="${WEBSOCKET_RESOURCE_NAME}"
            fi
            WEBSOCKET_TARGET_CONTAINER="${WEBSOCKET_CONTAINER:-websocket-server}"

            wait_for_rollout() {
              RESOURCE_REF="$1"
              TIMEOUT_SECONDS="${2:-900}"
              START_TIME="$(date +%s)"

              while true; do
                NOW="$(date +%s)"
                ELAPSED="$((NOW - START_TIME))"

                PHASE="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
                MESSAGE="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.message}' 2>/dev/null || true)"
                CURRENT_HASH="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.currentPodHash}' 2>/dev/null || true)"
                STABLE_HASH="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.stableRS}' 2>/dev/null || true)"
                UPDATED_REPLICAS="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.updatedReplicas}' 2>/dev/null || true)"
                READY_REPLICAS="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
                AVAILABLE_REPLICAS="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true)"

                echo "Rollout ${RESOURCE_REF}: phase=${PHASE:-unknown}, updated=${UPDATED_REPLICAS:-0}, ready=${READY_REPLICAS:-0}, available=${AVAILABLE_REPLICAS:-0}, current=${CURRENT_HASH:-n/a}, stable=${STABLE_HASH:-n/a}"
                if [ -n "${MESSAGE}" ]; then
                  echo "Rollout message: ${MESSAGE}"
                fi

                case "${PHASE}" in
                  Healthy)
                    return 0
                    ;;
                  Degraded|Aborted)
                    echo "Rollout ${RESOURCE_REF} entered ${PHASE}."
                    kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o yaml
                    exit 1
                    ;;
                esac

                if [ "${ELAPSED}" -ge "${TIMEOUT_SECONDS}" ]; then
                  echo "Timed out waiting for ${RESOURCE_REF} to become healthy."
                  kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o yaml
                  exit 1
                fi

                sleep 10
              done
            }

            update_workload() {
              TARGET_KIND="$1"
              TARGET_NAME="$2"
              TARGET_CONTAINER="$3"
              TARGET_IMAGE="$4"

              if [ -z "${TARGET_NS}" ] || [ -z "${TARGET_NAME}" ] || [ -z "${TARGET_CONTAINER}" ]; then
                echo "K8S_NAMESPACE, workload name, and container name must be set."
                exit 1
              fi

              if [ "${TARGET_KIND}" = "rollout" ]; then
                RESOURCE_REF="rollout.argoproj.io/${TARGET_NAME}"
                echo "Patching ${RESOURCE_REF} in namespace ${TARGET_NS} with image ${TARGET_IMAGE}"

                kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}"
                kubectl patch "${RESOURCE_REF}" -n "${TARGET_NS}" --type='merge' -p "{
                  \\"spec\\": {
                    \\"template\\": {
                      \\"spec\\": {
                        \\"containers\\": [
                          {
                            \\"name\\": \\"${TARGET_CONTAINER}\\",
                            \\"image\\": \\"${TARGET_IMAGE}\\"
                          }
                        ]
                      }
                    }
                  }
                }"

                UPDATED_IMAGE="$(kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o jsonpath="{range .spec.template.spec.containers[?(@.name=='${TARGET_CONTAINER}')]}{.image}{end}")"
                if [ "${UPDATED_IMAGE}" != "${TARGET_IMAGE}" ]; then
                  echo "Rollout image update did not stick. Current image: ${UPDATED_IMAGE}"
                  exit 1
                fi

                wait_for_rollout "${RESOURCE_REF}" 900
                kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o wide || kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o yaml
              else
                RESOURCE_REF="deployment/${TARGET_NAME}"
                echo "Updating ${RESOURCE_REF} in namespace ${TARGET_NS} with image ${TARGET_IMAGE}"
                kubectl set image "${RESOURCE_REF}" "${TARGET_CONTAINER}=${TARGET_IMAGE}" -n "${TARGET_NS}"
                kubectl rollout status "${RESOURCE_REF}" -n "${TARGET_NS}" --timeout=180s
                kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o wide
              fi
            }

            update_workload "${FRONTEND_KIND}" "${FRONTEND_NAME}" "${FRONTEND_TARGET_CONTAINER}" "${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}"
            update_workload "${WEBSOCKET_KIND}" "${WEBSOCKET_NAME}" "${WEBSOCKET_TARGET_CONTAINER}" "${WEBSOCKET_IMAGE_NAME}:${IMAGE_TAG}"
          '''
        }
      }
    }

    stage('Result') {
      when {
        anyOf {
          branch 'main'
          expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'main' || env.GIT_BRANCH == 'origin/main' }
        }
      }
      steps {
        echo "Pushed and deployed: ${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}"
        echo "Pushed and deployed: ${WEBSOCKET_IMAGE_NAME}:${IMAGE_TAG}"
      }
    }
  }
}
