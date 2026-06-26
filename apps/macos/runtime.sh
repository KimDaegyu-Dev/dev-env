# nvm 다운로드 및 설치:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Node.js 다운로드 및 설치:
nvm install --lts
# Node.js 버전 확인:
node -v # "v24.18.0"가 출력되어야 합니다.
nvm current # "v24.18.0"가 출력되어야 합니다.
# Verify the Node.js version:
node -v # Should print "v24.18.0".
# pnpm 다운로드 및 설치:
corepack enable pnpm
# pnpm 버전 확인:
pnpm -v
