import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export const helpText = {
  "tab.overview":
    "현재 기기의 환경 상태를 요약합니다. 먼저 Run doctor를 실행한 뒤 failure와 warning의 권장 조치를 확인하세요.",
  "tab.setup":
    "선택한 profile과 component를 선언 상태에 맞추는 계획을 만듭니다. 이미 올바른 항목은 건너뛰므로 반복 실행해도 안전합니다.",
  "tab.packages":
    "논리 패키지를 현재 OS의 Homebrew, WinGet 또는 APT 공급자와 연결해 설치·업데이트·정리 상태를 관리합니다.",
  "tab.runtimes":
    "mise가 관리하는 Node, Python, Java, Rust 등의 목표 버전과 현재 설치 버전을 비교합니다.",
  "tab.links":
    "linkPath에서 targetPath를 가리키는 링크를 관리합니다. 기존 파일은 적용 전에 상태 디렉터리로 백업됩니다.",
  "tab.checks":
    "저장소의 포맷, lint, typecheck, 테스트와 Shell 검사를 한곳에서 실행합니다. Check는 읽기 전용이고 Format은 파일을 수정합니다.",
  "tab.config":
    "커밋되는 YAML 설정을 구조화된 폼으로 편집합니다. 저장 전에 스키마·교차 참조·revision과 YAML diff를 검증합니다.",
  "tab.activity":
    "저장된 plan 실행 결과와 현재 대시보드 세션의 실시간 이벤트를 보여줍니다. 실패한 작업의 stderr도 여기에서 확인할 수 있습니다.",
  "status.pass": "현재 상태가 선언된 기대 상태와 일치합니다. 별도 조치가 필요하지 않습니다.",
  "status.warning":
    "동작은 가능하지만 선언과 다르거나 선택 기능이 준비되지 않았습니다. 표시된 권장 조치를 검토하세요.",
  "status.failure":
    "필수 조건이 충족되지 않았습니다. setup 또는 결과에 표시된 권장 명령으로 수정해야 합니다.",
  "status.skipped":
    "현재 OS에서 검사기를 사용할 수 없거나 선행 조건이 없어 검사를 실행하지 않았습니다.",
  "stats.health": "마지막 doctor 결과의 failure와 warning 개수입니다.",
  "stats.packages": "현재 기기의 활성 profile에 포함되는 선언 패키지 수입니다.",
  "stats.runtimes": "config/runtimes.yaml에서 mise로 관리하도록 선언한 도구 수입니다.",
  "stats.links": "현재 기기에 연결된 파일·디렉터리 링크 선언 수입니다.",
  "action.refresh": "서버의 최신 상태, 설정, inventory와 activity를 다시 불러옵니다.",
  "action.doctor":
    "패키지 관리자, 패키지, 런타임, Shell, VS Code, 링크, 권한과 디스크 상태를 읽기 전용으로 진단합니다.",
  "action.setupPlan":
    "선택한 범위에서 부족한 항목만 계산해 plan을 만듭니다. 이 버튼만으로 시스템은 변경되지 않습니다.",
  "action.updatePlan":
    "선언된 패키지, mise 런타임과 VS Code 확장의 사용 가능한 업데이트를 계산합니다. 아직 적용하지 않습니다.",
  "action.cleanupPlan":
    "dev-env가 설치 기록을 가진 제거 대상과 안전한 패키지 관리자 정리 작업만 계획합니다. 임의의 시스템 패키지는 제거하지 않습니다.",
  "action.runChecks": "파일을 수정하지 않고 모든 설정된 검사기를 실행합니다.",
  "action.format":
    "Prettier, Biome, shfmt 등 사용 가능한 formatter를 실행해 저장소 파일을 실제로 수정합니다.",
  "action.planLinks":
    "사용 가능한 target만 대상으로 필요한 링크와 백업 작업을 계산합니다. 이 단계에서는 파일을 이동하지 않습니다.",
  "action.restoreLink":
    "해당 링크에 대해 dev-env가 기록한 가장 최근 백업을 복원하는 plan을 만듭니다.",
  "action.validatePreview":
    "현재 폼을 전체 설정과 함께 검증하고 저장될 YAML의 before/after diff를 만듭니다. 아직 저장하지 않습니다.",
  "action.saveConfiguration":
    "검증된 diff를 config YAML에 원자적으로 저장합니다. revision이 바뀌었다면 충돌로 거부됩니다.",
  "action.applyPlan":
    "미리 본 plan의 작업을 순서대로 실행합니다. 실행 전에 설정 revision과 plan 만료 시간을 다시 확인합니다.",
  "action.terminalPlan":
    "관리자 권한이 필요한 plan은 웹 서버가 sudo를 실행하지 않습니다. 표시된 명령을 터미널에서 실행하고 직접 승인하세요.",
  "action.copyCommand": "터미널에서 실행할 apply-plan 명령을 클립보드에 복사합니다.",
  "setup.profiles":
    "설치할 사용 목적 묶음입니다. base, develop, ai, design처럼 패키지 범위를 조합합니다.",
  "setup.components":
    "이번 setup plan에 포함할 환경 영역입니다. 선택하지 않은 영역은 검사하거나 변경하지 않습니다.",
  "plan.preview":
    "실행 전에 생성된 작업, 권한 요구 여부와 경고를 검토하는 화면입니다. plan은 30분 후 만료됩니다.",
  "links.toggle": "이 선언을 링크 plan에 포함할지 결정합니다. 설정 저장 전에는 반영되지 않습니다.",
  "links.linkPath":
    "링크가 만들어질 위치입니다. 기존 항목이 있으면 적용 시 먼저 백업한 뒤 링크로 교체합니다.",
  "links.targetPath":
    "실제 데이터가 존재하는 대상 경로입니다. 외장 볼륨이 없으면 변경하지 않고 warning으로 처리합니다.",
  "config.domain.machines":
    "기기 선택 조건, 활성 profile, VS Code profile과 기기별 절대 경로를 관리합니다.",
  "config.domain.packages": "논리 패키지와 OS별 Homebrew·WinGet·APT 공급자 ID를 관리합니다.",
  "config.domain.runtimes": "mise가 설치하고 업데이트할 도구와 목표 버전 범위를 관리합니다.",
  "config.domain.links": "기기별 linkPath→targetPath 선언과 Windows 링크 방식을 관리합니다.",
  "config.domain.checks": "dev-env check와 format에서 실행할 검사기 명령과 인수를 관리합니다.",
  "field.schemaVersion":
    "설정 파일 형식의 버전입니다. 현재는 1만 지원하므로 임의로 변경하지 마세요.",
  "field.selectors": "hostname, OS, WSL 여부를 조합해 현재 기기에 적용할 machine을 선택합니다.",
  "field.os": "이 machine이 적용되는 운영체제입니다: macos, windows 또는 linux.",
  "field.hostname": "지정하면 이 hostname과 정확히 일치하는 기기에서만 machine이 자동 선택됩니다.",
  "field.wsl": "Linux 환경이 WSL인지 네이티브 Ubuntu인지 구분합니다.",
  "field.profiles": "이 machine 또는 패키지에 활성화할 목적별 구성 묶음입니다.",
  "field.vscodeProfiles": "공통 확장과 함께 동기화할 VS Code profile slug 목록입니다.",
  "field.paths": `기기별 절대 경로 별칭입니다. ~, 허용된 환경변수와 \${paths.externalAi} 같은 참조만 사용할 수 있고 명령 치환은 금지됩니다.`,
  "field.providers": "각 OS에서 같은 논리 패키지를 설치할 네이티브 패키지 공급자입니다.",
  "field.manager": "사용할 패키지 관리자 종류입니다. 선택한 OS와 호환되는 값을 사용하세요.",
  "field.tools": "mise 도구 이름을 key로, 목표 버전 범위를 value로 선언하는 목록입니다.",
  "field.runtimeVersion":
    "major 또는 minor 범위를 고정하면 그 범위 안에서 patch가 업데이트됩니다. stable과 latest 채널도 사용할 수 있습니다.",
  "field.machines":
    "이 링크 선언을 사용할 machine ID 목록입니다. machines 설정에 존재하는 ID만 허용됩니다.",
  "field.linkPath": `링크가 생성될 절대 경로입니다. ~, \${repoRoot}, \${paths.name} 문법을 사용할 수 있습니다.`,
  "field.targetPath":
    "링크가 가리킬 실제 절대 경로입니다. 대상이 없으면 적용하지 않고 warning으로 남깁니다.",
  "field.kind": "file은 파일 심볼릭 링크, directory는 디렉터리 링크를 만듭니다.",
  "field.windowsMode":
    "Windows 디렉터리는 기본적으로 관리자 권한이 덜 필요한 junction을 사용하며 필요할 때 symlink를 선택할 수 있습니다.",
  "field.enabled": "false이면 선언은 보존하지만 setup과 links plan에서 제외합니다.",
  "field.command":
    "검사기 실행 파일입니다. 임의 shell 문자열이 아니라 PATH에서 찾을 단일 명령을 입력합니다.",
  "field.checkArgs": "읽기 전용 check에서 명령에 전달할 인수 목록입니다.",
  "field.formatArgs": "format에서 파일을 수정하도록 명령에 전달할 인수 목록입니다.",
  "field.required": "필수 검사기가 없으면 failure, 선택 검사기가 없으면 skipped로 처리합니다.",
  "field.optional":
    "선택 필드를 추가하거나 제거합니다. Validate & preview를 통과해야 저장할 수 있습니다.",
  "field.array":
    "목록 항목을 추가하거나 제거합니다. 변경 내용은 preview 전까지 메모리에만 유지됩니다.",
  "field.record": "새 key를 추가하거나 기존 key를 제거합니다. 전체 스키마 검증 후에만 저장됩니다.",
} as const;

export type HelpKey = keyof typeof helpText;

const tabHelpKeys = {
  overview: "tab.overview",
  setup: "tab.setup",
  packages: "tab.packages",
  runtimes: "tab.runtimes",
  links: "tab.links",
  checks: "tab.checks",
  config: "tab.config",
  activity: "tab.activity",
} as const satisfies Record<string, HelpKey>;

export function tabHelpKey(tab: keyof typeof tabHelpKeys): HelpKey {
  return tabHelpKeys[tab];
}

export function fieldHelpKey(path: Array<string | number>): HelpKey | undefined {
  const field = String(path.at(-1) ?? "");
  const parent = String(path.at(-2) ?? "");
  if (parent === "tools") return "field.runtimeVersion";
  const keys: Partial<Record<string, HelpKey>> = {
    schemaVersion: "field.schemaVersion",
    selectors: "field.selectors",
    os: "field.os",
    hostname: "field.hostname",
    wsl: "field.wsl",
    profiles: "field.profiles",
    vscodeProfiles: "field.vscodeProfiles",
    paths: "field.paths",
    providers: "field.providers",
    manager: "field.manager",
    tools: "field.tools",
    machines: "field.machines",
    linkPath: "field.linkPath",
    targetPath: "field.targetPath",
    kind: "field.kind",
    windowsMode: "field.windowsMode",
    enabled: "field.enabled",
    command: "field.command",
    checkArgs: "field.checkArgs",
    formatArgs: "field.formatArgs",
    required: "field.required",
  };
  return keys[field];
}

type Position = { top: number; left: number; placement: "top" | "bottom" };

export function HelpTooltip({
  helpKey,
  label,
  children,
}: {
  helpKey: HelpKey;
  label: string;
  children?: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, placement: "bottom" });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const gap = 8;
    const edge = 12;
    const left = Math.min(
      window.innerWidth - width - edge,
      Math.max(edge, triggerRect.left + triggerRect.width / 2 - width / 2),
    );
    const fitsBelow = triggerRect.bottom + gap + height <= window.innerHeight - edge;
    const placement = fitsBelow ? "bottom" : "top";
    const idealTop = fitsBelow ? triggerRect.bottom + gap : triggerRect.top - height - gap;
    const top = Math.min(window.innerHeight - height - edge, Math.max(edge, idealTop));
    setPosition({ top, left, placement });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const tooltipStyle: CSSProperties = { top: position.top, left: position.left };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={children ? "help-target" : "help-trigger"}
        aria-label={`도움말: ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (document.activeElement !== triggerRef.current) setOpen(false);
        }}
      >
        {children ?? <span aria-hidden="true">?</span>}
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className="help-tooltip"
            data-placement={position.placement}
            style={tooltipStyle}
          >
            {helpText[helpKey]}
          </div>,
          document.body,
        )}
    </>
  );
}
