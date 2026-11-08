# Installing Short++

## Quick check

```bash
npm run doctor
```

환경을 점검하고 무엇이 빠졌는지 알려 준다. 설치가 안 될 때는 이 출력을 그대로 복사해서 물어보면 된다.

## Normal install

```bash
npm install
npm start
```

- **Node 20.19 이상**이 필요하다. `node -v`로 확인한다. 없으면 [nodejs.org](https://nodejs.org)에서 LTS를 설치한다.
- `npm install`은 두 가지 일을 한다. 패키지 목록을 받고(수 초), **Electron 실행 파일 약 100MB를 따로 내려받는다**(수 분). 설치가 실패한다면 거의 항상 두 번째 단계다.
- 설치할 때 `package-lock.json`이 함께 있어야 모든 컴퓨터에서 같은 버전이 깔린다. 압축을 풀 때 폴더째로 풀어야 한다.

## Electron binary

`npm install`이 `RequestError`, `ETIMEDOUT`, `ECONNRESET`, `certificate`, `404`, `EACCES` 같은 말을 내며 멈춘다면 Electron 실행 파일을 받지 못한 것이다. GitHub 릴리스에서 받아 오기 때문에 회사망, 학교망, 방화벽 뒤에서 자주 막힌다.

**1. 미러를 지정한다.** 국내망에서 가장 잘 듣는 방법이다.

```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm install
```

**2. 프록시를 쓰는 환경이라면 함께 알려 준다.**

```bash
npm config set proxy http://프록시주소:포트
npm config set https-proxy http://프록시주소:포트
set ELECTRON_GET_USE_PROXY=true        # Windows
export ELECTRON_GET_USE_PROXY=true     # macOS, Linux
```

**3. 받다 만 캐시를 지우고 다시 받는다.**

| OS | 지울 폴더 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\electron\Cache` |
| macOS | `~/Library/Caches/electron` |
| Linux | `~/.cache/electron` |

```bash
rm -rf node_modules package-lock.json   # 락 파일은 다시 받지 말고 원본을 쓰는 편이 낫다
npm install
```

**4. 진짜 오류 메시지를 본다.** `npm install`은 오류를 삼킬 때가 있다. 아래 명령은 내려받기를 직접 실행해서 원인을 그대로 보여 준다.

```bash
node -e "console.log(require('electron'))"
```

**5. 그래도 안 되면 손으로 넣는다.** 인터넷이 되는 다른 컴퓨터에서 [Electron 44.3.0 릴리스](https://github.com/electron/electron/releases/tag/v44.3.0)의 `electron-v44.3.0-<os>-<arch>.zip`을 받아 위 캐시 폴더에 넣고 `npm install`을 다시 돌린다.

## Building installers

```bash
npm run dist
```

- 설치 파일은 **그 운영체제에서 만들어야 한다.** Windows 설치 파일은 Windows에서, dmg는 macOS에서 만든다. 결과물은 `dist/`에 생긴다.
- `npm run dist:dir`는 설치 파일 없이 실행 폴더만 만든다. 설정이 맞는지 빠르게 보고 싶을 때 쓴다.
- 처음 빌드할 때 빌드 도구를 몇십 MB 더 받는다. 역시 막힌 망에서는 실패할 수 있다.

## After installing

- **macOS**: 서명하지 않은 앱이라 "손상되었기 때문에 열 수 없습니다"가 뜰 수 있다. 앱을 우클릭해서 열거나, 터미널에서 `xattr -cr "/Applications/Short++.app"`을 실행한다.
- **Windows**: SmartScreen이 막으면 "추가 정보" → "실행"을 누른다.
- **Linux**: AppImage에 실행 권한을 준다(`chmod +x ShortPP-*.AppImage`). `libfuse2`가 없다는 오류가 나면 그것을 설치하거나 `--appimage-extract-and-run` 옵션을 붙여 실행한다.

## Without installing anything

설치가 끝내 안 되면 `renderer/index.html`을 브라우저로 열어도 된다. 에디터, 압축, 제안, 치트시트, 템플릿, 자동완성은 그대로 동작하고 작업 내용은 브라우저에 저장된다. 디스크의 파일을 열고 저장하는 기능과 코드 실행만 빠진다.
