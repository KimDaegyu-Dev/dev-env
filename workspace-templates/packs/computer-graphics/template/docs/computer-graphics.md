# Computer Graphics

## Tooling

- Rust
- Vulkan
- ash
- Slang or Vulkan SDK `glslc`
- RenderDoc for frame capture

## Policy

- Do not commit capture files.
- Commit shader source, not generated SPIR-V unless the project explicitly requires it.
- Keep render tests deterministic where possible.
