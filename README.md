# Autonomous Tag Action

[![Main](https://img.shields.io/github/actions/workflow/status/oobook/autonomous-tag/main.yml?label=build&logo=github-actions)](https://github.com/oobook/autonomous-tag/actions?workflow=main)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/oobook/autonomous-tag?label=release&logo=GitHub)](https://github.com/oobook/autonomous-tag/releases)
[![GitHub release (latest SemVer)](https://img.shields.io/github/release-date/oobook/autonomous-tag?label=release%20date&logo=GitHub)](https://github.com/oobook/autonomous-tag/releases)
![GitHub License](https://img.shields.io/github/license/oobook/autonomous-tag)

<!-- [![Lint](https://img.shields.io/badge/eslint-3A33D1?style=for-the-badge&logo=eslint&logoColor=white)](https://github.comoobook/autonomous-tag/actions/workflows/lint.yml) -->

<!-- [![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/oobook/autonomous-tag?label=Tag&logo=GitHub)](https://github.com/oobook/autonomous-tag/releases) -->
<!-- [![Luarocks](https://img.shields.io/luarocks/v/oobook/autonomous-tag?label=Luarocks&logo=Lua)](https://luarocks.org/modules/oobook/autonomous-tag) -->
<!-- [![Lint](https://img.shields.io/badge/logo%20-javascript-blue?logo=javascript)]() -->
<!-- [![GitHub release (latest by date)](https://img.shields.io/github/v/release/oobook/autonomous-tag)](https://github.com/oobook/autonomous-tag/releases) -->

A GitHub action that creates a new tag according to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#specification).

<!-- > [!NOTE]
> Useful information that users should know, even when skimming content.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions. -->
## What's it do?

This action will automatically create a new tag and release for your repository when a pull request is merged to the default branch. It will also create a changelog entry for the new tag and release.

## Inputs

| Name | Description | Obligatory | Default
| --- | --- | --- | --- |
| `gh-token` | A GitHub token with `repo` scope. This is used to create release | required | |
| `tag` | Predefined tag | optional | |

## Outputs

| Name | Description |
| --- | --- | 
| `tag` | The new auto-generated tag |
| `ref` | The new tag ref |

### Usage

```yaml
name: Generate Tag
on:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oobook/autonomous-tag@v1
        id: tag-generation
        with:
          gh-token: ${{ github.token }}
      # Instance for using the outputs of the action
      - name: Get Tag Outputs 
        if: ${{ success() && steps.tag-generation.outputs.tag != '' }}
        run: |
          {
            echo 'release_tag<<EOF'
            yarn test 2>&1
            echo EOF
          } >> "$GITHUB_ENV"
        with: 
          release_tag: {{ steps.tag-generation.outputs.tag }}
```
