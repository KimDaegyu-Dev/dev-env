# Application packages

앱 목록의 단일 진실 원천은 [`config/packages.yaml`](../config/packages.yaml)입니다.

논리 패키지 하나에 플랫폼별 공급자를 연결합니다.

```yaml
- id: git
  profiles: [base]
  providers:
    macos: { manager: brew, id: git }
    windows: { manager: winget, id: Git.Git }
    ubuntu: { manager: apt, id: git }
```

사용법:

```bash
dev-env setup --only packages
dev-env update
dev-env cleanup
```

기존 Brewfile과 WinGet JSON은 중복 방지를 위해 제거했습니다. 플랫폼 네이티브 명령은 control plane이 실행 계획에 생성합니다.

Vulkan SDK, GPU driver, RenderDoc, Nsight처럼 라이선스·하드웨어·로그인이 필요한 도구는 자동 설치 범위에서 제외하고 공식 설치 프로그램을 사용합니다.
