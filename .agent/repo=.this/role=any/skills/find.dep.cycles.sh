#!/usr/bin/env bash
######################################################################
# .what = find cycles in transitive dependencies via repo lint
#
# .why  = dpdm on src/**/*.ts follows imports into node_modules and
#         detects cycles in the full dependency tree. this skill
#         runs the repo's lint, extracts cyclic packages, and shows
#         actionable dep paths from direct deps to the cyclic package.
#
# usage:
#   ./find.dep.cycles.sh              # run lint and show actionable trees
#   ./find.dep.cycles.sh --expand dev # also show full dev dependency trees
#
# guarantee:
#   - runs repo lint:cycles command
#   - extracts package names, versions, and cycle paths
#   - parses pnpm why to show shortest paths to cycle
#   - exit 0 if no cycles, exit 2 if cycles found
######################################################################
set -uo pipefail

# parse args - skip --skill <name> if present (rhx wrapper adds these)
ARGS=("$@")
if [[ "${ARGS[0]:-}" == "--skill" ]]; then
  ARGS=("${ARGS[@]:2}")  # skip first two args
fi

EXPAND_DEV=false
[[ "${ARGS[0]:-}" == "--expand" && "${ARGS[1]:-}" == "dev" ]] && EXPAND_DEV=true

echo "run lint to detect cycles..."
echo ""

# run the lint command and capture output
OUTPUT=$(npm run test:lint:cycles 2>&1) || true

# check if cycles were found
if echo "$OUTPUT" | grep -q "no circular dependency was found"; then
  echo "no cycles detected"
  exit 0
fi
if ! echo "$OUTPUT" | grep -q "• Circular Dependencies"; then
  echo "no cycles detected"
  exit 0
fi

# extract cycle lines (format: "  1) path -> path")
CYCLES=$(echo "$OUTPUT" | awk '/• Circular Dependencies/{flag=1; next} flag && /^•/{flag=0} flag && NF{print}')

# track unique packages
declare -A PACKAGES=()
PACKAGES_COUNT=0

# process each cycle line
while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  # extract package info from path like: node_modules/.pnpm/helpful-errors@1.5.3/node_modules/helpful-errors/dist/file.js
  if [[ "$line" =~ node_modules/\.pnpm/([^@]+)@([^/]+)/ ]]; then
    PKG_NAME="${BASH_REMATCH[1]}"
    PKG_VERSION="${BASH_REMATCH[2]}"
    PKG_KEY="${PKG_NAME}@${PKG_VERSION}"
  elif [[ "$line" =~ node_modules/([^/]+)/ ]]; then
    PKG_NAME="${BASH_REMATCH[1]}"
    PKG_JSON="node_modules/$PKG_NAME/package.json"
    if [[ -f "$PKG_JSON" ]]; then
      PKG_VERSION=$(jq -r '.version' "$PKG_JSON" 2>/dev/null) || PKG_VERSION="?"
    else
      PKG_VERSION="?"
    fi
    PKG_KEY="${PKG_NAME}@${PKG_VERSION}"
  else
    continue
  fi

  # clean up the cycle path for display
  CLEAN_LINE=$(echo "$line" | sed 's|node_modules/.pnpm/[^/]*/node_modules/||g' | sed 's|^ *[0-9]*) *||')

  # append to package entry
  if [[ -z "${PACKAGES[$PKG_KEY]:-}" ]]; then
    PACKAGES[$PKG_KEY]="$CLEAN_LINE"
    ((PACKAGES_COUNT++))
  fi
done <<< "$CYCLES"

echo "==============================================="
echo "CYCLES DETECTED"
echo "==============================================="

# check if any packages were found
if [[ $PACKAGES_COUNT -eq 0 ]]; then
  echo ""
  echo "(cycle detected but no node_modules packages extracted)"
  echo ""
  echo "raw cycle output:"
  echo "$CYCLES" | sed 's/^/  /'
  echo ""
  echo "==============================================="
  echo "total: 0 package(s) with cycles"
  echo "==============================================="
  exit 2
fi

# output each cyclic package with its dep tree
for PKG_KEY in "${!PACKAGES[@]}"; do
  PKG_NAME="${PKG_KEY%@*}"
  PKG_VERSION="${PKG_KEY##*@}"

  echo ""
  echo "## $PKG_KEY"
  echo ""
  echo "cycle:"
  echo "  ${PACKAGES[$PKG_KEY]}"
  echo ""

  # show version analysis - why cycles are path-dependent
  HOISTED_VERSION=""
  if [[ -f "node_modules/$PKG_NAME/package.json" ]]; then
    HOISTED_VERSION=$(jq -r '.version' "node_modules/$PKG_NAME/package.json" 2>/dev/null)
  fi

  NESTED_PATH="node_modules/.pnpm/${PKG_NAME}@${PKG_VERSION}/node_modules/${PKG_NAME}"
  NESTED_EXISTS="no"
  [[ -d "$NESTED_PATH" ]] && NESTED_EXISTS="yes"

  echo "version analysis:"
  if [[ -n "$HOISTED_VERSION" ]]; then
    if [[ "$HOISTED_VERSION" == "$PKG_VERSION" ]]; then
      echo "  hoisted: $PKG_NAME@$HOISTED_VERSION (same as cyclic)"
    else
      echo "  hoisted: $PKG_NAME@$HOISTED_VERSION (no cycle)"
      echo "  nested:  $PKG_NAME@$PKG_VERSION (cyclic) at .pnpm/"
      echo ""
      echo "  why intermittent: dpdm follows import paths. cycle detected only when"
      echo "  code path leads to nested $PKG_VERSION, not hoisted $HOISTED_VERSION."
    fi
  else
    echo "  hoisted: (none)"
    echo "  nested:  $PKG_NAME@$PKG_VERSION at .pnpm/"
  fi
  echo ""

  # trace the root cause: package-level dependency cycle
  echo "root cause (package cycle):"
  CYCLIC_PKG_JSON="node_modules/.pnpm/${PKG_NAME}@${PKG_VERSION}/node_modules/${PKG_NAME}/package.json"
  if [[ -f "$CYCLIC_PKG_JSON" ]]; then
    # get deps of the cyclic package
    CYCLIC_DEPS=$(jq -r '.dependencies // {} | to_entries[] | "\(.key)@\(.value)"' "$CYCLIC_PKG_JSON" 2>/dev/null)
    while IFS= read -r DEP_SPEC; do
      [[ -z "$DEP_SPEC" ]] && continue
      DEP_NAME="${DEP_SPEC%@*}"
      DEP_CONSTRAINT="${DEP_SPEC##*@}"

      # find the resolved version of this dep
      DEP_PATH=$(find "node_modules/.pnpm/${PKG_NAME}@${PKG_VERSION}/node_modules/${DEP_NAME}" -maxdepth 0 -type l 2>/dev/null)
      if [[ -n "$DEP_PATH" ]]; then
        DEP_RESOLVED=$(readlink "$DEP_PATH" | grep -oP '(?<=/)'"${DEP_NAME}"'@[^/]+' | head -1)
        DEP_RESOLVED_VERSION="${DEP_RESOLVED##*@}"

        # check if this dep depends back on our cyclic package
        DEP_PKG_JSON=$(readlink -f "$DEP_PATH")/package.json
        if [[ -f "$DEP_PKG_JSON" ]]; then
          BACK_DEP=$(jq -r ".dependencies[\"$PKG_NAME\"] // empty" "$DEP_PKG_JSON" 2>/dev/null)
          if [[ -n "$BACK_DEP" ]]; then
            echo "  $PKG_NAME@$PKG_VERSION"
            echo "    └── $DEP_NAME: \"$DEP_CONSTRAINT\" (resolves to $DEP_RESOLVED_VERSION)"
            echo "        └── $PKG_NAME: \"$BACK_DEP\" (cycle back!)"
            echo ""
            if [[ "$BACK_DEP" == "^"* ]] || [[ "$BACK_DEP" == "~"* ]]; then
              echo "  fix: update $DEP_NAME to use $PKG_NAME@$HOISTED_VERSION (or remove cycle)"
            fi
          fi
        fi
      fi
    done <<< "$CYCLIC_DEPS"
  else
    echo "  (could not read $CYCLIC_PKG_JSON)"
  fi
  echo ""

  # get dependency tree for this specific version
  WHY_OUTPUT=$(pnpm why "$PKG_KEY" 2>/dev/null) || continue

  # parse and show actionable paths
  # extract unique shortest paths from each direct dep to the cyclic package

  echo "actionable paths:"
  echo ""

  # PROD: parse dependencies section - show each direct dep's shortest path
  echo "  PROD:"
  PROD_SECTION=$(echo "$WHY_OUTPUT" | awk '/^dependencies:/{flag=1; next} /^devDependencies:/{flag=0} flag{print}')
  if [[ -n "$PROD_SECTION" ]]; then
    # find direct deps (lines that start with a package name, no tree prefix)
    CURRENT_DIRECT=""
    CURRENT_PATH=""
    while IFS= read -r line; do
      # direct dep: starts with package name (no tree chars)
      if [[ "$line" =~ ^([a-zA-Z@][^ ]+) ]]; then
        # print previous if we had one
        if [[ -n "$CURRENT_DIRECT" ]]; then
          echo "    $CURRENT_DIRECT"
          echo "$CURRENT_PATH" | sed 's/^/    /'
          echo ""
        fi
        CURRENT_DIRECT="${BASH_REMATCH[1]}"
        CURRENT_PATH=""
      elif [[ -n "$CURRENT_DIRECT" ]]; then
        # accumulate path lines until we hit the target package
        CURRENT_PATH+="$line"$'\n'
      fi
    done <<< "$PROD_SECTION"
    # print last one
    if [[ -n "$CURRENT_DIRECT" ]]; then
      echo "    $CURRENT_DIRECT"
      echo "$CURRENT_PATH" | sed 's/^/    /'
    fi
  else
    echo "    (none)"
  fi
  echo ""

  # DEV: show direct devDeps, or full trees if --expand dev
  DEV_SECTION=$(echo "$WHY_OUTPUT" | awk '/^devDependencies:/{flag=1; next} flag{print}')
  if [[ "$EXPAND_DEV" == "true" ]]; then
    echo "  DEV (full trees):"
    if [[ -n "$DEV_SECTION" ]]; then
      # parse like PROD: add newline before each direct dep
      CURRENT_DIRECT=""
      CURRENT_PATH=""
      while IFS= read -r line; do
        # direct dep: starts with package name (no tree chars)
        if [[ "$line" =~ ^([a-zA-Z@][^ ]+) ]]; then
          # print previous if we had one
          if [[ -n "$CURRENT_DIRECT" ]]; then
            echo "    $CURRENT_DIRECT"
            echo "$CURRENT_PATH" | sed 's/^/    /'
            echo ""
          fi
          CURRENT_DIRECT="${BASH_REMATCH[1]}"
          CURRENT_PATH=""
        elif [[ -n "$CURRENT_DIRECT" ]]; then
          CURRENT_PATH+="$line"$'\n'
        fi
      done <<< "$DEV_SECTION"
      # print last one
      if [[ -n "$CURRENT_DIRECT" ]]; then
        echo "    $CURRENT_DIRECT"
        echo "$CURRENT_PATH" | sed 's/^/    /'
      fi
    else
      echo "    (none)"
    fi
  else
    echo "  DEV (direct deps only, use --expand dev for full trees):"
    if [[ -n "$DEV_SECTION" ]]; then
      echo "$DEV_SECTION" | awk '/^[a-zA-Z@]/{print "    " $1}'
    else
      echo "    (none)"
    fi
  fi
  echo ""
done

echo "==============================================="
echo "total: $PACKAGES_COUNT package(s) with cycles"
echo "==============================================="

exit 2
