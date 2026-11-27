#!/usr/bin/env bash
######################################################################
# .what = run the publish workflow's npm upgrade step on the .nvmrc node
#
# .why  = the publish job runs only on a release tag, so pr ci never
#         exercises its `npm install -g npm@<spec>` line. this skill runs
#         that exact line, read from the workflow, on the node .nvmrc
#         names, into a throwaway prefix — so an engine mismatch fails
#         loud before merge, not at the tag.
#
# usage:
#   rhx verify.publish-npm-pin                  # the spec in the workflow
#   rhx verify.publish-npm-pin --spec latest    # a spec of your choice
#
# options:
#   --spec <spec>   the npm spec to install (default: the one in the workflow)
#   --help, -h      print this contract and exit 0
#
# guarantee:
#   - reads the spec from .github/workflows/.publish-npm.yml unless --spec;
#     a `${{ … }}` spec is refused, since only the tag run can expand it
#   - with --spec, always runs the install: an explicit spec is a request to try it
#   - with the workflow's spec, mirrors its guard: where the .nvmrc node's own
#     npm is already >= 11.5.1, the tag skips the upgrade, and so does this
#   - runs on the .nvmrc node: the current node if it matches (an exact pin,
#     or a loose `22` / `22.21` / `22.x`), else fnm's
#   - installs npm into a temp prefix; installs no node, touches no global npm
#   - exit 0 = npm installed and >= 11.5.1 (the oidc minimum), or the step skips
#   - exit 1 = malfunction (install failed for a reason other than engine or spec)
#   - exit 2 = constraint (EBADENGINE, no such npm, npm < 11.5.1, an absent input, bad flag)
######################################################################
set -euo pipefail

######################################################################
# .what = print a constraint error with its fix, to stderr, and exit 2
# .why  = every caller-fixable failure reads the same and exits the same
# usage: fail_constraint what="<what went wrong>" fix="<the next move>"
######################################################################
fail_constraint() {
  local what="${1#what=}"
  local fix="${2#fix=}"
  {
    echo "🐢 bummer dude..."
    echo ""
    echo "✋ ConstraintError: $what"
    echo "   └─ fix: $fix"
  } >&2
  exit 2
}

######################################################################
# .what = print a malfunction error with its fix, to stderr, and exit 1
# .why  = a system fault reads as one, never as a raw shell abort
# usage: fail_malfunction what="<what went wrong>" fix="<the next move>"
######################################################################
fail_malfunction() {
  local what="${1#what=}"
  local fix="${2#fix=}"
  {
    echo "🐢 bummer dude..."
    echo ""
    echo "💥 MalfunctionError: $what"
    echo "   └─ fix: $fix"
  } >&2
  exit 1
}

######################################################################
# .what = succeed when a flag's value is absent: empty, or another flag
# .why  = `--spec --skill x` must read as an absent value, not as spec "--skill"
# usage: is_flag_value_absent value="${2:-}"
######################################################################
is_flag_value_absent() {
  local value="${1#value=}"
  [[ -z "$value" || "$value" == --* ]]
}

######################################################################
# .what = print the mascot line, then this skill's top header with its comment marks cut
# .why  = --help shows the same contract the file declares, with no copy to drift
# usage: print_skill_header skill="$0"
######################################################################
print_skill_header() {
  local skill="${1#skill=}"
  echo "🐢 heres the wave..."
  echo ""
  sed -n '3,/^####/{/^####/!s/^# \{0,1\}//p}' "$skill"
}

# parse flags
SPEC=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec)
      if is_flag_value_absent value="${2:-}"; then
        fail_constraint what="--spec needs a value" fix="rhx verify.publish-npm-pin --spec <spec>, e.g. --spec 11"
      fi
      SPEC="$2"; shift 2 ;;
    --spec=*)
      SPEC="${1#--spec=}"
      if [[ -z "$SPEC" ]]; then
        fail_constraint what="--spec needs a value" fix="rhx verify.publish-npm-pin --spec <spec>, e.g. --spec 11"
      fi
      shift ;;
    --skill)
      if is_flag_value_absent value="${2:-}"; then
        fail_constraint what="--skill needs a value" fix="call via rhx verify.publish-npm-pin, which passes --skill itself"
      fi
      shift 2 ;; # the rhx wrapper prepends --skill <name>
    --help|-h) print_skill_header skill="$0"; exit 0 ;;
    *) fail_constraint what="unknown flag $1" fix="the flags are --spec <spec> and --help; see rhx verify.publish-npm-pin --help" ;;
  esac
done

if ! REPO_ROOT="$(git rev-parse --show-toplevel 2> /dev/null)"; then
  fail_constraint what="$(pwd) is not in a git repo" fix="run from the repo whose publish workflow you want to check"
fi
WORKFLOW="$REPO_ROOT/.github/workflows/.publish-npm.yml"
MIN_VERSION="11.5.1"

######################################################################
# .what = print each npm spec the workflow's upgrade lines install, one per line
# .why  = the proof must test the line that ships, never a copy of it
# usage: get_all_npm_specs_from_workflow workflow="<path>"
# .note = skips yaml comment lines; a spec ends at a space, quote, or semicolon
######################################################################
get_all_npm_specs_from_workflow() {
  local workflow="${1#workflow=}"
  sed -n -e '/^[[:space:]]*#/d' -e "s/.*npm install -g npm@\([^ \"';]*\).*/\1/p" "$workflow"
}

######################################################################
# .what = print the whole `${{ … }}` expression on the workflow's upgrade line
# .why  = a spec stops at a space, so `${{ env.X }}` reads as `${{`; the error must quote it whole
# usage: get_npm_spec_expression_from_workflow workflow="<path>"
######################################################################
get_npm_spec_expression_from_workflow() {
  local workflow="${1#workflow=}"
  sed -n -e '/^[[:space:]]*#/d' -e 's/.*npm install -g npm@\([$][{][{][^}]*[}][}]\).*/\1/p' "$workflow" | sed -n '1p'
}

######################################################################
# .what = print the count of lines in a text
# .why  = names the "how many upgrade lines" question the guard asks
# usage: get_line_count text="<text>"
######################################################################
get_line_count() {
  local text="${1#text=}"
  wc -l <<< "$text" | tr -d '[:space:]'
}

######################################################################
# .what = print a text's lines joined by ", "
# .why  = lists every spec on one error line
# usage: get_lines_joined text="<text>"
######################################################################
get_lines_joined() {
  local text="${1#text=}"
  echo "${text//$'\n'/, }"
}

######################################################################
# .what = succeed when the current node satisfies the .nvmrc pin
# .why  = .nvmrc may be exact ("v22.21.0", "22.21.0") or loose ("22", "22.21", "22.x");
#         setup-node accepts each, so ci's node must count as a match for each
# usage: is_node_version_match current="v22.21.0" pin="22"
# .note = an alias such as "lts/*" never matches here; fnm resolves it instead
######################################################################
is_node_version_match() {
  local current="${1#current=}"
  local pin="${2#pin=}"
  current="${current#v}"
  pin="${pin#v}"
  pin="${pin%.x}"
  [[ "$current" == "$pin" || "$current" == "$pin".* ]]
}

######################################################################
# .what = print the code on npm's first "npm error code <CODE>" line, or naught
# .why  = the code is npm's structured verdict; its prose may change across releases
# usage: get_npm_error_code log="<install log>"
######################################################################
get_npm_error_code() {
  local log="${1#log=}"
  sed -n 's/^npm error code \([A-Za-z0-9_]*\).*/\1/p' "$log" | sed -n '1p'
}

######################################################################
# .what = succeed when version >= floor, by numeric major.minor.patch
# .why  = node is always present here; `sort -V` is not on every host
# usage: is_version_at_least version="11.21.3" floor="11.5.1"
# .note = a prerelease ranks below its own release (12.0.0-pre.1 < 12.0.0), as semver says;
#         build metadata (+abc) carries no rank, as semver says
######################################################################
is_version_at_least() {
  local version="${1#version=}"
  local floor="${2#floor=}"
  VERSION="$version" FLOOR="$floor" node -e '
    const [core, prerelease] = process.env.VERSION.split("+")[0].split("-");
    const [version, floor] = [core, process.env.FLOOR].map((v) => v.split(".").map(Number));
    const diff = version.map((part, i) => part - floor[i]).find((d) => d !== 0) ?? 0;
    const isAtLeast = diff > 0 || (diff === 0 && prerelease === undefined);
    process.exit(isAtLeast ? 0 : 1);
  '
}

######################################################################
# .what = run a command on the .nvmrc node: direct, or through fnm exec
# .why  = one call site per command; the empty-array form is safe on bash 3.2
# usage: run_on_node <command> [args...]
# .note = reads NODE_RUNNER, set once below, before the first call
######################################################################
run_on_node() {
  ${NODE_RUNNER[@]+"${NODE_RUNNER[@]}"} "$@"
}

######################################################################
# .what = print the path of the npm that ships beside the current node
# .why  = a PATH `npm` may be a pnpm shim; the node's own npm is the one ci runs
# usage: get_npm_bin_beside_node
######################################################################
get_npm_bin_beside_node() {
  echo "$(dirname "$(node -p 'process.execPath')")/npm"
}

######################################################################
# .what = print npm's Required and Actual engine lines as tree branches
# .why  = the two lines name both ranges, so the caller sees why it failed
# usage: emit_engine_mismatch_lines log="<install log>"
######################################################################
emit_engine_mismatch_lines() {
  local log="${1#log=}"
  { grep -E 'notsup (Required|Actual)' "$log" || true; } | sed 's/^/      ├─ /'
}

######################################################################
# .what = print npm's error code line, then the log's last 6 lines, as tree branches
# .why  = the code names the cause (ECONNREFUSED, E404); the tail can hold only npm's advice
# usage: emit_install_log_cause log="<install log>"
# .note = a bare "npm error" line is a blank in npm's log; it would draw an empty branch
######################################################################
emit_install_log_cause() {
  local log="${1#log=}"
  { grep -m1 'npm error code' "$log" || true; tail -n 6 "$log"; } \
    | { grep -vE '^npm error[[:space:]]*$' || true; } \
    | sed 's/^/      ├─ /'
}

# read the spec from the workflow, unless given; exactly one upgrade line must exist
SPEC_SOURCE="flag"
if [[ -z "$SPEC" ]]; then
  SPEC_SOURCE="workflow"
  if [[ ! -f "$WORKFLOW" ]]; then
    fail_constraint what="no publish workflow at $WORKFLOW" fix="pass --spec <spec>, or run from a repo with the workflow"
  fi
  # an unreadable file is checked first, so sed's raw fault never prints above the error
  if [[ ! -r "$WORKFLOW" ]] || ! SPECS="$(get_all_npm_specs_from_workflow workflow="$WORKFLOW" 2> /dev/null)"; then
    fail_malfunction what="could not read $WORKFLOW" fix="check the file's read permission, then re-run"
  fi
  if [[ -z "$SPECS" ]]; then
    fail_constraint what="no 'npm install -g npm@<spec>' line in $WORKFLOW" fix="if the workflow still upgrades npm, write the step as 'npm install -g npm@<spec>'; if it no longer does, there is no pin left to verify"
  fi
  if [[ "$(get_line_count text="$SPECS")" -gt 1 ]]; then
    fail_constraint what="several 'npm install -g npm@<spec>' lines in $WORKFLOW ($(get_lines_joined text="$SPECS"))" fix="pass --spec <spec> for the one to check"
  fi
  if [[ "$SPECS" == *'$'* ]]; then
    fail_constraint what="the workflow's npm spec '$(get_npm_spec_expression_from_workflow workflow="$WORKFLOW")' is an expression, which only the tag run can expand" fix="pin a literal spec (e.g. npm@11), or pass --spec <value>"
  fi
  SPEC="$SPECS"
fi

# read the node the publish job runs on
if [[ ! -s "$REPO_ROOT/.nvmrc" ]]; then
  fail_constraint what="no .nvmrc at $REPO_ROOT; it names the node the publish job runs on" fix="run from a repo with a .nvmrc"
fi
NODE_VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"

# run on that node: the current one if it matches (as in ci), else fnm's
if ! command -v node > /dev/null; then
  fail_constraint what="node is absent from PATH" fix="install node $NODE_VERSION, or fnm (https://github.com/Schniz/fnm)"
fi
NODE_RUNNER=()
NPM_BIN="$(get_npm_bin_beside_node)"
if ! is_node_version_match current="$(node --version)" pin="$NODE_VERSION"; then
  # an alias (lts/*, a codename) names no node to switch to; only fnm expands it
  if ! command -v fnm > /dev/null && [[ "$NODE_VERSION" =~ ^v?[0-9] ]]; then
    fail_constraint what="node is $(node --version), .nvmrc names $NODE_VERSION, and fnm is absent" fix="switch to node $NODE_VERSION, or install fnm (https://github.com/Schniz/fnm)"
  fi
  if ! command -v fnm > /dev/null; then
    fail_constraint what="node is $(node --version), .nvmrc names $NODE_VERSION, and fnm is absent" fix="install fnm (https://github.com/Schniz/fnm), which expands the alias $NODE_VERSION"
  fi
  if ! fnm exec --using="$NODE_VERSION" node --version > /dev/null 2>&1; then
    fail_constraint what="fnm holds no node $NODE_VERSION" fix="fnm install $NODE_VERSION"
  fi
  NODE_RUNNER=(fnm exec --using="$NODE_VERSION")
  NPM_BIN="npm" # fnm exec puts its node's own npm first on PATH
fi

######################################################################
# .what = print the mascot line and the skill header tree
# .why  = the vibe line tracks the verdict, so both headers print after the run
# usage: emit_header vibe="righteous!" spec="11" node="v22.21.0"
# .note = every fault after the spec and node are known prints under this tree
######################################################################
emit_header() {
  local vibe="${1#vibe=}"
  local spec="${2#spec=}"
  local node="${3#node=}"
  echo "🐢 $vibe"
  echo ""
  echo "🐚 verify.publish-npm-pin --spec $spec"
  echo "   ├─ node: $node (.nvmrc)"
  echo "   ├─ step: npm install -g npm@$spec"
}

# install into a throwaway prefix
if ! PREFIX="$(mktemp -d 2> /dev/null)"; then
  {
    emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
    echo "   └─ 💥 MalfunctionError: could not make a temp dir under ${TMPDIR:-/tmp} for the npm prefix"
    echo "      └─ fix: check that TMPDIR exists and has free space, then re-run"
  } >&2
  exit 1
fi
trap 'rm -rf "$PREFIX"' EXIT

# mirror the workflow's guard: the tag upgrades npm only when the node's own npm is below the floor
if [[ "$SPEC_SOURCE" == "workflow" ]]; then
  if ! BUNDLED="$(run_on_node "$NPM_BIN" --version 2> "$PREFIX/bundled.err")"; then
    {
      emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
      echo "   └─ 💥 MalfunctionError: the npm beside node $NODE_VERSION did not report its version"
      sed 's/^/      ├─ /' "$PREFIX/bundled.err"
      echo "      └─ fix: check the node install, then re-run"
    } >&2
    exit 1
  fi
  if is_version_at_least version="$BUNDLED" floor="$MIN_VERSION"; then
    emit_header vibe="righteous!" spec="$SPEC" node="$NODE_VERSION"
    echo "   ├─ bundled: npm $BUNDLED"
    echo "   └─ ✨ npm $BUNDLED >= $MIN_VERSION already, so the tag skips this step"
    exit 0
  fi
fi

# run the step
INSTALL_LOG="$PREFIX/install.log"
if ! run_on_node "$NPM_BIN" install -g --prefix "$PREFIX/npm" "npm@$SPEC" > "$INSTALL_LOG" 2>&1; then
  NPM_ERROR_CODE="$(get_npm_error_code log="$INSTALL_LOG")"

  # an engine mismatch is the verdict this check exists for: the caller fixes the spec or .nvmrc
  if [[ "$NPM_ERROR_CODE" == "EBADENGINE" ]]; then
    {
      emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
      echo "   └─ ✋ ConstraintError: npm@$SPEC does not run on node $NODE_VERSION"
      emit_engine_mismatch_lines log="$INSTALL_LOG"
      echo "      └─ fix: pin an npm whose engine accepts $NODE_VERSION, or bump .nvmrc into its range"
    } >&2
    exit 2
  fi

  # a spec the registry holds no version for is a caller error; a re-run cannot help
  if [[ "$NPM_ERROR_CODE" == "ETARGET" ]]; then
    {
      emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
      echo "   └─ ✋ ConstraintError: the registry holds no npm that matches '$SPEC'"
      echo "      └─ fix: pick a published spec; list them with: npm view npm versions"
    } >&2
    exit 2
  fi

  # any other failure (network, registry) is not a verdict on the pin
  {
    emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
    echo "   └─ 💥 MalfunctionError: npm install failed for a reason other than engine or spec"
    emit_install_log_cause log="$INSTALL_LOG"
    echo "      └─ fix: read the npm errors above; on a network or registry fault, re-run"
  } >&2
  exit 1
fi

# check the installed npm meets the oidc minimum
# stdout alone holds the version; a notice on stderr must not read as one
if ! INSTALLED="$(run_on_node "$PREFIX/npm/bin/npm" --version 2> "$PREFIX/installed.err")"; then
  {
    emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
    echo "   └─ 💥 MalfunctionError: the installed npm did not report its version"
    sed 's/^/      ├─ /' "$PREFIX/installed.err"
    echo "      └─ fix: re-run; if it repeats, the npm@$SPEC build does not start on node $NODE_VERSION"
  } >&2
  exit 1
fi
if ! is_version_at_least version="$INSTALLED" floor="$MIN_VERSION"; then
  {
    emit_header vibe="bummer dude..." spec="$SPEC" node="$NODE_VERSION"
    echo "   ├─ installed: npm $INSTALLED"
    echo "   └─ ✋ ConstraintError: npm $INSTALLED < $MIN_VERSION, too old for oidc"
    echo "      └─ fix: pin an npm >= $MIN_VERSION"
  } >&2
  exit 2
fi

emit_header vibe="righteous!" spec="$SPEC" node="$NODE_VERSION"
echo "   ├─ installed: npm $INSTALLED"
echo "   └─ ✨ npm $INSTALLED runs on node $NODE_VERSION, >= $MIN_VERSION for oidc"
