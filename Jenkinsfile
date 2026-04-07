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

  environment {
    IMAGE_NAME = 'lumisia/waffle-frontend'   
    IMAGE_TAG  = "${env.BUILD_NUMBER}"
  }
  stages {
    stage('Checkout') {
      steps {
        container('node') {
          checkout([$class: 'GitSCM',
            branches: [[name: '*/main']],
            userRemoteConfigs: [[url: 'https://github.com/beyond-sw-camp/be24-2nd-ShakeShackFile-In-N-Out-File.git']]
          ])
        }
      }
    }

    stage('Gradle Build') {
      steps {
        container('node') {
          sh '''
            npm i
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
              --cache=true \
              --snapshotMode=redo
          """
        }
      }
    }

    stage('Result') {
      steps {
        echo "Pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
      }
    }
  }
}