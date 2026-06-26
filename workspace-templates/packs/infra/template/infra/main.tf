resource "null_resource" "workspace_placeholder" {
  triggers = {
    workspace = "{{projectName}}"
  }
}
