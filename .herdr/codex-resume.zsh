# Herdr 0.9.3 restores only `codex resume <id>`. Scope this adapter to DGOS.
codex() {
  if [[ ${HERDR_ENV:-} == 1 &&
        ( $PWD == /Users/apple/Progame/DGOS || $PWD == /Users/apple/Progame/DGOS/* ) &&
        ${1:-} == resume ]]; then
    local dgos_arg
    for dgos_arg in "$@"; do
      if [[ $dgos_arg == model_catalog_json=* ]]; then
        command codex "$@"
        return $?
      fi
    done
    local dgos_catalog=/Users/apple/Progame/DGOS/.herdr/state/codex-models.json
    if [[ ! -r $dgos_catalog ]]; then
      print -u2 -- 'DGOS Codex catalog missing; run node .herdr/prepare-codex-catalog.mjs first.'
      return 1
    fi
    command codex "$@" --sandbox workspace-write --ask-for-approval never \
      --disable computer_use -c "model_catalog_json=\"$dgos_catalog\""
  else
    command codex "$@"
  fi
}
