# Rust

Rust 프로필은 rust-analyzer, Cargo, Clippy, rustfmt, LLDB 중심입니다.

## Recommended Tools

- rustup
- stable toolchain
- clippy
- rustfmt
- cargo-nextest, 필요 시 검토

## VS Code Profile Settings

`vscode/rust/settings.json`에는 개인 개발 경험 설정을 둡니다.

- rust-analyzer check command
- LLDB debug engine
- TOML formatter
- 프로필 색상

## Project Settings

프로젝트 repo에는 다음처럼 프로젝트 고유 설정만 둡니다.

- workspace-specific toolchain file
- feature flags
- test command
- env example

`cargo check`, `cargo test`, `cargo clippy`, `cargo fmt`는 `vscode/rust/tasks.json`에 준비되어 있습니다.
