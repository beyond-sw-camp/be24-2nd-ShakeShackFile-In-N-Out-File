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

  parameters {
    string(name: 'K8S_NAMESPACE', defaultValue: '', description: 'Target namespace. Leave blank to auto-detect.')
    string(name: 'K8S_DEPLOYMENT', defaultValue: '', description: 'Target deployment name. Leave blank to auto-detect.')
    string(name: 'K8S_CONTAINER', defaultValue: '', description: 'Target container name inside the deployment. Leave blank to auto-detect.')
  }

  environment {
    IMAGE_NAME = 'lumisia/waffle-frontend'   
    IMAGE_TAG  = "${env.BUILD_NUMBER}"
  }
  stages {
    stage('Frontend Build') {
      steps {
        container('node') {
          sh '''
            npm ci
            npm run build
          '''
        }
      }
    }

    stage('Kaniko Build & Push') {
      steps {
        container('kaniko') {
          sh """
            /kaniko/executor \
              --context=${WORKSPACE} \
              --dockerfile=${WORKSPACE}/Dockerfile \
              --destination=${IMAGE_NAME}:${IMAGE_TAG} \
              --destination=${IMAGE_NAME}:latest \
              --single-snapshot \
              --use-new-run \
              --snapshot-mode=redo
          """
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        container('kubectl') {
          sh '''
            set -eu

            TARGET_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
            CURRENT_NAMESPACE="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null || true)"

            matches_image() {
              case "$1" in
                "${IMAGE_NAME}"|"${IMAGE_NAME}:"*|"docker.io/${IMAGE_NAME}"|"docker.io/${IMAGE_NAME}:"*|"index.docker.io/${IMAGE_NAME}"|"index.docker.io/${IMAGE_NAME}:"*)
                  return 0
                  ;;
                *)
                  return 1
                  ;;
              esac
            }

            find_target() {
              SCOPE_ARGS="$1"

              kubectl get deployment ${SCOPE_ARGS} -o jsonpath='{range .items[*]}{.metadata.namespace}{"|"}{.metadata.name}{"|"}{range .spec.template.spec.containers[*]}{.name}{"="}{.image}{","}{end}{"\\n"}{end}' \
              | while IFS='|' read -r ns deploy containers; do
                  [ -n "$ns" ] || continue
                  OLDIFS="$IFS"
                  IFS=','
                  for pair in $containers; do
                    [ -n "$pair" ] || continue
                    cname="${pair%%=*}"
                    cimage="${pair#*=}"
                    if matches_image "$cimage"; then
                      printf '%s|%s|%s\\n' "$ns" "$deploy" "$cname"
                    fi
                  done
                  IFS="$OLDIFS"
                done
            }

            if [ -n "${K8S_DEPLOYMENT}" ] && [ -n "${K8S_CONTAINER}" ]; then
              TARGET_NS="${K8S_NAMESPACE:-${CURRENT_NAMESPACE}}"
              TARGET_DEPLOY="${K8S_DEPLOYMENT}"
              TARGET_CONTAINER="${K8S_CONTAINER}"
            else
              TARGET_SCAN_NAMESPACE="${K8S_NAMESPACE:-${CURRENT_NAMESPACE}}"

              if [ -z "${TARGET_SCAN_NAMESPACE}" ]; then
                echo "Could not determine the namespace for deployment lookup."
                echo "Set K8S_NAMESPACE, or run Jenkins inside the target namespace."
                exit 1
              fi

              if ! MATCHES_RAW="$(find_target "-n ${TARGET_SCAN_NAMESPACE}" 2>&1)"; then
                echo "Jenkins service account cannot inspect deployments in namespace ${TARGET_SCAN_NAMESPACE}."
                echo "Grant deployment permissions or set K8S_DEPLOYMENT and K8S_CONTAINER after RBAC is configured."
                echo "${MATCHES_RAW}"
                exit 1
              fi

              MATCHES="$(printf '%s\\n' "${MATCHES_RAW}" | sed '/^$/d')"
              MATCH_COUNT="$(printf '%s\\n' "$MATCHES" | sed '/^$/d' | wc -l | tr -d ' ')"

              if [ "$MATCH_COUNT" -eq 0 ]; then
                echo "No deployment found using image ${IMAGE_NAME} in namespace ${TARGET_SCAN_NAMESPACE}."
                echo "Set K8S_DEPLOYMENT and K8S_CONTAINER in Jenkins parameters if auto-discovery cannot find it."
                exit 1
              fi

              if [ "$MATCH_COUNT" -gt 1 ]; then
                echo "Multiple deployments found using image ${IMAGE_NAME}:"
                printf '%s\\n' "$MATCHES"
                echo "Set K8S_DEPLOYMENT and K8S_CONTAINER in Jenkins parameters to pick the exact target."
                exit 1
              fi

              TARGET_NS="$(printf '%s' "$MATCHES" | cut -d'|' -f1)"
              TARGET_DEPLOY="$(printf '%s' "$MATCHES" | cut -d'|' -f2)"
              TARGET_CONTAINER="$(printf '%s' "$MATCHES" | cut -d'|' -f3)"
            fi

            echo "Deploying ${TARGET_IMAGE} to deployment/${TARGET_DEPLOY} in namespace ${TARGET_NS} (container: ${TARGET_CONTAINER})"
            kubectl set image "deployment/${TARGET_DEPLOY}" "${TARGET_CONTAINER}=${TARGET_IMAGE}" -n "${TARGET_NS}"
            kubectl rollout status "deployment/${TARGET_DEPLOY}" -n "${TARGET_NS}" --timeout=180s
            kubectl get deployment "${TARGET_DEPLOY}" -n "${TARGET_NS}" -o wide
          '''
        }
      }
    }

    stage('Result') {
      steps {
        echo "Pushed and deployed: ${IMAGE_NAME}:${IMAGE_TAG}"
      }
    }
  }
}
