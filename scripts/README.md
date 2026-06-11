chmod +x scripts/apply-vscode-profiles.sh

# 전체 적용

./scripts/apply-vscode-profiles.sh

chmod +x scripts/apply-vscode-profiles.mjs
# 먼저 삭제될 확장 확인
node scripts/advanced/apply-vscode-profile-files.mjs ai-python --sync-extensions --dry-run

# 실제 동기화
node scripts/advanced/apply-vscode-profile-files.mjs ai-python --sync-extensions

# id 없는 프로필은 생성하면서 전체 동기화 dry-run
node scripts/advanced/apply-vscode-profile-files.mjs all --create-missing-profiles --sync-extensions --dry-run

# 전체 실제 적용
node scripts/advanced/apply-vscode-profile-files.mjs all --create-missing-profiles --sync-extensions

5. profile ID 확인 방법

가장 확실한 방법입니다.

1. VS Code에서 Frontend 프로필로 전환
2. Command Palette 열기
3. Preferences: Open User Settings (JSON) 실행
4. 열린 파일 경로 확인
5. 경로가 .../profiles/71f1b895/settings.json 이면 Frontend id는 71f1b895

그렇게 확인한 뒤:

{
"frontend": {
"name": "Frontend",
"id": "71f1b895"
}
}

이런 식으로 채우면 됩니다.

6. dry-run

적용 전에 반드시 먼저 확인하세요.

node scripts/advanced/apply-vscode-profile-files.mjs all --dry-run

특정 프로필만 확인:

node scripts/advanced/apply-vscode-profile-files.mjs frontend --dry-run
node scripts/advanced/apply-vscode-profile-files.mjs rust --dry-run
node scripts/advanced/apply-vscode-profile-files.mjs cpp --dry-run

확장 설치 없이 파일 복사만 확인:

node scripts/advanced/apply-vscode-profile-files.mjs all --dry-run --no-extensions 7. 실제 적용

VS Code를 완전히 종료한 뒤 실행하세요.

node scripts/advanced/apply-vscode-profile-files.mjs all

특정 프로필만 적용:

node scripts/advanced/apply-vscode-profile-files.mjs frontend
node scripts/advanced/apply-vscode-profile-files.mjs rust
node scripts/advanced/apply-vscode-profile-files.mjs cpp
node scripts/advanced/apply-vscode-profile-files.mjs graphics

확장 설치 없이 설정 파일만 적용:

node scripts/advanced/apply-vscode-profile-files.mjs all --no-extensions 8. 이 스크립트가 적용하는 것
common/settings.json + profile/settings.json → 내부 profile/settings.json
common/keybindings.json + profile/keybindings.json → 내부 profile/keybindings.json
common/tasks.json + profile/tasks.json → 내부 profile/tasks.json
common/mcp.json + profile/mcp.json → 내부 profile/mcp.json
common/snippets/_.json + profile/snippets/_.json → 내부 profile/snippets/

확장은 extensions.json 파일을 직접 복사하지 않고, CLI로 설치합니다.

code --install-extension <extension-id> --profile "<ProfileName>" --force

reviewNeeded는 설치하지 않고 콘솔에만 표시됩니다.

9. 백업 위치

기존 파일은 자동 백업됩니다.

.backups/
└─ vscode-profiles/
└─ 20260612-153012/
├─ frontend/
│ ├─ settings.json
│ ├─ keybindings.json
│ ├─ tasks.json
│ ├─ mcp.json
│ └─ snippets/
└─ rust/
└─ ...
