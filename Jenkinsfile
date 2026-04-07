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
    string(name: 'K8S_NAMESPACE', defaultValue: 'helm-service', description: 'Target namespace.')
    choice(name: 'K8S_RESOURCE_KIND', choices: ['rollout', 'deployment'], description: 'Workload kind to update.')
    string(name: 'K8S_RESOURCE_NAME', defaultValue: 'waffle-release-wafflebear-frontend', description: 'Target workload name.')
    string(name: 'K8S_CONTAINER', defaultValue: 'frontend', description: 'Target container name inside the workload.')
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
            TARGET_NS="${K8S_NAMESPACE:-${CURRENT_NAMESPACE:-helm-service}}"
            TARGET_KIND="${K8S_RESOURCE_KIND:-rollout}"
            TARGET_NAME="${K8S_RESOURCE_NAME:-waffle-release-wafflebear-frontend}"
            TARGET_CONTAINER="${K8S_CONTAINER:-frontend}"

            if [ -z "${TARGET_NS}" ] || [ -z "${TARGET_NAME}" ] || [ -z "${TARGET_CONTAINER}" ]; then
              echo "K8S_NAMESPACE, K8S_RESOURCE_NAME, and K8S_CONTAINER must be set."
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

              kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o wide || kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o yaml
            else
              RESOURCE_REF="deployment/${TARGET_NAME}"
              echo "Updating ${RESOURCE_REF} in namespace ${TARGET_NS} with image ${TARGET_IMAGE}"
              kubectl set image "${RESOURCE_REF}" "${TARGET_CONTAINER}=${TARGET_IMAGE}" -n "${TARGET_NS}"
              kubectl rollout status "${RESOURCE_REF}" -n "${TARGET_NS}" --timeout=180s
              kubectl get "${RESOURCE_REF}" -n "${TARGET_NS}" -o wide
            fi
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
